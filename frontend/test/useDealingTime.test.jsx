
/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { useDealingTimer } from '../src/hooks/useDealingTimer.ts';

const makeProps = (overrides = {}) => ({
  dealing: true,
  dealOpponentCount: 1,
  spectating: false,
  setDealing: jest.fn(),
  setDealStep: jest.fn(),
  setShuffling: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  window.matchMedia = jest.fn(() => ({ matches: false }));
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  delete window.matchMedia;
});

test('does not schedule dealing if it has not started', () => {
  const p = makeProps({ dealing: false });
  renderHook(() => useDealingTimer(p));

  act(() => jest.advanceTimersByTime(10000));

  expect(p.setDealStep).not.toHaveBeenCalled();
  expect(p.setDealing).not.toHaveBeenCalled();
});

test('skips animation when reduced motion is preferred', () => {
  window.matchMedia = jest.fn(() => ({ matches: true }));
  const p = makeProps();

  renderHook(() => useDealingTimer(p));

  expect(p.setShuffling).toHaveBeenCalledWith(false);
  expect(p.setDealStep).toHaveBeenCalledWith(-1);
  expect(p.setDealing).toHaveBeenCalledWith(false);
});

test('skips animation when matchMedia is missing', () => {
  delete window.matchMedia;
  const p = makeProps();

  renderHook(() => useDealingTimer(p));

  expect(p.setDealing).toHaveBeenCalledWith(false);
});

test('stops when spectator has zero players', () => {
  const p = makeProps({
    spectating: true,
    dealOpponentCount: 0,
  });

  renderHook(() => useDealingTimer(p));

  expect(p.setDealing).toHaveBeenCalledWith(false);
  expect(p.setShuffling).toHaveBeenCalledWith(false);
});

test('deals one card per interval after shuffle and finishes', () => {
  const p = makeProps({ dealOpponentCount: 1 });

  renderHook(() => useDealingTimer(p));

  act(() => jest.advanceTimersByTime(5300));
  expect(p.setShuffling).toHaveBeenCalledWith(false);
  expect(p.setDealStep).not.toHaveBeenCalled();

  act(() => jest.advanceTimersByTime(340 * 11));

  expect(p.setDealStep.mock.calls.map(([n]) => n))
    .toEqual([0,1,2,3,4,5,6,7,8,9,-1]);
  expect(p.setDealing).toHaveBeenCalledWith(false);
});

test('spectators receive cards only for opponents', () => {
  const p = makeProps({
    spectating: true,
    dealOpponentCount: 1,
  });

  renderHook(() => useDealingTimer(p));

  act(() => jest.advanceTimersByTime(5300 + 340 * 6));

  expect(p.setDealStep.mock.calls.map(([n]) => n))
    .toEqual([0,1,2,3,4,-1]);
});

test('unmount clears pending shuffle and deal timers', () => {
  const p = makeProps();
  const { unmount } = renderHook(() => useDealingTimer(p));

  unmount();
  act(() => jest.advanceTimersByTime(10000));

  expect(p.setShuffling).not.toHaveBeenCalled();
  expect(p.setDealStep).not.toHaveBeenCalled();
});

test('unmount during dealing clears the interval', () => {
  const p = makeProps();
  const { unmount } = renderHook(() => useDealingTimer(p));

  act(() => jest.advanceTimersByTime(5300 + 340));
  expect(p.setDealStep).toHaveBeenCalledWith(0);

  const calls = p.setDealStep.mock.calls.length;
  unmount();

  act(() => jest.advanceTimersByTime(5000));
  expect(p.setDealStep).toHaveBeenCalledTimes(calls);
});
