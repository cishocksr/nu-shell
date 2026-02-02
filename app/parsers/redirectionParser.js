/**
 * Parses redirection operators from a token array
 *
 * Finds redirection operators (>, >>, 1>, 2>, etc.) and separates
 * them from the actual command tokens.
 *
 * Supported forms:
 * >  file   → stdout overwrite
 * >> file   → stdout append
 * 1> file   → stdout overwrite (explicit)
 * 1>> file  → stdout append (explicit)
 * 2> file   → stderr overwrite
 * 2>> file  → stderr append
 * 1 > file  → stdout overwrite (fd as separate token)
 * 2 >> file → stderr append (fd as separate token)
 *
 * @param {string[]} tokens - Array of tokens from parseCommandLine
 * @returns {{
 *   hasRedirection: boolean,
 *   commandTokens: string[],
 *   redirectFile: string|null,
 *   redirectFd: number,
 *   isAppend: boolean
 * }} - Parsed redirection info
 */
function parseRedirection(tokens) {
	// These track what we find as we scan through tokens
	let redirectIndex = -1; // Position where redirection starts
	let redirectFile = null; // The file we're redirecting to
	let redirectFd = 1; // File descriptor (1=stdout, 2=stderr)
	let isAppend = false; // Is this >> (append) or > (overwrite)?

	// Scan through tokens looking for redirection operators
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];

		// CASE 1: Simple ">" (stdout overwrite)
		// Example: ["echo", "hi", ">", "file.txt"]
		if (token === ">") {
			redirectIndex = i;
			redirectFd = 1;
			isAppend = false;
			redirectFile = i + 1 < tokens.length ? tokens[i + 1] : null;
			break;
		}

		// CASE 2: Simple ">>" (stdout append)
		// Example: ["echo", "hi", ">>", "file.txt"]
		if (token === ">>") {
			redirectIndex = i;
			redirectFd = 1;
			isAppend = true;
			redirectFile = i + 1 < tokens.length ? tokens[i + 1] : null;
			break;
		}

		// CASE 3: "1>" (explicit stdout overwrite)
		// Example: ["echo", "hi", "1>", "file.txt"]
		if (token === "1>") {
			redirectIndex = i;
			redirectFd = 1;
			isAppend = false;
			redirectFile = i + 1 < tokens.length ? tokens[i + 1] : null;
			break;
		}

		// CASE 4: "1>>" (explicit stdout append)
		// Example: ["echo", "hi", "1>>", "file.txt"]
		if (token === "1>>") {
			redirectIndex = i;
			redirectFd = 1;
			isAppend = true;
			redirectFile = i + 1 < tokens.length ? tokens[i + 1] : null;
			break;
		}

		// CASE 5: "2>" (stderr overwrite)
		// Example: ["ls", "2>", "errors.txt"]
		if (token === "2>") {
			redirectIndex = i;
			redirectFd = 2;
			isAppend = false;
			redirectFile = i + 1 < tokens.length ? tokens[i + 1] : null;
			break;
		}

		// CASE 6: "2>>" (stderr append)
		// Example: ["ls", "2>>", "errors.txt"]
		if (token === "2>>") {
			redirectIndex = i;
			redirectFd = 2;
			isAppend = true;
			redirectFile = i + 1 < tokens.length ? tokens[i + 1] : null;
			break;
		}

		// CASE 7: "1" followed by ">" (fd as separate token, stdout overwrite)
		// Example: ["echo", "hi", "1", ">", "file.txt"]
		if (token === "1" && i + 1 < tokens.length && tokens[i + 1] === ">") {
			redirectIndex = i;
			redirectFd = 1;
			isAppend = false;
			redirectFile = i + 2 < tokens.length ? tokens[i + 2] : null;
			break;
		}

		// CASE 8: "1" followed by ">>" (fd as separate token, stdout append)
		// Example: ["echo", "hi", "1", ">>", "file.txt"]
		if (token === "1" && i + 1 < tokens.length && tokens[i + 1] === ">>") {
			redirectIndex = i;
			redirectFd = 1;
			isAppend = true;
			redirectFile = i + 2 < tokens.length ? tokens[i + 2] : null;
			break;
		}

		// CASE 9: "2" followed by ">" (fd as separate token, stderr overwrite)
		// Example: ["ls", "2", ">", "errors.txt"]
		if (token === "2" && i + 1 < tokens.length && tokens[i + 1] === ">") {
			redirectIndex = i;
			redirectFd = 2;
			isAppend = false;
			redirectFile = i + 2 < tokens.length ? tokens[i + 2] : null;
			break;
		}

		// CASE 10: "2" followed by ">>" (fd as separate token, stderr append)
		// Example: ["ls", "2", ">>", "errors.txt"]
		if (token === "2" && i + 1 < tokens.length && tokens[i + 1] === ">>") {
			redirectIndex = i;
			redirectFd = 2;
			isAppend = true;
			redirectFile = i + 2 < tokens.length ? tokens[i + 2] : null;
			break;
		}
	}

	// If we didn't find any redirection, return tokens unchanged
	if (redirectIndex === -1) {
		return {
			hasRedirection: false,
			commandTokens: tokens,
			redirectFile: null,
			redirectFd: 1,
			isAppend: false,
		};
	}

	// Extract just the command tokens (everything BEFORE the redirection)
	// Example: ["echo", "hi", ">", "file.txt"] → ["echo", "hi"]
	const commandTokens = tokens.slice(0, redirectIndex);

	return {
		hasRedirection: true,
		commandTokens: commandTokens,
		redirectFile: redirectFile,
		redirectFd: redirectFd,
		isAppend: isAppend,
	};
}

module.exports = { parseRedirection };
