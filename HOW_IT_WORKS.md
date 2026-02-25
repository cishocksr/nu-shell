# How Nu-Shell Works — A Plain-English Guide

If you've ever opened a terminal on your computer and typed a command like `ls` to list files, you've used a **shell**. Nu-Shell is a custom-built shell — think of it as a homemade version of the program that reads your commands, figures out what you want to do, and makes it happen.

This document explains what the project does and how its pieces fit together, without assuming you know how to code.

---

## What Is a Shell?

A shell is the middleman between you and your computer's operating system. When you type something like:

```
ls -la
```

The shell's job is to:

1. **Read** what you typed
2. **Understand** it (figure out the command name, any options, any special symbols)
3. **Run** the right program
4. **Show** you the result
5. **Wait** for your next command

Nu-Shell does all of these things. It's a loop: prompt → read → execute → prompt again. This loop is sometimes called a **REPL** (Read-Eval-Print Loop).

---

## The Big Picture

Here's a simplified view of what happens when you type a command and press Enter:

```
You type: echo hello | grep h > output.txt
                │
                ▼
        ┌──────────────┐
        │  Command      │   Breaks your text into words,
        │  Parser       │   respecting quotes and escapes.
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │  Pipeline     │   Detects the "|" and splits into
        │  Parser       │   two separate commands.
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │  Redirection  │   Detects "> output.txt" and knows
        │  Parser       │   the output should go to a file.
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │  Executor     │   Runs each command and connects
        │               │   them together.
        └──────────────┘
```

---

## Step by Step: What Each Part Does

### 1. The Prompt and Input Loop (`app/index.js`)

This is the starting point — the "front desk" of the shell. It:

- Displays the `$` prompt and waits for you to type something
- Saves every command you type into a **history** list (so you can look back at what you've done)
- Sends your input to the parsers to figure out what you meant
- Decides whether to run a built-in command or find an external program

Think of it like a receptionist: it greets you, takes your request, and routes it to the right department.

### 2. Breaking Your Input into Words (`app/parsers/commandParser.js`)

When you type `echo "hello world"`, the shell needs to understand that `hello world` is **one thing** (because of the quotes), not two separate words. This parser walks through your input character by character and:

- Splits on spaces to create separate words (called **tokens**)
- Keeps quoted text together as a single token
- Handles escape characters (like `\"` to include a literal quote mark)

**Example:**
- Input: `echo "hello world" test`
- Result: three tokens → `echo`, `hello world`, `test`

### 3. Detecting Pipes (`app/parsers/pipelineParser.js`)

The `|` symbol (called a **pipe**) lets you chain commands together. The output of one command becomes the input of the next — like a factory assembly line where each station does one job and passes the result along.

**Example:**
- Input tokens: `echo`, `hello`, `|`, `grep`, `h`
- Result: two commands → `echo hello` and `grep h`

The first command (`echo hello`) produces the text "hello". That text gets fed directly into the second command (`grep h`), which filters for lines containing the letter "h".

### 4. Detecting Redirections (`app/parsers/redirectionParser.js`)

Normally, a command's output appears on your screen. But sometimes you want to save it to a file instead. That's what the `>` symbol does.

- `>` means "send output to this file (replace the file's contents)"
- `>>` means "send output to this file (add to the end)"
- `2>` means "send error messages to this file"

**Example:**
- Input: `ls > filelist.txt`
- The parser separates this into: command = `ls`, redirect output to `filelist.txt`

### 5. Running Commands (`app/command/executor.js` and `app/command/builtins.js`)

Once the shell knows what you want, it needs to actually do it. There are two kinds of commands:

**Built-in commands** are handled directly by Nu-Shell itself, without launching any other program:

| Command   | What It Does                                      |
|-----------|---------------------------------------------------|
| `echo`    | Prints text back to you                           |
| `pwd`     | Shows which folder you're currently in            |
| `cd`      | Changes which folder you're in                    |
| `type`    | Tells you whether a command is built-in or where it lives on disk |
| `history` | Shows your past commands                          |
| `exit`    | Closes the shell                                  |

**External commands** (like `ls`, `cat`, `grep`, etc.) are separate programs installed on your computer. The shell finds them by searching through a list of folders called the **PATH** — like looking through a directory to find someone's office. Once found, the shell launches that program and waits for it to finish.

### 6. Connecting Pipes Together

When you chain commands with `|`, the executor does something clever: it connects the output of one program directly to the input of the next. Imagine a series of hoses connected end to end — water (data) flows from the first hose through each connection to the last one.

For a command like `cat file.txt | grep error | wc -l`:
1. `cat file.txt` reads the file and sends its contents into the pipe
2. `grep error` receives that text, keeps only lines containing "error", and sends those into the next pipe
3. `wc -l` receives the filtered lines and counts them

### 7. Remembering Your Commands (`app/history/historyManager.js`)

The shell keeps a list of every command you type during a session. This is useful for:

- Viewing what you've done (`history`)
- Seeing just your last few commands (`history 5`)
- Saving your history to a file so it's still there next time (`history -w`)
- Loading previous history from a file (`history -r`)

By default, when you exit the shell, your command history is saved to a file called `.nu_history` in your home folder.

### 8. Tab Completion

When you start typing a command name and press the **Tab** key, the shell tries to finish the word for you. It searches through:

- Its built-in commands (`echo`, `cd`, `pwd`, etc.)
- All programs available on your computer (everything in your PATH)

If there's exactly one match, it fills in the rest. If there are multiple possibilities and you press Tab twice, it shows you all the options.

---

## Helper Utilities

**Path Lookup** (`app/utils/pathUtils.js`) — When you type a command like `ls`, the shell doesn't magically know where the `ls` program lives on your computer. This utility searches through every folder listed in your PATH environment variable until it finds a matching program.

**Common Prefix Finder** (`app/utils/stringUtils.js`) — Used by tab completion. If you type `ec` and both `echo` and `ecryptfs` are matches, this utility figures out the longest shared beginning (`ec`) so the shell can auto-complete up to that point.

---

## How to Run It

1. Make sure you have [Node.js](https://nodejs.org/) installed on your computer
2. Download the project and open a terminal in its folder
3. Run `npm install` to set up dependencies
4. Run `npm start` to launch the shell
5. You'll see a `$` prompt — start typing commands!

To exit, type `exit` or press `Ctrl+D`.

---

## Summary

Nu-Shell is a working shell built from scratch. It reads your commands, understands quotes and special symbols, runs programs, connects commands together with pipes, redirects output to files, remembers your command history, and offers tab completion — all the essentials of a Unix shell, built as a learning project in JavaScript.
