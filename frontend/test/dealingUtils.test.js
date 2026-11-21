
import {
  getDealtToMe,
  getDealtToOpponent,
} from '../src/utils/dealingUtils.ts';

describe('getDealtToMe', () => {
  test('returns five after dealing ends', () => {
    expect(getDealtToMe(false, -1, 3)).toBe(5);
  });

  test('returns zero before our first card', () => {
    expect(getDealtToMe(true, -1, 2)).toBe(0);
    expect(getDealtToMe(true, 1, 2)).toBe(0);
  });

  test('counts cards at the end of each deal cycle', () => {
    expect(getDealtToMe(true, 2, 2)).toBe(1);
    expect(getDealtToMe(true, 5, 2)).toBe(2);
    expect(getDealtToMe(true, 14, 2)).toBe(5);
    expect(getDealtToMe(true, 200, 2)).toBe(5);
  });
});

describe('getDealtToOpponent', () => {
  test('returns five after dealing ends', () => {
    expect(
      getDealtToOpponent(false, -1, 2, false, 0)
    ).toBe(5);
  });

  test('returns zero if a spectator has no opponents', () => {
    expect(
      getDealtToOpponent(true, 0, 0, true, 0)
    ).toBe(0);
  });

  test('handles non-spectator round-robin dealing', () => {
    expect(getDealtToOpponent(true, -1, 2, false, 0)).toBe(0);
    expect(getDealtToOpponent(true, 0, 2, false, 0)).toBe(1);
    expect(getDealtToOpponent(true, 0, 2, false, 1)).toBe(0);
    expect(getDealtToOpponent(true, 1, 2, false, 1)).toBe(1);
    expect(getDealtToOpponent(true, 3, 2, false, 0)).toBe(2);
    expect(getDealtToOpponent(true, 100, 2, false, 0)).toBe(5);
  });

  test('handles spectator dealing without a viewer seat', () => {
    expect(getDealtToOpponent(true, 0, 2, true, 0)).toBe(1);
    expect(getDealtToOpponent(true, 0, 2, true, 1)).toBe(0);
    expect(getDealtToOpponent(true, 2, 2, true, 0)).toBe(2);
  });
});
