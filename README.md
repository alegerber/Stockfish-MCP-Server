# Stockfish MCP Server

A Model Context Protocol (MCP) server that wraps the Stockfish chess engine, providing AI assistants with professional-grade chess analysis capabilities.

## Features

| Tool | Description |
|------|-------------|
| `sf_analyse_position` | Analyse any position (FEN → evaluation + best moves + top lines) |
| `sf_analyse_game` | Full game analysis (PGN → move-by-move eval, accuracy %, error counts) |
| `sf_lookup_opening` | Search opening database by name or ECO code |
| `sf_identify_opening` | Identify the opening from moves or PGN |
| `sf_generate_puzzle` | Generate tactic puzzles from positions |

## Quick Start

### Option 1: Docker (recommended)

```bash
# Build and run
docker build -t stockfish-mcp-server .
docker run -i stockfish-mcp-server

# Or with docker compose
docker compose up --build
```

### Option 2: Local Node.js

Prerequisites: Node.js 22+, Stockfish binary installed.

```bash
# Install Stockfish
# macOS:  brew install stockfish
# Ubuntu: sudo apt install stockfish
# Windows: download from https://stockfishchess.org/download/

# Install dependencies and build
npm install
npm run build

# Run
npm start
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `STOCKFISH_PATH` | `stockfish` | Path to the Stockfish binary |
| `STOCKFISH_THREADS` | `2` | Number of CPU threads for search |
| `STOCKFISH_HASH` | `128` | Hash table size in MB |

## Claude Desktop Integration

Add to your `claude_desktop_config.json`:

### Docker

```json
{
  "mcpServers": {
    "stockfish": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "stockfish-mcp-server"]
    }
  }
}
```

### Local Node.js

```json
{
  "mcpServers": {
    "stockfish": {
      "command": "node",
      "args": ["/path/to/stockfish-mcp-server/dist/index.js"],
      "env": {
        "STOCKFISH_PATH": "stockfish",
        "STOCKFISH_THREADS": "2",
        "STOCKFISH_HASH": "256"
      }
    }
  }
}
```

## Usage Examples

### Analyse a position
> "Analyse this position: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"

### Analyse a full game
> "Review this game: 1. e4 e5 2. Qh5 Nc6 3. Nf3 g6 4. Qh4 Be7 ..."

### Look up an opening
> "What is the Wayward Queen Attack?"

### Identify an opening
> "What opening is 1. e4 e5 2. Nf3 Nc6 3. Bc4?"

### Generate a puzzle
> "Create a tactic puzzle from this position: [FEN]"

## Architecture

```
src/
├── index.ts              # MCP server entry point, tool registration
├── types.ts              # TypeScript type definitions
├── constants.ts          # Shared constants and thresholds
├── schemas/
│   └── index.ts          # Zod input validation schemas
├── services/
│   ├── engine.ts         # Stockfish UCI process wrapper
│   ├── chess-utils.ts    # chess.js wrapper (PGN/FEN/SAN/openings)
│   └── formatting.ts     # Markdown/text output formatting
└── tools/
    ├── analyse-position.ts  # Single position analysis
    ├── analyse-game.ts      # Full game analysis
    ├── openings.ts          # Opening lookup & identification
    └── puzzle.ts            # Tactic puzzle generation
```

## License

MIT
