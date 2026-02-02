const { spawn } = require("child_process");
const { PassThrough } = require("stream");
const { findCommandInPath } = require("../utils/pathUtils");
const { isBuiltin, executeBuiltin } = require("./builtins");

/**
 * Represents a builtin command running inside a pipeline.
 * @typedef {object} BuiltinEntry
 * @property {true} isBuiltin - Flag to identify this as a builtin
 * @property {Promise<void>} promise - Resolves when the builtin finishes
 */

/**
 * Represents an external command running inside a pipeline.
 * @typedef {object} ExternalEntry
 * @property {false} isBuiltin - Flag to identify this as an external command
 * @property {import("child_process").ChildProcess} process - The spawned child process
 */

/**
 * A single entry in the pipeline's process list.
 * Either a builtin or an external command, unified by the isBuiltin flag.
 * This lets us check entry.isBuiltin and TypeScript will narrow
 * the type automatically in each branch.
 * @typedef {BuiltinEntry | ExternalEntry} PipelineEntry
 */

/**
 * @typedef {object} HistoryManager
 * @property {function(string): {success: boolean}} readFromFile - Reads history from a file
 * @property {function(string): {success: boolean}} writeToFile - Writes all history to a file
 * @property {function(string): {success: boolean}} appendToFile - Appends new history to a file
 * @property {function(): string[]} getHistory - Returns the full history array
 */

/**
 * Executes a single external command with optional output redirection.
 *
 * Handles:
 * - Finding the command in PATH
 * - Setting up stdio based on whether redirection is active
 * - Piping stdout or stderr to a file when redirected
 * - Waiting for the process and any write streams to finish
 *   before prompting for the next command
 *
 * @param {string} command - The command name (e.g., "ls")
 * @param {string[]} args - Arguments to the command
 * @param {{
 *   hasRedirection: boolean,
 *   redirectFile: string|null,
 *   redirectFd: number,
 *   isAppend: boolean
 * }} redirectionInfo - Redirection settings from the parser
 * @param {function} onComplete - Callback when the command finishes
 */
function executeSingleCommand(command, args, redirectionInfo, onComplete) {
  const fs = require("fs");

  // Find the command on disk
  const fullPath = findCommandInPath(command);
  if (!fullPath) {
    console.log(`${command}: command not found`);
    onComplete();
    return;
  }

  const { hasRedirection, redirectFile, redirectFd, isAppend } =
    redirectionInfo;

  // Set up stdio and write stream based on redirection
  /** @type {import("child_process").StdioOptions} */
  let stdioConfig = "inherit"; // Default: everything goes to terminal
  let writeStream = null;

  if (hasRedirection && redirectFile) {
    // If overwriting stderr, create/truncate the file first
    if (redirectFd === 2 && !isAppend) {
      try {
        fs.writeFileSync(redirectFile, "");
      } catch (err) {
        // Intentionally ignore - writeStream creation below will catch real errors
      }
    }

    // Create a write stream to the redirect file
    const streamOptions = isAppend ? { flags: "a" } : {};
    writeStream = fs.createWriteStream(redirectFile, streamOptions);

    // Configure stdio:
    // - If redirecting stdout (fd 1): pipe stdout so we can capture it
    // - If redirecting stderr (fd 2): pipe stderr so we can capture it
    if (redirectFd === 1) {
      stdioConfig = ["inherit", "pipe", "inherit"];
    } else if (redirectFd === 2) {
      stdioConfig = ["inherit", "inherit", "pipe"];
    }
  }

  // Spawn the process
  const childProcess = spawn(fullPath, args, {
    stdio: stdioConfig,
    argv0: command, // Sets the process name (what shows up in ps)
  });

  // Track two things finishing: the process and the write stream
  // We need BOTH done before we prompt for next input
  let processClosed = false;
  let streamFinished = !writeStream; // If no stream, it's already "done"

  const maybeComplete = () => {
    if (processClosed && streamFinished) {
      onComplete();
    }
  };

  // If we have a write stream, pipe the appropriate output to it
  if (writeStream) {
    if (redirectFd === 1 && childProcess.stdout) {
      childProcess.stdout.pipe(writeStream);
    } else if (redirectFd === 2 && childProcess.stderr) {
      childProcess.stderr.pipe(writeStream);
    }

    writeStream.on("finish", () => {
      streamFinished = true;
      maybeComplete();
    });

    writeStream.on("error", () => {
      streamFinished = true;
      maybeComplete();
    });
  }

  // Wait for the process to finish
  childProcess.on("close", () => {
    processClosed = true;
    maybeComplete();
  });

  childProcess.on("error", (err) => {
    if (writeStream) {
      writeStream.destroy();
    }
    console.error(`Error: ${err.message}`);
    onComplete();
  });
}

