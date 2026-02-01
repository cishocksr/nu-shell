/**
 * Processes the output for the echo command
 *
 * This handles the complex quote parsing logic that shells need.
 * It must correctly handle:
 * - Single quotes (preserve everything literally)
 * - Double quotes (allow escape sequences)
 * - Backslash escaping
 * - Space collapsing outside quotes
 *
 * Example transformations:
 * echo hello world          → "hello world"
 * echo "hello  world"       → "hello  world" (preserves spaces)
 * echo 'hello  world'       → "hello  world" (preserves spaces)
 * echo "say \"hi\""         → "say "hi""
 *
 * @param {string} input - The full command line input
 * @returns {string} - The processed output (without trailing newline)
 */
function processEchoOutput(input) {
  // Step 1: Find where "echo" starts in the input
  const echoPos = input.indexOf("echo");
  if (echoPos === -1) return "";

  // Step 2: Get everything after "echo"
  // "echo hello" → "hello"
  const remaining = input.substring(echoPos + 4).trim();
  if (remaining.length === 0) return "";

  // Step 3: Set up our state machine
  let output = ""; // The final output we're building
  let inSingleQuotes = false; // Are we inside 'single quotes'?
  let inDoubleQuotes = false; // Are we inside "double quotes"?
  let i = 0; // Current position in the string
  let inWhitespace = false; // Are we in a run of spaces?

  // Step 4: Process character by character
  while (i < remaining.length) {
    const char = remaining[i];

    // HANDLE BACKSLASH ESCAPING IN DOUBLE QUOTES
    // Inside "double quotes", backslash only escapes: " and \
    // Example: echo "say \"hi\"" → say "hi"
    // Example: echo "path\\to\\file" → path\to\file
    if (char === "\\" && inDoubleQuotes && !inSingleQuotes) {
      if (i + 1 < remaining.length) {
        const nextChar = remaining[i + 1];

        if (nextChar === '"') {
          // \" becomes just "
          output += '"';
          inWhitespace = false;
          i += 2; // Skip both \ and "
          continue;
        } else if (nextChar === "\\") {
          // \\ becomes just \
          output += "\\";
          inWhitespace = false;
          i += 2; // Skip both backslashes
          continue;
        } else {
          // \x becomes \x (backslash is literal for other chars)
          output += "\\";
          output += nextChar;
          inWhitespace = false;
          i += 2;
          continue;
        }
      } else {
        // Backslash at end of string
        output += char;
        inWhitespace = false;
        i++;
        continue;
      }
    }

    // HANDLE BACKSLASH ESCAPING OUTSIDE QUOTES
    // Outside quotes, backslash escapes ANY character
    // Example: echo hello\ world → hello world
    // Example: echo \$HOME → $HOME (literal dollar sign)
    if (char === "\\" && !inSingleQuotes && !inDoubleQuotes) {
      if (i + 1 < remaining.length) {
        // Add the next character literally (whatever it is)
        output += remaining[i + 1];
        inWhitespace = false;
        i += 2; // Skip both \ and the escaped char
        continue;
      } else {
        // Backslash at end - just add it
        output += char;
        inWhitespace = false;
        i++;
        continue;
      }
    }

    // HANDLE SINGLE QUOTES
    // Single quotes preserve EVERYTHING literally (no escaping)
    // Example: echo 'hello\nworld' → hello\nworld (not a newline!)
    if (char === "'") {
      if (!inDoubleQuotes) {
        // We're not in double quotes, so this single quote matters

        if (inSingleQuotes) {
          // We're closing single quotes

          // Check for empty quotes: ''
          if (i + 1 < remaining.length && remaining[i + 1] === "'") {
            i += 2; // Skip both quotes
            continue;
          }

          // Normal close
          inSingleQuotes = false;
          i++;

          // Check if immediately followed by another single quote (re-opening)
          if (i < remaining.length && remaining[i] === "'") {
            inSingleQuotes = true;
            i++;
            continue;
          }
          continue;
        } else {
          // We're opening single quotes

          // Check for empty quotes: ''
          if (i + 1 < remaining.length && remaining[i + 1] === "'") {
            i += 2; // Skip both quotes
            continue;
          }

          inSingleQuotes = true;
          i++;
          continue;
        }
      }
    }

    // HANDLE DOUBLE QUOTES
    // Similar logic to single quotes, but escaping is allowed inside
    if (char === '"') {
      if (!inSingleQuotes) {
        if (inDoubleQuotes) {
          // Closing double quotes
          if (i + 1 < remaining.length && remaining[i + 1] === '"') {
            i += 2; // Empty quotes: ""
            continue;
          }

          inDoubleQuotes = false;
          i++;

          if (i < remaining.length && remaining[i] === '"') {
            inDoubleQuotes = true;
            i++;
            continue;
          }
          continue;
        } else {
          // Opening double quotes
          if (i + 1 < remaining.length && remaining[i + 1] === '"') {
            i += 2; // Empty quotes: ""
            continue;
          }

          inDoubleQuotes = true;
          i++;
          continue;
        }
      }
    }

    // PROCESS NORMAL CHARACTERS
    if (inSingleQuotes || inDoubleQuotes) {
      // Inside quotes: add everything literally
      output += char;
      inWhitespace = false;
      i++;
    } else {
      // Outside quotes: collapse multiple spaces into one
      if (char === " " || char === "\t") {
        if (!inWhitespace) {
          output += " "; // Add single space
          inWhitespace = true;
        }
        i++;
      } else {
        // Regular character
        output += char;
        inWhitespace = false;
        i++;
      }
    }
  } // End of while loop

  return output; // Return after processing ALL characters
}

module.exports = { processEchoOutput };
