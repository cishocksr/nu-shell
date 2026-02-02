const fs = require("fs");
const pathModule = require("path");

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
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const stats = fs.statSync(fullPath);

        if (stats.mode & 0o111) {
          return fullPath;
        }
      }
    } catch (e) {
      // Intentionally ignore errors (permission denied, broken symlinks, etc.)
      // We want to continue checking other PATH directories
      // No action needed - just skip to next directory
    }
  }
  return null;
}

module.exports = { findCommandInPath };