/**
 * Executes a pipeline of one or more commands.
 *
 * This is the heart of how pipes work:
 * 1. Loop through each command in the pipeline
 * 2. For each command, set up its stdin and stdout based on position
 * 3. Connect stdout of each command to stdin of the next
 * 4. Wait for all commands to finish before prompting
 *
 * Handles both external commands (spawned processes) and
 * builtins (which use streams instead of child processes).
 *
 * @param {string[][]} commands - Array of command arrays from parsePipeline
 * @param {HistoryManager} historyManager - The history manager instance
 * @param {function} onComplete - Callback when the entire pipeline finishes
 */
function executePipeline(commands, historyManager, onComplete) {
  if (commands.length === 0) {
    onComplete();
    return;
  }

  /** @type {PipelineEntry[]} */
  const processes = []; // Stores each command's process or builtin info
  const streams = []; // Stores output streams between commands

  for (let i = 0; i < commands.length; i++) {
    const commandTokens = commands[i];
    const command = commandTokens[0];
    const args = commandTokens.slice(1);
    const isFirstCommand = i === 0;
    const isLastCommand = i === commands.length - 1;

    if (isBuiltin(command)) {
      // BUILTIN COMMAND IN PIPELINE
      // Builtins don't spawn processes - they use streams directly

      // Input: read from previous command's output (if not first)
      const inputStream = i > 0 ? streams[i - 1] : null;

      // Output: if not the last command, create a PassThrough stream
      // so the next command can read from it
      let outputStream = null;
      if (!isLastCommand) {
        outputStream = new PassThrough();
        streams.push(outputStream);
      }

      // Execute the builtin - it writes to outputStream (or stdout if null)
      // Pass inputStream so the builtin (or executeBuiltin itself) can drain it,
      // otherwise the upstream command's stdout pipe stays open and the pipeline hangs.
      const promise = executeBuiltin(
        command,
        args,
        inputStream,
        outputStream,
        historyManager,
      );

      // Wrap in our BuiltinEntry shape
      processes.push({ isBuiltin: true, promise });
    } else {
      // EXTERNAL COMMAND IN PIPELINE
      // We need to spawn a process and wire up its streams

      const fullPath = findCommandInPath(command);
      if (!fullPath) {
        console.log(`${command}: command not found`);
        onComplete();
        return;
      }

      // Configure stdio based on position in pipeline
      /** @type {import("child_process").StdioOptions} */
      let stdioConfig = "inherit";
      if (isFirstCommand) {
        // First: terminal stdin, pipe stdout (so next command can read it)
        stdioConfig = ["inherit", "pipe", "inherit"];
      } else if (isLastCommand) {
        // Last: pipe stdin (we feed from previous), terminal stdout
        stdioConfig = ["pipe", "inherit", "inherit"];
      } else {
        // Middle: pipe both stdin and stdout
        stdioConfig = ["pipe", "pipe", "inherit"];
      }

      const childProcess = spawn(fullPath, args, {
        stdio: stdioConfig,
        argv0: command,
      });

      // Connect previous command's output to this command's input
      // We guard with null checks because TypeScript can't know that
      // our stdio config guarantees these streams exist
      if (i > 0 && childProcess.stdin) {
        const prev = processes[i - 1];
        if (prev.isBuiltin) {
          // Previous was a builtin - pipe from its PassThrough stream
          streams[i - 1].pipe(childProcess.stdin);
        } else if (prev.process.stdout) {
          // Previous was external - pipe from its stdout
          prev.process.stdout.pipe(childProcess.stdin);
        }
      }

      // Save this command's stdout for the next command (if not last)
      // Guard with null check - stdout exists because we set it to "pipe"
      if (!isLastCommand && childProcess.stdout) {
        streams.push(childProcess.stdout);
      }

      // Wrap in our ExternalEntry shape
      processes.push({ isBuiltin: false, process: childProcess });
    }
  }

  // Wait for ALL commands in the pipeline to finish
  let completedCount = 0;
  const totalProcesses = processes.length;

  const checkCompletion = () => {
    completedCount++;
    if (completedCount === totalProcesses) {
      onComplete(); // Everything done - prompt for next input
    }
  };

  // Attach completion handlers to each process/builtin
  processes.forEach((entry) => {
    if (entry.isBuiltin) {
      // Builtins are promises - wait for them to resolve
      entry.promise.then(checkCompletion).catch(checkCompletion);
    } else {
      // External processes - wait for "close" event
      entry.process.on("close", checkCompletion);
      entry.process.on("error", (err) => {
        console.error(`Error: ${err.message}`);
        checkCompletion();
      });
    }
  });
}

module.exports = { executeSingleCommand, executePipeline };
