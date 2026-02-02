// Node.js built-ins
const readline = require("node:readline");
const fs = require("node:fs");

// Parsers
const { parseCommandLine } = require("./parsers/commandParser");
const { parsePipeline } = require("./parsers/pipelineParser");
const { parseRedirection } = require("./parsers/redirectionParser");

// Commands
const { isBuiltin, executeBuiltin, BUILTINS } = require("./command/builtins");
const { executeSingleCommand, executePipeline } = require("./command/executor");

// History
const { createHistoryManager } = require("./history/historyManager");

// Utils
const { findLongestCommonPrefix } = require("./utils/stringUtils");

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SHELL_PROMPT = "$ ";
const DEFAULT_HISTFILE = `${process.env.HOME}/.nu_history`;

// ─────────────────────────────────────────────
// SECTION 1: Setup
// ─────────────────────────────────────────────

// The single history manager instance shared across the shell
const historyManager = createHistoryManager();

// HISTFILE: where history gets saved/loaded.
// Falls back to ~/.nu_history if the env var isn't set.
const HISTFILE = process.env.HISTFILE || DEFAULT_HISTFILE;

// Tracks the previous line of input when the user presses tab.
// If it matches the current line, the user pressed tab twice → show all matches.
/**@type {string|null} */
let lastTabInput = null;

// ─────────────────────────────────────────────
// SECTION 2: Tab Completion
// ─────────────────────────────────────────────

/**
 * Tab completion handler for readline.
 *
 * readline calls this function whenever the user presses TAB.
 * We return [matches, substring] where:
 *   - matches  = array of possible completions
 *   - substring = the partial text we're completing
 *
 * How it works:
 * 1. Get the current partial input (what user has typed so far)
 * 2. Extract the last word — that's the part we're completing
 * 3. Search builtins + PATH executables for matches
 * 4. If exactly one match → complete it
 * 5. If multiple matches and user pressed tab twice → list them all
 * 6. If no matches → ring the bell (no output)
 *
 * @param {string} line - The current line of input
 * @returns {[string[], string]} - [completions, partial]
 */
function completer(line) {
	const partial = line.trim();

	// Only complete the command itself (first word, no arguments yet)
	if (partial.includes(" ")) {
		// User is typing arguments — don't try to complete
		return [[], line];
	}

	// Build candidates: builtins + all executables in PATH
	const candidates = [...BUILTINS];

	// Search PATH directories for executables
	const pathDirs = (process.env.PATH || "")
		.split(":")
		.filter((d) => d.length > 0);
	for (const dir of pathDirs) {
		try {
			const entries = fs.readdirSync(dir);
			for (const entry of entries) {
				const fullPath = `${dir}/${entry}`;
				try {
					const stats = fs.statSync(fullPath);
					if (stats.isFile() && stats.mode & 0o111) {
						candidates.push(entry);
					}
				} catch (_e) {
					// Skip files we can't stat (broken symlinks, permission denied, etc.)
				}
			}
		} catch (_e) {
			// Skip directories we can't read
		}
	}

	// Filter to only candidates that start with what the user typed
	const matches = candidates.filter((c) => c.startsWith(partial));

	// Deduplicate (same executable could appear in multiple PATH dirs)
	const unique = [...new Set(matches)];

	if (unique.length === 0) {
		// Nothing matches — ring the bell
		process.stdout.write("\x07");
		return [[], line];
	}

	if (unique.length === 1) {
		// Exactly one match — complete it and add a trailing space
		return [[`${unique[0]} `], partial];
	}

	// Multiple matches exist
	if (lastTabInput === line) {
		// User pressed tab twice — show all matches
		const prefix = findLongestCommonPrefix(unique);
		console.log();
		console.log(unique.join("  "));
		rl.prompt(true); // Re-print prompt without clearing the line
		return [[prefix], partial];
	}

	// First tab press — complete to the longest common prefix
	lastTabInput = line;
	const prefix = findLongestCommonPrefix(unique);
	return [[prefix], partial];
}

// ─────────────────────────────────────────────
// SECTION 3: Readline Interface
// ─────────────────────────────────────────────

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	prompt: SHELL_PROMPT,
	completer: completer,
});

// ─────────────────────────────────────────────
// SECTION 4: Command Routing
// ─────────────────────────────────────────────

/**
 * Main line handler — called every time the user presses Enter.
 *
 * Flow:
 * 1. Reset tab completion state
 * 2. Skip empty lines
 * 3. Add to history
 * 4. Handle "exit" (shell lifecycle — not in builtins)
 * 5. Tokenize the input
 * 6. If there's a pipe → route to pipeline executor
 * 7. Otherwise → parse redirection, then route to builtin or single command
 *
 * @param {string} line - The raw input line
 */
rl.on("line", (line) => {
	// Reset tab state on every new input
	lastTabInput = null;

	const trimmed = line.trim();

	// Skip empty lines — just re-prompt
	if (trimmed.length === 0) {
		rl.prompt();
		return;
	}

	// Add to history (before execution, so "history" itself shows up)
	historyManager.addCommand(trimmed);

	// "exit" is handled here, not in builtins, because it needs to
	// control the shell's lifecycle (close readline, save history, exit)
	if (trimmed === "exit") {
		handleExit();
		return;
	}

	// Tokenize the raw input into an array of strings
	const tokens = parseCommandLine(trimmed);
	if (tokens.length === 0) {
		rl.prompt();
		return;
	}

	// If there's a pipe operator anywhere, this is a pipeline
	if (tokens.includes("|")) {
		const commands = parsePipeline(tokens);
		if (commands.length === 0) {
			// parsePipeline already printed the syntax error
			rl.prompt();
			return;
		}
		executePipeline(commands, historyManager, () => {
			rl.prompt();
		});
		return;
	}

	// No pipe — single command. Check for redirection first.
	const { hasRedirection, commandTokens, redirectFile, redirectFd, isAppend } =
		parseRedirection(tokens);

	// After redirection parsing, commandTokens has the actual command
	if (commandTokens.length === 0) {
		rl.prompt();
		return;
	}

	const command = commandTokens[0];
	const args = commandTokens.slice(1);

	// Route to builtin or external command
	if (isBuiltin(command)) {
		// Builtins run in-process. Pass null for inputStream (not in a pipeline)
		// and null for outputStream (output goes to terminal).
		executeBuiltin(command, args, null, null, historyManager).then(() => {
			rl.prompt();
		});
	} else {
		// External command — spawn it with redirection info
		executeSingleCommand(
			command,
			args,
			{ hasRedirection, redirectFile, redirectFd, isAppend },
			() => {
				rl.prompt();
			},
		);
	}
});

// ─────────────────────────────────────────────
// SECTION 5: Startup & Shutdown
// ─────────────────────────────────────────────

/**
 * Saves history to HISTFILE and exits cleanly.
 * Called when user types "exit" or presses Ctrl-D.
 */
function handleExit() {
	historyManager.appendToFile(HISTFILE);
	rl.close();
	process.exit(0);
}

// Ctrl-D (EOF) — treat same as "exit"
rl.on("close", () => {
	historyManager.appendToFile(HISTFILE);
	process.exit(0);
});

// Load history from HISTFILE on startup (if the file exists)
historyManager.readFromFile(HISTFILE);

// Print the first prompt and start waiting for input
rl.prompt();
