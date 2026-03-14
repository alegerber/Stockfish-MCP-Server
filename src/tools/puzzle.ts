// Tool: Generate a tactic puzzle from a position
import type { UciEngine, TacticPuzzle } from '../types.js';
import { isValidFen } from '../services/chess-utils.js';
import { formatScore } from '../services/formatting.js';
import { Chess } from 'chess.js';

export async function generatePuzzle(
  engine: UciEngine,
  fen: string,
  depth: number
): Promise<{ text: string; json: Record<string, unknown> }> {
  if (!isValidFen(fen)) {
    throw new Error(`Invalid FEN: "${fen}". Please provide a valid position.`);
  }

  // Analyse with 2 PVs to compare best vs second-best
  const analysis = await engine.analyse(fen, depth, 2);
  const lines = analysis.lines;

  if (lines.length === 0) {
    throw new Error('Engine returned no lines. The position may be terminal (checkmate/stalemate).');
  }

  const bestLine = lines[0];
  const secondLine = lines.length > 1 ? lines[1] : null;

  // Determine if the position has a clear tactical solution
  const bestScore = scoreToNum(bestLine.score);
  const secondScore = secondLine ? scoreToNum(secondLine.score) : bestScore - 300;
  const advantage = bestScore - secondScore;

  // Build the solution sequence (first 3–5 moves of the PV)
  const solutionLength = Math.min(bestLine.pv.length, 5);
  const solutionUci = bestLine.pv.slice(0, solutionLength);

  // Convert to SAN
  const solutionSan: string[] = [];
  let currentFen = fen;
  for (const uci of solutionUci) {
    try {
      const c = new Chess(currentFen);
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = c.move({ from, to, promotion });
      if (!move) break;
      solutionSan.push(move.san);
      currentFen = c.fen();
    } catch {
      break;
    }
  }

  // Classify difficulty
  const difficulty = advantage > 500 ? 'easy' : advantage > 200 ? 'medium' : 'hard';

  // Detect theme
  const theme = detectTheme(fen, bestLine, solutionSan);

  // Build explanation
  const sideToMove = fen.includes(' w ') ? 'White' : 'Black';
  const explanation = `${sideToMove} to move. ${theme}. Evaluation: ${formatScore(bestLine.score)}`;

  const puzzle: TacticPuzzle = {
    fen,
    solution: solutionUci.slice(0, solutionSan.length),
    solutionSan,
    theme,
    difficulty,
    explanation,
  };

  const text = [
    `**Tactic Puzzle** (${difficulty})`,
    `**FEN:** \`${fen}\``,
    `**Theme:** ${theme}`,
    `**${sideToMove} to move**`,
    '',
    `||**Solution:** ${solutionSan.join(' ')}||`,
    `||**Explanation:** ${explanation}||`,
  ].join('\n');

  return { text, json: puzzle as unknown as Record<string, unknown> };
}

// --- helpers ---

function scoreToNum(score: { type: string; value: number }): number {
  if (score.type === 'mate') {
    return score.value > 0 ? 10000 - Math.abs(score.value) : -10000 + Math.abs(score.value);
  }
  return score.value;
}

function detectTheme(
  fen: string,
  bestLine: { score: { type: string; value: number }; pv: string[] },
  solutionSan: string[]
): string {
  // Check for mate
  if (bestLine.score.type === 'mate') {
    return `Mate in ${Math.abs(bestLine.score.value)}`;
  }

  // Check for captures in solution
  const hasCapture = solutionSan.some((m) => m.includes('x'));
  const hasCheck = solutionSan.some((m) => m.includes('+'));
  const hasPromotion = solutionSan.some((m) => m.includes('='));

  if (hasPromotion) return 'Promotion';
  if (hasCheck && hasCapture) return 'Attacking combination';
  if (hasCheck) return 'Forcing sequence';
  if (hasCapture) return 'Tactical combination';

  // Check material advantage
  if (bestLine.score.type === 'cp' && Math.abs(bestLine.score.value) > 300) {
    return 'Winning material';
  }

  return 'Positional advantage';
}
