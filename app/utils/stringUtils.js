/**
 * Finds the longest comon prefix among an array of strings
 *
 * Used for tab completion: when you type "ec" and both "echo" and "ecryptfs" match. we auto-complete to "ec" (the longest common part).
 *
 * How it Works:
 * 1. Start with the first string as our candidate prefix
 * 2. For each other string, keep shrinking the prefix until that string starts with our prefix
 * 3. Return whatever prefix survived all comparisons
 *
 * Examples:
 * ["echo", "ecryptfs"] -> "ec"
 * ["hello", "help", "helmet"] -> "hel"
 * ["cat", "dog"] -> "" (no common prefix)
 *
 * @param {string[]} string - Array of strings to compare
 * @returns {string} - The longest common prefix
 */

function findLongestCommonPrefix(string) {
  // Edge cases first
  if (string.length === 0) return "";
  if (string.length === 1) return string[0];

  // Start with the entire first string as our candidate
  let prefix = string[0];

  // Compare with each subsequent string
  for (let i = 1; i < string.length; i++) {
    // Keep shrinking prefix until this string starts with it
    // indexOf checks if prefix appears at the START (position 0)
    while (string[i].indexOf(prefix) !== 0) {
      // Remove last character from prefix
      prefix = prefix.substring(0, prefix.length - 1);

      // If we've removed everything, there's no common prefix
      if (prefix === "") return "";
    }
  }

  return prefix;
}

module.exports = { findLongestCommonPrefix };
