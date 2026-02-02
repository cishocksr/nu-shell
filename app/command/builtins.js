const { findCommandInPath } = require("../utils/pathUtils");

/**
 * @typedef {object} HistoryManager
 * @property {function(string): {success: boolean}} readFromFile - Reads history from a file
 * @property {function(string): {success: boolean}} writeToFile - Writes all history to a file
 * @property {function(string): {success: boolean}} appendToFile - Appends new history to a file
 * @property {function(): string[]} getHistory - Returns the full history array
 */

/**
 * List of all builtin command names.
 * Used by isBuiltin() and the "type" command to identify builtins.
 * Note: "exit" is included here for "type" recognition,
 * but its execution is handled in index.js (shell lifecycle control).
 */
const BUILTINS = ["echo", "exit", "type", "pwd", "cd", "history"];

/**
 * Helper function to write output to either a stream or stdout.
 *
 * When a builtin runs inside a pipeline, its output goes to a stream
 * so it can be piped to the next command. When it runs normally,
 * output goes directly to the terminal.
 *
 * @param {string} output - The text to write
 * @param {import("stream").Writable|null} outputStream - Stream to write to, or null for stdout
 */
function writeOutput(output, outputStream) {
  if (outputStream) {
    outputStream.write(output);
    outputStream.end();
  } else {
    process.stdout.write(output);
  }
}

/**
 * Checks if a command name is a builtin
 *
 * @param {string} command - The command name to check
 * @returns {boolean} - True if the command is a builtin
 */
function isBuiltin(command) {
  return BUILTINS.includes(command);
}

/**
 * Executes the echo command.
 * Joins all arguments with a single space and outputs them.
 *
 * Quote handling and space collapsing is already done by
 * the command parser before args reach here.
 *
 * Examples:
 * args = ["hello", "world"]        → "hello world"
 * args = ["hello   world", "test"] → "hello   world test"
 *
 * @param {string[]} args - Arguments to echo
 * @param {import("stream").Writable|null} outputStream - Output stream or null for stdout
 * @returns {Promise<void>}
 */
function executeEcho(args, outputStream) {
  const output = args.join(" ") + "\n";
  writeOutput(output, outputStream);
  return Promise.resolve();
}

/**
 * Executes the pwd command.
 * Prints the current working directory.
 *
 * @param {string[]} args - Not used for pwd
 * @param {import("stream").Writable|null} outputStream - Output stream or null for stdout
 * @returns {Promise<void>}
 */
function executePwd(args, outputStream) {
  const output = process.cwd() + "\n";
  writeOutput(output, outputStream);
  return Promise.resolve();
}

/**
 * Executes the cd command.
 * Changes the current working directory.
 *
 * Handles these cases:
 * - cd          → go to HOME directory
 * - cd /path    → go to /path
 * - cd ~        → go to HOME directory
 * - cd ~/path   → go to HOME/path
 *
 * @param {string[]} args - The target directory (optional)
 * @param {import("stream").Writable|null} outputStream - Output stream or null for stdout
 * @returns {Promise<void>}
 */
function executeCd(args, outputStream) {
  const pathModule = require("path");

  // If no argument, default to HOME
  let targetDir = args.length > 0 ? args[0] : process.env.HOME;

  // Handle tilde (~) expansion
  if (targetDir && targetDir.startsWith("~")) {
    const home = process.env.HOME;

    // HOME must be set for ~ to work
    if (!home) {
      writeOutput("cd: HOME not set\n", outputStream);
      return Promise.resolve();
    }

    if (targetDir === "~") {
      // Just "~" means go to HOME
      targetDir = home;
    } else if (targetDir.startsWith("~/")) {
      // "~/something" means HOME/something
      // slice(2) removes the "~/" prefix
      targetDir = pathModule.join(home, targetDir.slice(2));
    }
  }

  // If targetDir is still null/undefined, HOME was not set
  if (!targetDir) {
    writeOutput("cd: HOME not set\n", outputStream);
    return Promise.resolve();
  }

  // Attempt to change directory
  try {
    process.chdir(targetDir);
  } catch (err) {
    // chdir throws if the directory doesn't exist
    writeOutput(`cd: ${targetDir}: No such file or directory\n`, outputStream);
  }

  // cd produces no output on success, but we still need to end the stream
  // if one was provided (for pipeline compatibility)
  if (outputStream) {
    outputStream.end();
  }

  return Promise.resolve();
}

/**
 * Executes the type command.
 * Reports whether a command is a builtin or where it lives on disk.
 *
 * Examples:
 * type echo  → "echo is a shell builtin"
 * type ls    → "ls is /bin/ls"
 * type foo   → "foo: not found"
 *
 * @param {string[]} args - The command name to look up
 * @param {import("stream").Writable|null} outputStream - Output stream or null for stdout
 * @returns {Promise<void>}
 */
