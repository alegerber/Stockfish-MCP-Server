// Tool: Analyse a single chess position
import type { StockfishEngine } from '../services/engine.js';
import { isValidFen, uciToSan } from '../services/chess-utils.js';
import { formatPositionAnalysis, formatScore } from '../services/formatting.js';

export async function analysePosition(
  engine: StockfishEngine,
  fen: string,
  depth: number,
  multiPv: number
): Promise<{ text: string; json: Record<string, unknown> }> {
  if (!isValidFen(fen)) {
    throw new Error(`Invalid FEN: "${fen}". Please provide a valid FEN string.`);
  }

  const analysis = await engine.analyse(fen, depth, multiPv);

  // Enrich PV with SAN notation
  for (const line of analysis.lines) {
    const sanMoves: string[] = [];
    let currentFen = fen;
    for (const uci of line.pv) {
      const san = uciToSan(currentFen, uci);
      sanMoves.push(san);
      // Advance position – lightweight re-parse
      try {
        const { Chess } = await import('chess.js');
        const c = new Chess(currentFen);
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        c.move({ from, to, promotion });
        currentFen = c.fen();
      } catch {
        break;
      }
    }
    line.pvSan = sanMoves;
  }

  const text = formatPositionAnalysis(analysis);

  const json = {
    fen: analysis.fen,
    depth: analysis.depth,
    evaluation: formatScore(analysis.evaluation),
    evaluationRaw: analysis.evaluation,
    bestMove: analysis.bestMove,
    bestMoveSan: uciToSan(fen, analysis.bestMove),
    lines: analysis.lines.map((l) => ({
      rank: l.multipv,
      score: formatScore(l.score),
      scoreRaw: l.score,
      depth: l.depth,
      movesUci: l.pv,
      movesSan: l.pvSan,
    })),
  };

  return { text, json };
}
