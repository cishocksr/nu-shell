/**
 * Parses a command line input into tokens
 *
 * This is the core parsing function that handles:
 * - Splitting on spaces (but not inside quotes)
 * - Removing quotes (but keeping their contents)
 * - Handling escape sequences with backslashes
 *
 * Examples:
 * "echo hello world" → ["echo", "hello", "world"]
 * "echo 'hello world'" → ["echo", "hello world"]
 * "echo hello | grep h" → ["echo", "hello", "|", "grep", "h"]
 * "echo \"hi\"" → ["echo", "hi"]
 *
 * @param {string} input - The raw command line input
 * @returns {string[]} - Array of tokens
 */
function parseCommandLine(input) {
	const tokens = [];
	let currentToken = "";
	let inSingleQuotes = false;
	let inDoubleQuotes = false;
	let i = 0;

	while (i < input.length) {
		const char = input[i];

		// SECTION 1: Handle backslash escaping within double quotes
		if (char === "\\" && inDoubleQuotes && !inSingleQuotes) {
			if (i + 1 < input.length) {
				const nextChar = input[i + 1];
				if (nextChar === '"') {
					currentToken += '"';
					i += 2;
					continue;
				} else if (nextChar === "\\") {
					currentToken += "\\";
					i += 2;
					continue;
				} else {
					currentToken += "\\";
					currentToken += nextChar;
					i += 2;
					continue;
				}
			} else {
				currentToken += char;
				i++;
				continue;
			}
		}

		// SECTION 2: Handle backslash escaping outside quotes
		if (char === "\\" && !inSingleQuotes && !inDoubleQuotes) {
			if (i + 1 < input.length) {
				currentToken += input[i + 1];
				i += 2;
				continue;
			} else {
				currentToken += char;
				i++;
				continue;
			}
		}

		// SECTION 3: Handle single quotes
		if (char === "'") {
			if (!inDoubleQuotes) {
				if (inSingleQuotes) {
					if (i + 1 < input.length && input[i + 1] === "'") {
						i += 2;
						continue;
					}
					inSingleQuotes = false;
					i++;
					if (i < input.length && input[i] === "'") {
						inSingleQuotes = true;
						i++;
						continue;
					}
					continue;
				} else {
					if (i + 1 < input.length && input[i + 1] === "'") {
						i += 2;
						continue;
					}
					inSingleQuotes = true;
					i++;
					continue;
				}
			}
		}

		// SECTION 4: Handle double quotes
		if (char === '"') {
			if (!inSingleQuotes) {
				if (inDoubleQuotes) {
					if (i + 1 < input.length && input[i + 1] === '"') {
						i += 2;
						continue;
					}
					inDoubleQuotes = false;
					i++;
					if (i < input.length && input[i] === '"') {
						inDoubleQuotes = true;
						i++;
						continue;
					}
					continue;
				} else {
					if (i + 1 < input.length && input[i + 1] === '"') {
						i += 2;
						continue;
					}
					inDoubleQuotes = true;
					i++;
					continue;
				}
			}
		}

		// SECTION 5: Process characters - build tokens or separate on spaces
		if (inSingleQuotes || inDoubleQuotes) {
			// Inside quotes: add character to current token
			currentToken += char;
			i++;
		} else {
			// Outside quotes: check if it's a space
			if (char === " " || char === "\t") {
				// Found a space - finish the current token
				if (currentToken.length > 0) {
					tokens.push(currentToken);
					currentToken = "";
				}
				// Skip all consecutive whitespace
				while (i < input.length && (input[i] === " " || input[i] === "\t")) {
					i++;
				}
			} else {
				// Regular character - add to current token
				currentToken += char;
				i++;
			}
		}
	}

	// Add the last token if one exists
	if (currentToken.length > 0) {
		tokens.push(currentToken);
	}

	return tokens;
}

module.exports = { parseCommandLine };
