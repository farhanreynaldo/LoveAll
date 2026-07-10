import { describe, it, expect } from 'vitest';
import { generateRoomCode } from '../src/room-code.js';

describe('generateRoomCode', () => {
  it('returns a 4-character code from the unambiguous charset', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(4);
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
  });

  it('is not obviously deterministic across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
