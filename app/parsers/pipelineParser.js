/**
 * Parses a token array into pipeline commands
 *
 * Takes an array of tokens and splits them into separate commands
 * wherever a pipe (|) appears. Each command becomes its own array.
 *
 * How it works:
 * 1. Walk through tokens one by one
 * 2. Collect tokens into currentCommand
 * 3. When we hit "|", save currentCommand and start a new one
 * 4. At the end, save the last command
 *
 * Examples:
 * ["echo", "hello"] → [["echo", "hello"]]
 * ["echo", "hello", "|", "grep", "h"] → [["echo", "hello"], ["grep", "h"]]
 * ["cat", "f.txt", "|", "grep", "x", "|", "wc"] → [["cat", "f.txt"], ["grep", "x"], ["wc"]]
 *
 * @param {string[]} tokens - Array of tokens from parseCommandLine
 * @returns {string[][]} - Array of command arrays
 */
function parsePipeline(tokens) {
	const commands = []; // Array of commands (each command is an array)
	let currentCommand = []; // The command we're currently building

	// Walk through each token
	for (const token of tokens) {
		if (token === "|") {
			// Found a pipe! Save current command and start new one
			if (currentCommand.length === 0) {
				console.log("syntax error near unexpected token '|'");
				return [];
			}
			commands.push(currentCommand);
			currentCommand = [];
		} else {
			// Regular token - add to current command
			currentCommand.push(token);
		}
	}

	//   Check if there's a command after the last pipe
	if (currentCommand.length === 0 && commands.length > 0) {
		// We had a pipe but nothing after it
		console.log("syntax error near unexpected token '|'");
		return [];
	}

	// Don't forget the last command!
	if (currentCommand.length > 0) {
		commands.push(currentCommand);
	}

	return commands;
}

module.exports = {
	parsePipeline,
};
