const fs = require("fs");

/**
 * Creates a HistoryManager instance.
 *
 * The history manager owns the in-memory history array and provides
 * all operations the rest of the shell needs:
 * - addCommand   → push a new entry (called by the REPL loop)
 * - getHistory   → return a copy of the array (used by "history" display)
 * - readFromFile → load entries from a file into memory ("history -r")
 * - writeToFile  → overwrite a file with all entries ("history -w")
 * - appendToFile → append only new entries since last save ("history -a")
 *
 * The "lastSavedIndex" tracker is what makes appendToFile work:
 * it remembers where we left off last time so we only write the new stuff.
 *
 * @returns {{
 *   addCommand: function(string): void,
 *   getHistory: function(): string[],
 *   readFromFile: function(string): {success: boolean},
 *   writeToFile: function(string): {success: boolean},
 *   appendToFile: function(string): {success: boolean}
 * }} - The history manager instance
 */
function createHistoryManager() {
  /** @type {string[]} */
  const history = [];

  // Tracks how many entries have already been saved to disk.
  // appendToFile uses this to know where to start writing from.
  let lastSavedIndex = 0;

  /**
   * Adds a command to the in-memory history.
   * Called by the REPL loop after each command is entered.
   *
   * @param {string} command - The command string to add
   */
  function addCommand(command) {
    history.push(command);
  }

  /**
   * Returns a copy of the full history array.
   * We return a copy so the caller can't accidentally mutate our internal state.
   *
   * @returns {string[]} - Copy of the history array
   */
  function getHistory() {
    return [...history];
  }

  /**
   * Reads history entries from a file into memory.
   * Each line in the file becomes one history entry.
   * Replaces the current in-memory history entirely.
   *
   * @param {string} filePath - Path to the history file
   * @returns {{success: boolean}} - Whether the read succeeded
   */
  function readFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");

      // Clear current history before loading
      history.length = 0;

      // Split on newlines, filter out empty lines
      const lines = content.split("\n").filter((line) => line.length > 0);
      for (const line of lines) {
        history.push(line);
      }

      // After reading, mark everything as "saved" so appendToFile
      // won't re-write what we just loaded
      lastSavedIndex = history.length;

      return { success: true };
    } catch (err) {
      return { success: false };
    }
  }

  /**
   * Writes all history entries to a file, overwriting its contents.
   * One entry per line.
   *
   * @param {string} filePath - Path to the history file
   * @returns {{success: boolean}} - Whether the write succeeded
   */
  function writeToFile(filePath) {
    try {
      const content = history.join("\n") + (history.length > 0 ? "\n" : "");
      fs.writeFileSync(filePath, content, "utf8");

      // Everything is now saved
      lastSavedIndex = history.length;

      return { success: true };
    } catch (err) {
      return { success: false };
    }
  }

  /**
   * Appends only new history entries (since the last save) to a file.
   * This is the efficient way to persist history during normal use —
   * we don't rewrite the whole file every time, just tack on the new stuff.
   *
   * Example:
   *   history = ["ls", "pwd", "echo hi", "cd ..", "cat file"]
   *   lastSavedIndex = 3  (we already saved "ls", "pwd", "echo hi")
   *   → appends only "cd .." and "cat file"
   *
   * @param {string} filePath - Path to the history file
   * @returns {{success: boolean}} - Whether the append succeeded
   */
  function appendToFile(filePath) {
    try {
      // Nothing new to write
      if (lastSavedIndex >= history.length) {
        return { success: true };
      }

      // Grab only the entries we haven't saved yet
      const newEntries = history.slice(lastSavedIndex);
      const content = newEntries.join("\n") + "\n";

      fs.appendFileSync(filePath, content, "utf8");

      // Mark everything as saved now
      lastSavedIndex = history.length;

      return { success: true };
    } catch (err) {
      return { success: false };
    }
  }

  return {
    addCommand,
    getHistory,
    readFromFile,
    writeToFile,
    appendToFile,
  };
}

module.exports = { createHistoryManager };
