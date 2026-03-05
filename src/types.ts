// Types for Stockfish MCP server

export interface StockfishLine {
  depth: number;
  score: StockfishScore;
  pv: string[];
  pvSan: string[];
  nodes: number;
  nps: number;
  time: number;
  multipv: number;
}

export interface StockfishScore {
  type: 'cp' | 'mate';
  value: number;
}

export interface PositionAnalysis {
  fen: string;
  bestMove: string;
  evaluation: StockfishScore;
  lines: StockfishLine[];
  depth: number;
}

export interface MoveAnalysis {
  moveNumber: number;
  side: 'white' | 'black';
  moveSan: string;
  moveUci: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: StockfishScore;
  evalAfter: StockfishScore;
  bestMove: string;
  bestMoveSan: string;
  classification: MoveClassification;
  evalDrop: number;
}

export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'book';

export interface GameAnalysis {
  moves: MoveAnalysis[];
  whiteAccuracy: number;
  blackAccuracy: number;
  summary: GameSummary;
}

export interface GameSummary {
  totalMoves: number;
  whiteBlunders: number;
  whiteMistakes: number;
  whiteInaccuracies: number;
  blackBlunders: number;
  blackMistakes: number;
  blackInaccuracies: number;
  opening: string;
}

export interface OpeningInfo {
  eco: string;
  name: string;
  pgn: string;
  fen: string;
}

export interface TacticPuzzle {
  fen: string;
  solution: string[];
  solutionSan: string[];
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
}

export interface StockfishConfig {
  binaryPath: string;
  defaultDepth: number;
  defaultMultiPv: number;
  threads: number;
  hashMb: number;
}
