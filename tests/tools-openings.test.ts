import { describe, it, expect } from 'vitest';
import { lookupOpeningByQuery, identifyOpeningFromPgn } from '../src/tools/openings.js';

describe('lookupOpeningByQuery', () => {
  it('returns results for a known opening name', () => {
    const result = lookupOpeningByQuery('Sicilian');
    expect(result.json.count).toBeGreaterThan(0);
    expect(result.text).toContain('Sicilian');
  });

  it('returns a not-found message for an unknown query', () => {
    const result = lookupOpeningByQuery('xyznotanopening');
    expect(result.text).toContain('No openings found');
    expect((result.json.results as unknown[]).length).toBe(0);
  });

  it('finds by ECO code', () => {
    const result = lookupOpeningByQuery('C50');
    expect(result.json.count).toBeGreaterThan(0);
    expect(
      (result.json.results as Array<{ eco: string }>).some((r) => r.eco === 'C50')
    ).toBe(true);
  });

  it('includes count, query, and results in JSON', () => {
    const result = lookupOpeningByQuery('Italian');
    expect(result.json).toHaveProperty('query', 'Italian');
    expect(result.json).toHaveProperty('count');
    expect(result.json).toHaveProperty('results');
  });

  it('text mentions the number of results found', () => {
    const result = lookupOpeningByQuery('Ruy');
    expect(result.text).toContain('Found');
  });

  it('each result includes eco, name, pgn, and fen', () => {
    const result = lookupOpeningByQuery('C60');
    const results = result.json.results as Array<Record<string, unknown>>;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('eco');
    expect(results[0]).toHaveProperty('name');
    expect(results[0]).toHaveProperty('pgn');
    expect(results[0]).toHaveProperty('fen');
  });
});

describe('identifyOpeningFromPgn', () => {
  it('identifies Ruy Lopez from full PGN', () => {
    const result = identifyOpeningFromPgn('1. e4 e5 2. Nf3 Nc6 3. Bb5');
    expect(result.json.identified).toBe(true);
    expect(result.json.eco).toBe('C60');
    expect(result.json.name).toBe('Ruy Lopez');
  });

  it('identifies opening from bare move list without numbers', () => {
    const result = identifyOpeningFromPgn('e4 c5');
    expect(result.json.identified).toBe(true);
    expect(result.text).toContain('Sicilian');
  });

  it('returns not-identified for unrecognized moves', () => {
    const result = identifyOpeningFromPgn('1. b4 b5');
    expect(result.json.identified).toBe(false);
    expect(result.text).toContain('Could not identify');
  });

  it('returns eco, name, pgn, fen in JSON when found', () => {
    const result = identifyOpeningFromPgn('1. e4 e5 2. Nf3 Nc6 3. Bc4');
    expect(result.json.identified).toBe(true);
    expect(result.json).toHaveProperty('eco');
    expect(result.json).toHaveProperty('name');
    expect(result.json).toHaveProperty('pgn');
    expect(result.json).toHaveProperty('fen');
  });

  it('identifies Sicilian from PGN with headers', () => {
    const pgn = '[White "Alice"]\n[Black "Bob"]\n1. e4 c5';
    const result = identifyOpeningFromPgn(pgn);
    expect(result.json.identified).toBe(true);
    expect(result.text).toContain('Sicilian');
  });
});
