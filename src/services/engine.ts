// Stockfish engine process wrapper
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import {
  DEFAULT_DEPTH,
  DEFAULT_MULTI_PV,
  DEFAULT_THREADS,
  DEFAULT_HASH_MB,
} from '../constants.js';
import type { StockfishLine, StockfishScore, PositionAnalysis } from '../types.js';

export class StockfishEngine {
  private process: ChildProcessWithoutNullStreams | null = null;
  private binaryPath: string;
  private threads: number;
  private hashMb: number;
  private ready = false;

  constructor(
    binaryPath = 'stockfish',
    threads = DEFAULT_THREADS,
    hashMb = DEFAULT_HASH_MB
  ) {
    this.binaryPath = binaryPath;
    this.threads = threads;
    this.hashMb = hashMb;
  }

  /** Start the Stockfish process and configure UCI options. */
  async init(): Promise<void> {
    if (this.process) return;

    this.process = spawn(this.binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.on('error', (err) => {
      console.error(`[stockfish] Process error: ${err.message}`);
      this.process = null;
      this.ready = false;
    });

    this.process.on('exit', (code) => {
      console.error(`[stockfish] Process exited with code ${code}`);
      this.process = null;
      this.ready = false;
    });

    await this.sendAndWait('uci', 'uciok');
    await this.send(`setoption name Threads value ${this.threads}`);
    await this.send(`setoption name Hash value ${this.hashMb}`);
    await this.sendAndWait('isready', 'readyok');
    this.ready = true;
    console.error('[stockfish] Engine initialized');
  }

  /** Ensure the engine is ready; restart if necessary. */
  private async ensureReady(): Promise<void> {
    if (!this.process || !this.ready) {
      await this.init();
    }
  }

  /** Send a raw UCI command. */
  private send(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.process) return reject(new Error('Stockfish not running'));
      this.process.stdin.write(`${cmd}\n`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /** Send a command and collect output until a line matches `until`. */
  private sendAndWait(cmd: string, until: string, timeoutMs = 60_000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.process) return reject(new Error('Stockfish not running'));

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

  /** Analyse a position given as FEN. */
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

    const output = await this.sendAndWait(`go depth ${depth}`, 'bestmove');

    const lines = this.parseInfoLines(output, multiPv);
    const bestMoveLine = output.find((l) => l.startsWith('bestmove'));
    const bestMove = bestMoveLine?.split(/\s+/)[1] ?? '';

    const topLine = lines[0];
    const evaluation: StockfishScore = topLine
      ? topLine.score
      : { type: 'cp', value: 0 };

    return { fen, bestMove, evaluation, lines, depth };
  }

  /** Get only the best move for a position (fast, single-PV). */
  async bestMove(fen: string, depth = DEFAULT_DEPTH): Promise<string> {
    const result = await this.analyse(fen, depth, 1);
    return result.bestMove;
  }

  /** Parse UCI info lines into structured data. */
  private parseInfoLines(output: string[], multiPv: number): StockfishLine[] {
    const pvMap = new Map<number, StockfishLine>();

    for (const line of output) {
      if (!line.startsWith('info') || !line.includes(' pv ')) continue;

      const parsed = this.parseInfoLine(line);
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

  /** Parse a single UCI info line. */
  private parseInfoLine(line: string): StockfishLine | null {
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
    const score: StockfishScore = { type: scoreType, value: scoreValue };

    // Parse PV (principal variation) – everything after "pv"
    const pvIdx = tokens.indexOf('pv');
    if (pvIdx < 0) return null;
    const pv = tokens.slice(pvIdx + 1);

    return { depth, score, pv, pvSan: [], nodes, nps, time, multipv };
  }

  /** Shut down the engine process. */
  async quit(): Promise<void> {
    if (this.process) {
      await this.send('quit');
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }
}