function executeType(args, outputStream) {
  if (args.length === 0) {
    writeOutput("type: missing argument\n", outputStream);
    return Promise.resolve();
  }

  const commandToCheck = args[0];
  let output;

  if (BUILTINS.includes(commandToCheck)) {
    // Found it in our builtins list
    output = `${commandToCheck} is a shell builtin\n`;
  } else {
    // Not a builtin - search PATH for it
    const fullPath = findCommandInPath(commandToCheck);
    if (fullPath) {
      output = `${commandToCheck} is ${fullPath}\n`;
    } else {
      output = `${commandToCheck}: not found\n`;
    }
  }

  writeOutput(output, outputStream);
  return Promise.resolve();
}

/**
 * Executes the history command.
 *
 * Four modes of operation:
 * - history          → display all history entries
 * - history 5        → display last 5 entries
 * - history -r file  → read history from file into memory
 * - history -w file  → write all history to file (overwrites)
 * - history -a file  → append only new history entries to file
 *
 * @param {string[]} args - Arguments and flags
 * @param {import("stream").Writable|null} outputStream - Output stream or null for stdout
 * @param {HistoryManager} historyManager - The history manager instance
 * @returns {Promise<void>}
 */
function executeHistory(args, outputStream, historyManager) {
  const flag = args[0];

  // MODE 1: Read history from file (-r)
  if (flag === "-r") {
    if (args.length < 2) {
      writeOutput("history: -r: option requires an argument\n", outputStream);
      return Promise.resolve();
    }

    const result = historyManager.readFromFile(args[1]);
    if (!result.success) {
      writeOutput(
        `history: ${args[1]}: No such file or directory\n`,
        outputStream,
      );
    } else if (outputStream) {
      outputStream.end();
    }
    return Promise.resolve();
  }

  // MODE 2: Write all history to file (-w)
  if (flag === "-w") {
    if (args.length < 2) {
      writeOutput("history: -w: option requires an argument\n", outputStream);
      return Promise.resolve();
    }

    const result = historyManager.writeToFile(args[1]);
    if (!result.success) {
      writeOutput(`history: ${args[1]}: cannot write to file\n`, outputStream);
    } else if (outputStream) {
      outputStream.end();
    }
    return Promise.resolve();
  }

  // MODE 3: Append new history to file (-a)
  if (flag === "-a") {
    if (args.length < 2) {
      writeOutput("history: -a: option requires an argument\n", outputStream);
      return Promise.resolve();
    }

    const result = historyManager.appendToFile(args[1]);
    if (!result.success) {
      writeOutput(`history: ${args[1]}: cannot write to file\n`, outputStream);
    } else if (outputStream) {
      outputStream.end();
    }
    return Promise.resolve();
  }

  // MODE 4: Display history
  const history = historyManager.getHistory();
  let numToShow = history.length; // Default: show all

  // If a number was passed, only show that many entries
  if (flag !== undefined) {
    const n = parseInt(flag, 10);
    if (!isNaN(n) && n > 0) {
      numToShow = n;
    }
  }

  // Calculate where to start showing from
  // Example: 10 entries, numToShow = 3 → start at index 7
  const startIndex = Math.max(0, history.length - numToShow);

  let output = "";
  for (let i = startIndex; i < history.length; i++) {
    // Format: "    1  command"
    // 4 spaces, entry number, 2 spaces, the command
    output += `    ${i + 1}  ${history[i]}\n`;
  }

  writeOutput(output, outputStream);
  return Promise.resolve();
}

/**
 * Main entry point for executing any builtin command.
 *
 * Routes to the correct handler based on command name.
 * All builtins return a Promise so they can be used
 * consistently alongside external commands in pipelines.
 *
 * If inputStream is provided (i.e. this builtin is not the first command
 * in a pipeline), we resume() it to drain the data. This is critical:
 * without draining, the upstream command's stdout pipe stays open and
 * the pipeline never completes. None of the current builtins read from
 * stdin, so we discard the data here. A future builtin that needs to
 * consume stdin (e.g. a "cat" builtin) would read from inputStream
 * instead of resuming it.
 *
 * Note: "exit" is not handled here - see index.js
 *
 * @param {string} command - The builtin command name
 * @param {string[]} args - Arguments to the command
 * @param {import("stream").Readable|null} inputStream - Input stream from previous pipeline stage, or null
 * @param {import("stream").Writable|null} outputStream - Output stream or null for stdout
 * @param {HistoryManager} historyManager - The history manager instance
 * @returns {Promise<void>}
 */
function executeBuiltin(
  command,
  args,
  inputStream,
  outputStream,
  historyManager,
) {
  // Drain the input stream so the upstream pipe closes cleanly.
  // resume() puts the stream into flowing mode, discarding all data.
  if (inputStream) {
    inputStream.resume();
  }

  switch (command) {
    case "echo":
      return executeEcho(args, outputStream);
    case "pwd":
      return executePwd(args, outputStream);
    case "cd":
      return executeCd(args, outputStream);
    case "type":
      return executeType(args, outputStream);
    case "history":
      return executeHistory(args, outputStream, historyManager);
    default:
      return Promise.resolve();
  }
}

module.exports = { isBuiltin, executeBuiltin, BUILTINS };
