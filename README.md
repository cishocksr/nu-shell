# Nu-Shell

A Unix shell implementation built from scratch in Node.js as a learning project. Features comprehensive command parsing, pipelines, output redirection, tab completion, and persistent command history.

## Features

- **Built-in Commands**: `echo`, `exit`, `type`, `pwd`, `cd`, `history`
- **External Commands**: Execute any program in your PATH
- **Quote Handling**: Proper parsing of single and double quotes with escape sequences
- **Pipelines**: Chain commands with `|` operator
- **Output Redirection**: Support for `>`, `>>`, `2>`, `2>>` operators
- **Tab Completion**: Auto-complete commands from builtins and PATH executables
- **Command History**: Persistent history with file I/O (`history`, `history -r`, `history -w`, `history -a`)

## Installation

```bash
git clone https://github.com/yourusername/nu-shell.git
cd nu-shell
npm install
```

## Usage

### Run the shell

```bash
chmod +x nu.sh
./nu.sh
```

Or using npm:

```bash
npm start
```

### Development mode (auto-restart on changes)

```bash
npm run dev
```

## Project Structure

```
nu-shell/
├── app/
│   ├── index.js                # REPL entry point
│   ├── command/
│   │   ├── builtins.js         # Built-in commands (echo, cd, pwd, etc)
│   │   └── executor.js         # Pipeline & single command execution
│   ├── parsers/
│   │   ├── commandParser.js    # Tokenization with quote handling
│   │   ├── pipelineParser.js   # Splits on pipe (|) operators
│   │   └── redirectionParser.js # Finds > >> 2> etc
│   ├── history/
│   │   └── historyManager.js   # History storage & persistence
│   └── utils/
│       ├── pathUtils.js        # Find commands in PATH
│       └── stringUtils.js      # Common prefix (tab completion)
├── nu.sh                        # Shell launcher script
└── package.json
```

## Examples

```bash
$ echo "hello world"
hello world

$ echo hello | grep h
hello

$ ls -la > output.txt

$ cat file.txt 2> errors.txt

$ history 5

$ cd ~/Documents

$ type echo
echo is a shell builtin

$ type ls
ls is /bin/ls
```

## Environment Variables

- `HISTFILE`: Path to history file (default: `~/.nu_history`)
- `PATH`: Colon-separated list of directories to search for executables

## License

MIT

## Author

Christopher Shockley
