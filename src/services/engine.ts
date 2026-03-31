// UCI chess engine process wrappers (Stockfish and Lc0)
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import {
  DEFAULT_DEPTH,
  DEFAULT_MULTI_PV,
  DEFAULT_THREADS,
  DEFAULT_HASH_MB,
  LC0_DEPTH_TO_NODES,
} from '../constants.js';
import type { UciEngine, UciLine, UciScore, PositionAnalysis } from '../types.js';

// ── Shared UCI helpers ────────────────────────────────────────────────────

/** Parse UCI info lines into structured data. */
function parseInfoLines(output: string[], multiPv: number): UciLine[] {
  const pvMap = new Map<number, UciLine>();

  for (const line of output) {
    if (!line.startsWith('info') || !line.includes(' pv ')) continue;

    const parsed = parseInfoLine(line);
    if (parsed) {
      // Keep the deepest info for each multipv index.
      const existing = pvMap.get(parsed.multipv);
      if (!existing || parsed.depth > existing.depth) {
        pvMap.set(parsed.multipv, parsed);
      }
    }
  }

  return Array.from(pvMap.values())
    .sort((a, b) => a.multipv - b.multipv)
    .slice(0, multiPv);
}

/** Parse a single UCI info line (supports both Stockfish and Lc0 output). */
function parseInfoLine(line: string): UciLine | null {
  const tokens = line.split(/\s+/);

  const get = (key: string): string | undefined => {
    const idx = tokens.indexOf(key);
    return idx >= 0 && idx + 1 < tokens.length ? tokens[idx + 1] : undefined;
  };

  const getNumber = (key: string): number => {
    const val = get(key);
    return val !== undefined ? parseInt(val, 10) : 0;
  };

  const depth = getNumber('depth');
  const multipv = getNumber('multipv') || 1;
  const nodes = getNumber('nodes');
  const nps = getNumber('nps');
  const time = getNumber('time');

  // Parse score
  const scoreIdx = tokens.indexOf('score');
  if (scoreIdx < 0) return null;
  const scoreType = tokens[scoreIdx + 1] as 'cp' | 'mate';
  const scoreValue = parseInt(tokens[scoreIdx + 2], 10);
  if (isNaN(scoreValue)) return null;
  const score: UciScore = { type: scoreType, value: scoreValue };

  // Parse WDL if present (Lc0 emits "wdl W D L" after score)
  let wdl: { win: number; draw: number; loss: number } | undefined;
  const wdlIdx = tokens.indexOf('wdl');
  if (wdlIdx >= 0 && wdlIdx + 3 < tokens.length) {
    const win = parseInt(tokens[wdlIdx + 1], 10);
    const draw = parseInt(tokens[wdlIdx + 2], 10);
    const loss = parseInt(tokens[wdlIdx + 3], 10);
    if (!isNaN(win) && !isNaN(draw) && !isNaN(loss)) {
      wdl = { win, draw, loss };
    }
  }

  // Parse PV (principal variation) – everything after "pv"
  const pvIdx = tokens.indexOf('pv');
  if (pvIdx < 0) return null;
  const pv = tokens.slice(pvIdx + 1);

  return { depth, score, pv, pvSan: [], nodes, nps, time, multipv, wdl };
}

// ── Base UCI Engine ───────────────────────────────────────────────────────

/**
 * Shared base class for UCI-compatible engines.
 * Handles process spawning, UCI communication, info parsing.
 * Subclasses provide engine-specific init options and search commands.
 */
abstract class BaseUciEngine implements UciEngine {
  protected process: ChildProcessWithoutNullStreams | null = null;
  protected binaryPath: string;
  protected ready = false;
  abstract readonly displayName: string;

  constructor(binaryPath: string) {
    this.binaryPath = binaryPath;
  }

  /** Send engine-specific UCI options after the uci/uciok handshake. */
  protected abstract configureOptions(): Promise<void>;

  /** Build the UCI "go" command for analysis. */
  protected abstract buildGoCommand(depth: number): string;

