# AGENTS.md — Stockfish MCP Server

## Project Overview

MCP server wrapping the Stockfish chess engine. Provides 5 tools for chess analysis over the Model Context Protocol stdio transport. Written in TypeScript (strict mode), runs on Node.js 22+, deployed via Docker.

## Architecture

```
src/
├── index.ts              # Entry point: MCP server setup, tool registration, lifecycle
├── types.ts              # All TypeScript interfaces and type aliases
├── constants.ts          # Thresholds, defaults, starting FEN
├── schemas/
│   └── index.ts          # Zod input schemas for all 5 tools
├── services/
│   ├── engine.ts         # Stockfish UCI process wrapper (spawn, send, parse)
│   ├── chess-utils.ts    # chess.js utilities: PGN parsing, FEN validation, opening book
│   └── formatting.ts     # Markdown formatting for analysis output
└── tools/
    ├── analyse-position.ts  # sf_analyse_position — single FEN analysis
    ├── analyse-game.ts      # sf_analyse_game — full PGN move-by-move analysis
    ├── openings.ts          # sf_lookup_opening, sf_identify_opening
    └── puzzle.ts            # sf_generate_puzzle — tactic puzzle generation
```

### Key design decisions

- **Engine as long-lived process**: `StockfishEngine` spawns one Stockfish child process and reuses it across all tool calls. Commands are sent via UCI protocol over stdin/stdout of the child process.
- **Dual output**: Every tool returns both `content` (Markdown text for display) and `structuredContent` (JSON for programmatic use).
- **Eval perspective**: Stockfish always reports scores from the side-to-move's perspective. Code that compares evals across moves must negate when the side-to-move changes. This is the most bug-prone area.
- **Win-probability accuracy model**: Game analysis uses the Lichess win-probability formula (`1 / (1 + exp(-0.00368208 * cp))`) to compute per-move accuracy, not raw centipawn differences.
- **Terminal positions**: Checkmate/stalemate/draw positions are detected before engine analysis to avoid garbage evals.

## Build & Run

```bash
# Build TypeScript
npm run build          # tsc → ./dist/

# Run locally (requires stockfish on PATH)
npm start

# Docker (recommended)
docker compose up --build
docker run -i --rm stockfish-mcp-server
```

## Module System

ESM throughout. All local imports use `.js` extensions (e.g., `'./services/engine.js'`). TypeScript compiles to `./dist/` with `"module": "Node16"`.

## Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `STOCKFISH_PATH` | `stockfish` | Full path in Docker: `/usr/games/stockfish` |
| `STOCKFISH_THREADS` | `2` | UCI Threads option |
| `STOCKFISH_HASH` | `128` | UCI Hash option (MB) |

## Common Pitfalls

1. **Eval normalisation**: Stockfish scores are always from the side-to-move's perspective. When computing eval drop between positions, the score after a move is from the opponent's POV and must be negated. Failing to do this produces inverted accuracy and wrong move classifications.

2. **PV move validation**: The engine's principal variation can contain moves that `chess.js` rejects (edge cases at low depth or in unusual positions). Always validate each UCI move through `chess.js` before adding to SAN arrays, and break on the first failure.

3. **Dynamic imports**: Do not use `await import('chess.js')` inside loops. Use static imports at module top.

4. **Docker binary path**: The Debian `stockfish` package installs to `/usr/games/stockfish`, which is not on the default PATH in `node:22-slim`. `STOCKFISH_PATH` must be the absolute path.

5. **Terminal positions**: The engine cannot meaningfully analyse checkmate/stalemate positions. Detect these with `chess.js` before calling `engine.analyse()`.

## Testing

No test framework is configured. To verify tools work end-to-end, send JSON-RPC messages to the Docker container over stdin:

```bash
docker run -i --rm stockfish-mcp-server <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sf_analyse_position","arguments":{"fen":"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1","depth":10,"multiPv":2}}}
EOF
```

Diagnostic output goes to stderr. JSON-RPC responses go to stdout.

## Dependencies

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server framework, stdio transport |
| `chess.js` | PGN parsing, FEN validation, move generation, SAN conversion |
| `zod` | Input schema validation for all tools |
| `typescript` | Build-time compiler |

## Code Style

- TypeScript strict mode, no linter or formatter configured
- Explicit return types on exported functions
- `console.error()` for all logging (stdout is reserved for MCP JSON-RPC)
