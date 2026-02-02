const fs = require("node:fs");
const pathModule = require("node:path");

/**
 * Finds a command in the system PATH environment variable
 *
 * Thin of PATH like a phone book of program locations.
 * When you type "ls", this function searches through PATH
 * to find where the actual "ls" program is started.
 *
 * @param {string} commandName - Name of the command to find (e.g. "ls", "cat", "echo")
 * @returns {string|null} - Full path to the command or null if not found
 */

function findCommandInPath(commandName) {
	const path = process.env.PATH || "";

	const pathDirs = path.split(":").filter((dir) => dir.length > 0);

	for (const dir of pathDirs) {
		const fullPath = pathModule.join(dir, commandName);

		try {
			if (fs.existsSync(fullPath)) {
				const stats = fs.statSync(fullPath);

				if (stats.isFile() && stats.mode & 0o111) {
					return fullPath;
				}
			}
		} catch (_e) {
			// Skip files we can't access: permission denied, broken symlinks, etc.
			// Continue checking remaining PATH directories
		}
	}
	return null;
}

module.exports = { findCommandInPath };
