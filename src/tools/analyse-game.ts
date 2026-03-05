// Tool: Analyse a full game from PGN
import type { StockfishEngine } from '../services/engine.js';
import type { MoveAnalysis, MoveClassification, GameAnalysis, StockfishScore } from '../types.js';
import { parsePgn, uciToSan, lookupOpening } from '../services/chess-utils.js';
import { formatGameAnalysis, formatScore } from '../services/formatting.js';
import { START_FEN, BLUNDER_THRESHOLD, MISTAKE_THRESHOLD, INACCURACY_THRESHOLD, GOOD_THRESHOLD, EXCELLENT_THRESHOLD } from '../constants.js';

export async function analyseGame(
  engine: StockfishEngine,
  pgn: string,
  depth: number
): Promise<{ text: string; json: Record<string, unknown> }> {
  const { moves, headers } = parsePgn(pgn);
  if (moves.length === 0) {
    throw new Error('PGN contains no moves. Please provide a valid game.');
  }

  // Detect opening
  const sanMoves = moves.map((m) => m.san);
  const opening = lookupOpening(sanMoves);
  const openingName = opening?.name ?? headers['ECO'] ?? 'Unknown';

  // Evaluate starting position
  const startEval = await engine.analyse(START_FEN, depth, 1);
  let prevScore: StockfishScore = startEval.evaluation;

  const moveAnalyses: MoveAnalysis[] = [];
  let currentFen = START_FEN;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const side: 'white' | 'black' = i % 2 === 0 ? 'white' : 'black';
    const moveNumber = Math.floor(i / 2) + 1;
    const fenBefore = currentFen;

    // Analyse position AFTER the move was played
    const posAfter = await engine.analyse(move.fen, depth, 1);

    // Analyse what the best move WAS in the position before
    const posBefore = await engine.analyse(fenBefore, depth, 1);

    // Normalise scores to White's perspective
    const evalBefore = normalise(prevScore, side);
    const evalAfter = normalise(posAfter.evaluation, side === 'white' ? 'black' : 'white');

    // Eval drop = how much the position worsened for the player who moved
    const drop = centipawns(evalBefore) - centipawns(evalAfter);

    const bestMoveUci = posBefore.bestMove;
    const bestMoveSan = uciToSan(fenBefore, bestMoveUci);
    const classification = classifyMove(drop, move.san === bestMoveSan);

    moveAnalyses.push({
      moveNumber,
      side,
      moveSan: move.san,
      moveUci: move.uci,
      fenBefore,
      fenAfter: move.fen,
      evalBefore: prevScore,
      evalAfter: posAfter.evaluation,
      bestMove: bestMoveUci,
      bestMoveSan,
      classification,
      evalDrop: drop,
    });

    prevScore = posAfter.evaluation;
    currentFen = move.fen;

    // Log progress to stderr
    if ((i + 1) % 10 === 0) {
      console.error(`[analyse-game] ${i + 1}/${moves.length} moves analysed`);
    }
  }

  // Compute accuracy (simplified model)
  const whiteAccuracy = computeAccuracy(moveAnalyses.filter((m) => m.side === 'white'));
  const blackAccuracy = computeAccuracy(moveAnalyses.filter((m) => m.side === 'black'));

  const summary = {
    totalMoves: moves.length,
    whiteBlunders: count(moveAnalyses, 'white', 'blunder'),
    whiteMistakes: count(moveAnalyses, 'white', 'mistake'),
    whiteInaccuracies: count(moveAnalyses, 'white', 'inaccuracy'),
    blackBlunders: count(moveAnalyses, 'black', 'blunder'),
    blackMistakes: count(moveAnalyses, 'black', 'mistake'),
    blackInaccuracies: count(moveAnalyses, 'black', 'inaccuracy'),
    opening: openingName,
  };

  const analysis: GameAnalysis = {
    moves: moveAnalyses,
    whiteAccuracy,
    blackAccuracy,
    summary,
  };

  const text = formatGameAnalysis(analysis);

  const json = {
    opening: openingName,
    totalMoves: moves.length,
    whiteAccuracy: Math.round(whiteAccuracy * 10) / 10,
    blackAccuracy: Math.round(blackAccuracy * 10) / 10,
    summary,
    moves: moveAnalyses.map((m) => ({
      moveNumber: m.moveNumber,
      side: m.side,
      move: m.moveSan,
      evaluation: formatScore(m.evalAfter),
      bestMove: m.bestMoveSan,
      classification: m.classification,
      evalDrop: Math.round(m.evalDrop),
    })),
  };

  return { text, json };
}

// --- helpers ---

/** Normalise a score to the given side's perspective (positive = good). */
function normalise(score: StockfishScore, side: 'white' | 'black'): StockfishScore {
  if (side === 'black') {
    return { type: score.type, value: -score.value };
  }
  return score;
}

/** Convert a score to centipawns (mate scores map to large values). */
function centipawns(score: StockfishScore): number {
  if (score.type === 'mate') {
    return score.value > 0 ? 10000 - score.value : -10000 - score.value;
  }
  return score.value;
}

/** Classify a move based on centipawn loss. */
function classifyMove(drop: number, isBest: boolean): MoveClassification {
  if (isBest) return 'best';
  if (drop >= BLUNDER_THRESHOLD) return 'blunder';
  if (drop >= MISTAKE_THRESHOLD) return 'mistake';
  if (drop >= INACCURACY_THRESHOLD) return 'inaccuracy';
  if (drop >= GOOD_THRESHOLD) return 'good';
  if (drop >= EXCELLENT_THRESHOLD) return 'excellent';
  return 'great';
}

/** Count errors of a given classification for a side. */
function count(moves: MoveAnalysis[], side: 'white' | 'black', cls: MoveClassification): number {
  return moves.filter((m) => m.side === side && m.classification === cls).length;
}

/** Simplified accuracy model (100% = all best moves). */
function computeAccuracy(moves: MoveAnalysis[]): number {
  if (moves.length === 0) return 100;

  let totalScore = 0;
  for (const m of moves) {
    const clampedDrop = Math.max(0, Math.min(m.evalDrop, 500));
    // Map 0 drop → 100, 500 drop → 0
    totalScore += Math.max(0, 100 - (clampedDrop / 5));
  }

  return totalScore / moves.length;
}
