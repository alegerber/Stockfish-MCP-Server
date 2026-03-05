// Formatting utilities for engine output
import type { StockfishScore, PositionAnalysis, MoveAnalysis, MoveClassification, GameAnalysis } from '../types.js';

/** Format a Stockfish score as a human-readable string. */
export function formatScore(score: StockfishScore): string {
  if (score.type === 'mate') {
    return score.value > 0 ? `M${score.value}` : `-M${Math.abs(score.value)}`;
  }
  const cp = score.value / 100;
  return cp >= 0 ? `+${cp.toFixed(2)}` : cp.toFixed(2);
}

/** Format a position analysis as Markdown. */
export function formatPositionAnalysis(analysis: PositionAnalysis): string {
  const parts: string[] = [];
  parts.push(`**Position Analysis** (depth ${analysis.depth})`);
  parts.push(`**FEN:** \`${analysis.fen}\``);
  parts.push(`**Evaluation:** ${formatScore(analysis.evaluation)}`);
  parts.push(`**Best move:** ${analysis.bestMove}`);
  parts.push('');
  parts.push('**Top lines:**');

  for (const line of analysis.lines) {
    const pv = line.pvSan.length > 0 ? line.pvSan.join(' ') : line.pv.join(' ');
    parts.push(`${line.multipv}. [${formatScore(line.score)}] ${pv}`);
  }

  return parts.join('\n');
}

/** Format full game analysis as Markdown. */
export function formatGameAnalysis(analysis: GameAnalysis): string {
  const parts: string[] = [];
  const s = analysis.summary;

  parts.push('# Game Analysis Report');
  parts.push('');
  parts.push(`**Opening:** ${s.opening}`);
  parts.push(`**Total moves:** ${s.totalMoves}`);
  parts.push('');
  parts.push('## Accuracy');
  parts.push(`- White: **${analysis.whiteAccuracy.toFixed(1)}%**`);
  parts.push(`- Black: **${analysis.blackAccuracy.toFixed(1)}%**`);
  parts.push('');
  parts.push('## Error Count');
  parts.push(`| | Blunders | Mistakes | Inaccuracies |`);
  parts.push(`|---|---|---|---|`);
  parts.push(`| White | ${s.whiteBlunders} | ${s.whiteMistakes} | ${s.whiteInaccuracies} |`);
  parts.push(`| Black | ${s.blackBlunders} | ${s.blackMistakes} | ${s.blackInaccuracies} |`);
  parts.push('');
  parts.push('## Move-by-Move');

  for (const m of analysis.moves) {
    const icon = classificationIcon(m.classification);
    const moveNum = m.side === 'white' ? `${m.moveNumber}.` : `${m.moveNumber}...`;
    const evalStr = formatScore(m.evalAfter);
    const bestStr = m.bestMoveSan !== m.moveSan ? ` (best: ${m.bestMoveSan})` : '';
    parts.push(`${moveNum} ${m.moveSan} ${icon} [${evalStr}]${bestStr}`);
  }

  return parts.join('\n');
}

/** Map classification to a chess.com-style icon. */
function classificationIcon(c: MoveClassification): string {
  const icons: Record<MoveClassification, string> = {
    brilliant: '!!',
    great: '!',
    best: '★',
    excellent: '✓',
    good: '○',
    inaccuracy: '?!',
    mistake: '?',
    blunder: '??',
    book: '📖',
  };
  return icons[c] ?? '';
}
