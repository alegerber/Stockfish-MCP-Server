// Main entry point – Stockfish MCP Server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StockfishEngine } from './services/engine.js';
import {
  AnalysePositionSchema,
  AnalyseGameSchema,
  LookupOpeningSchema,
  IdentifyOpeningSchema,
  GeneratePuzzleSchema,
} from './schemas/index.js';
import { analysePosition } from './tools/analyse-position.js';
import { analyseGame } from './tools/analyse-game.js';
import { lookupOpeningByQuery, identifyOpeningFromPgn } from './tools/openings.js';
import { generatePuzzle } from './tools/puzzle.js';

// Resolve engine binary path from env or default
const SF_PATH = process.env.STOCKFISH_PATH ?? 'stockfish';
const SF_THREADS = parseInt(process.env.STOCKFISH_THREADS ?? '2', 10);
const SF_HASH = parseInt(process.env.STOCKFISH_HASH ?? '128', 10);

const engine = new StockfishEngine(SF_PATH, SF_THREADS, SF_HASH);

const server = new McpServer({
  name: 'stockfish-mcp-server',
  version: '1.0.0',
});

// ── Tool 1: Analyse Position ──────────────────────────────────────────────

server.registerTool(
  'sf_analyse_position',
  {
    title: 'Analyse Chess Position',
    description: `Analyse a chess position using Stockfish engine.

Takes a FEN string and returns the evaluation, best move, and top
principal variations with scores. Use this for single-position analysis.

Args:
  - fen (string): FEN of the position
  - depth (number): Search depth 1–30 (default 20)
  - multiPv (number): Number of lines 1–5 (default 3)

Returns:
  Evaluation (cp or mate), best move in UCI+SAN, top lines with scores.

Examples:
  - "Analyse this position: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
  - "What is the best move for black in FEN ...?"`,
    inputSchema: AnalysePositionSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ fen, depth, multiPv }) => {
    try {
      const result = await analysePosition(engine, fen, depth, multiPv);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.json,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: 'text', text: `Error: ${msg}` }] };
    }
  }
);

// ── Tool 2: Analyse Game ──────────────────────────────────────────────────

server.registerTool(
  'sf_analyse_game',
  {
    title: 'Analyse Full Chess Game',
    description: `Analyse an entire chess game move by move using Stockfish.

Takes a PGN and returns per-move evaluations, accuracy scores, error
counts (blunders/mistakes/inaccuracies), and the detected opening.

This is computationally expensive – depth 18 recommended for reasonable
speed; depth 12 for fast overviews.

Args:
  - pgn (string): Complete PGN of the game
  - depth (number): Search depth per move 1–30 (default 18)

Returns:
  Opening name, accuracy %, error summary table, move-by-move analysis
  with classification (best/great/excellent/good/inaccuracy/mistake/blunder).

Examples:
  - "Analyse this game: 1. e4 e5 2. Nf3 Nc6 ..."
  - "Review my chess.com game [PGN]"`,
    inputSchema: AnalyseGameSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ pgn, depth }) => {
    try {
      const result = await analyseGame(engine, pgn, depth);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.json,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: 'text', text: `Error: ${msg}` }] };
    }
  }
);

// ── Tool 3: Lookup Opening ────────────────────────────────────────────────

server.registerTool(
  'sf_lookup_opening',
  {
    title: 'Lookup Chess Opening',
    description: `Search the opening database by name or ECO code.

Returns matching openings with ECO code, name, book moves, and FEN.

Args:
  - query (string): Name fragment or ECO code (e.g. "Sicilian", "B20", "Italian")

Returns:
  List of matching openings with ECO, name, PGN, and FEN.

Examples:
  - "Look up the Italian Game"
  - "What openings start with B2?"`,
    inputSchema: LookupOpeningSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ query }) => {
    const result = lookupOpeningByQuery(query);
    return {
      content: [{ type: 'text', text: result.text }],
      structuredContent: result.json,
    };
  }
);

// ── Tool 4: Identify Opening ──────────────────────────────────────────────

server.registerTool(
  'sf_identify_opening',
  {
    title: 'Identify Chess Opening',
    description: `Identify the opening from a sequence of moves or a PGN.

Matches the move sequence against the opening book and returns the
most specific matching opening.

Args:
  - pgn (string): PGN or bare SAN moves (e.g. "1. e4 e5 2. Nf3 Nc6")

Returns:
  ECO code, opening name, and book line if identified.

Examples:
  - "What opening is 1. e4 e5 2. Qh5?"
  - "Identify the opening from this PGN: ..."`,
    inputSchema: IdentifyOpeningSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ pgn }) => {
    const result = identifyOpeningFromPgn(pgn);
    return {
      content: [{ type: 'text', text: result.text }],
      structuredContent: result.json,
    };
  }
);

// ── Tool 5: Generate Puzzle ───────────────────────────────────────────────

server.registerTool(
  'sf_generate_puzzle',
  {
    title: 'Generate Tactic Puzzle',
    description: `Generate a tactic puzzle from a given position.

Analyses the position to find the best tactical sequence and presents
it as a puzzle with theme detection, difficulty rating, and solution.

Args:
  - fen (string): FEN of the position
  - depth (number): Analysis depth 1–30 (default 22)

Returns:
  Puzzle FEN, theme (e.g. "Mate in 3", "Fork", "Pin"), difficulty,
  solution in UCI and SAN, and an explanation.

Examples:
  - "Make a puzzle from this position: [FEN]"
  - "Find tactics in this position: ..."`,
    inputSchema: GeneratePuzzleSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ fen, depth }) => {
    try {
      const result = await generatePuzzle(engine, fen, depth);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.json,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: 'text', text: `Error: ${msg}` }] };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.error('[stockfish-mcp] Initialising Stockfish engine...');
  await engine.init();
  console.error('[stockfish-mcp] Engine ready. Starting stdio transport...');

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[stockfish-mcp] MCP server running on stdio');

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.error('[stockfish-mcp] Shutting down...');
    await engine.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[stockfish-mcp] Fatal:', err);
  process.exit(1);
});
