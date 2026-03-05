// Shared constants for Stockfish MCP server

export const DEFAULT_DEPTH = 20;
export const DEFAULT_MULTI_PV = 3;
export const DEFAULT_THREADS = 2;
export const DEFAULT_HASH_MB = 128;
export const MAX_DEPTH = 30;
export const MAX_MULTI_PV = 5;
export const CHARACTER_LIMIT = 50000;

// Thresholds for move classification (in centipawns)
export const BLUNDER_THRESHOLD = 200;
export const MISTAKE_THRESHOLD = 100;
export const INACCURACY_THRESHOLD = 50;
export const GOOD_THRESHOLD = 20;
export const EXCELLENT_THRESHOLD = 10;

// Starting position FEN
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