  async init(): Promise<void> {
    if (this.process) return;

    this.process = spawn(this.binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.on('error', (err) => {
      console.error(`[${this.displayName}] Process error: ${err.message}`);
      this.process = null;
      this.ready = false;
    });

    this.process.on('exit', (code) => {
      console.error(`[${this.displayName}] Process exited with code ${code}`);
      this.process = null;
      this.ready = false;
    });

    await this.sendAndWait('uci', 'uciok');
    await this.configureOptions();
    await this.sendAndWait('isready', 'readyok');
    this.ready = true;
    console.error(`[${this.displayName}] Engine initialized`);
  }

  protected async ensureReady(): Promise<void> {
    if (!this.process || !this.ready) {
      await this.init();
    }
  }

  protected send(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.process) return reject(new Error(`${this.displayName} not running`));
      this.process.stdin.write(`${cmd}\n`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  protected sendAndWait(cmd: string, until: string, timeoutMs = 60_000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.process) return reject(new Error(`${this.displayName} not running`));

      const lines: string[] = [];
      let buffer = '';
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for "${until}" after ${timeoutMs}ms`));
      }, timeoutMs);

      const onData = (chunk: Buffer): void => {
        buffer += chunk.toString();
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';
        for (const line of parts) {
          const trimmed = line.trim();
          if (trimmed) lines.push(trimmed);
          if (trimmed.startsWith(until)) {
            cleanup();
            resolve(lines);
          }
        }
      };

      const cleanup = (): void => {
        clearTimeout(timeout);
        this.process?.stdout.removeListener('data', onData);
      };

      this.process.stdout.on('data', onData);
      this.process.stdin.write(`${cmd}\n`);
    });
  }

  async analyse(
    fen: string,
    depth = DEFAULT_DEPTH,
    multiPv = DEFAULT_MULTI_PV
  ): Promise<PositionAnalysis> {
    await this.ensureReady();

    await this.send('ucinewgame');
    await this.sendAndWait('isready', 'readyok');
    await this.send(`setoption name MultiPV value ${multiPv}`);
    await this.send(`position fen ${fen}`);

    const goCmd = this.buildGoCommand(depth);
    const output = await this.sendAndWait(goCmd, 'bestmove');

    const lines = parseInfoLines(output, multiPv);
    const bestMoveLine = output.find((l) => l.startsWith('bestmove'));
    const bestMove = bestMoveLine?.split(/\s+/)[1] ?? '';

    const topLine = lines[0];
    const evaluation: UciScore = topLine
      ? topLine.score
      : { type: 'cp', value: 0 };

    return { fen, bestMove, evaluation, lines, depth };
  }

  async bestMove(fen: string, depth = DEFAULT_DEPTH): Promise<string> {
    const result = await this.analyse(fen, depth, 1);
    return result.bestMove;
  }

  async quit(): Promise<void> {
    if (this.process) {
      await this.send('quit');
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }
}

// ── Stockfish Engine ──────────────────────────────────────────────────────

export class StockfishEngine extends BaseUciEngine {
  readonly displayName = 'stockfish';
  private threads: number;
  private hashMb: number;

  constructor(
    binaryPath = 'stockfish',
    threads = DEFAULT_THREADS,
    hashMb = DEFAULT_HASH_MB
  ) {
    super(binaryPath);
    this.threads = threads;
    this.hashMb = hashMb;
  }

  protected async configureOptions(): Promise<void> {
    await this.send(`setoption name Threads value ${this.threads}`);
    await this.send(`setoption name Hash value ${this.hashMb}`);
  }

  protected buildGoCommand(depth: number): string {
    return `go depth ${depth}`;
  }
}

// ── Lc0 Engine ────────────────────────────────────────────────────────────

export class Lc0Engine extends BaseUciEngine {
  readonly displayName = 'lc0';
  private weightsPath: string;
  private backend?: string;
  private threads: number;
  private hashMb: number;

  constructor(
    binaryPath = 'lc0',
    weightsPath: string,
    backend?: string,
    threads = DEFAULT_THREADS,
    hashMb = DEFAULT_HASH_MB
  ) {
    super(binaryPath);
    this.weightsPath = weightsPath;
    this.backend = backend;
    this.threads = threads;
    this.hashMb = hashMb;
  }

  protected async configureOptions(): Promise<void> {
    await this.send(`setoption name WeightsFile value ${this.weightsPath}`);
    if (this.backend) {
      await this.send(`setoption name Backend value ${this.backend}`);
    }
    await this.send(`setoption name Threads value ${this.threads}`);
    await this.send(`setoption name Hash value ${this.hashMb}`);
  }

  protected buildGoCommand(depth: number): string {
    // Lc0's MCTS "depth" is fundamentally different from alpha-beta depth.
    // Map the requested depth to a sensible node count for consistent results.
    const clampedDepth = Math.min(depth, LC0_DEPTH_TO_NODES.length - 1);
    const nodes = LC0_DEPTH_TO_NODES[clampedDepth] ?? LC0_DEPTH_TO_NODES[LC0_DEPTH_TO_NODES.length - 1];
    return `go nodes ${nodes}`;
  }
}
