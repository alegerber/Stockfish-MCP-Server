import { describe, it, expect } from 'vitest';
import { centipawns } from '../src/types.js';

describe('centipawns', () => {
  it('returns value unchanged for a cp score', () => {
    expect(centipawns({ type: 'cp', value: 150 })).toBe(150);
  });

  it('returns negative value for a negative cp score', () => {
    expect(centipawns({ type: 'cp', value: -75 })).toBe(-75);
  });

  it('returns 0 for a cp score of 0', () => {
    expect(centipawns({ type: 'cp', value: 0 })).toBe(0);
  });

  it('converts white mate in 3 to a large positive value', () => {
    expect(centipawns({ type: 'mate', value: 3 })).toBe(9997); // 10000 - 3
  });

  it('converts black mate in 2 to a large negative value', () => {
    expect(centipawns({ type: 'mate', value: -2 })).toBe(-9998); // -10000 - (-2)
  });

  it('treats mate in 1 as near-maximum', () => {
    expect(centipawns({ type: 'mate', value: 1 })).toBe(9999);
  });

  it('larger mate-in value produces smaller absolute centipawn value', () => {
    const mateIn1 = centipawns({ type: 'mate', value: 1 });
    const mateIn5 = centipawns({ type: 'mate', value: 5 });
    expect(mateIn1).toBeGreaterThan(mateIn5);
  });
});
