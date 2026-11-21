
/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('motion/react', () => ({
  motion: {
    div: ({ children, initial, animate, transition, ...props }) => (
      <div
        {...props}
        data-initial={JSON.stringify(initial)}
        data-animate={JSON.stringify(animate)}
      >
        {children}
      </div>
    ),
  },
}));

jest.mock('../src/components/poker/PokerPrimitives', () => ({
  PlayingCard: ({ card, onClick }) => (
    <button onClick={onClick}>{card.rank}</button>
  ),
}));

import {
  DealingAnimation,
  FlippingPlayingCard,
  DeckStack,
  ShuffleAnimation,
  DrawExchangeAnimation,
} from '../src/components/poker/cardAnimation.tsx';

const motionChildren = container =>
  [...container.querySelectorAll('[data-animate]')];

test('no dealing cards when there are no players', () => {
  const { container } = render(
    <DealingAnimation step={0} opponents={0} spectating />
  );

  expect(container).toBeEmptyDOMElement();
});

test('dealing waits until first step', () => {
  const { container } = render(
    <DealingAnimation
      step={-1}
      opponents={1}
      spectating={false}
    />
  );

  expect(motionChildren(container)).toHaveLength(0);
});

test('deals to an opponent and then the player seat', () => {
  const { container, rerender } = render(
    <DealingAnimation
      step={0}
      opponents={1}
      spectating={false}
    />
  );

  expect(
    JSON.parse(motionChildren(container)[0].dataset.animate).top
  ).toBe('11%');

  rerender(
    <DealingAnimation
      step={1}
      opponents={1}
      spectating={false}
    />
  );

  expect(
    JSON.parse(motionChildren(container)[0].dataset.animate).top
  ).toBe('91%');
});

test('spectator dealing targets opponent seats', () => {
  const { container } = render(
    <DealingAnimation step={1} opponents={2} spectating />
  );

  expect(
    JSON.parse(motionChildren(container)[0].dataset.animate).left
  ).toBe('88%');
});

test('flip card shows content and handles click', () => {
  const onClick = jest.fn();

  const { container, rerender } = render(
    <FlippingPlayingCard
      card={{ rank: 'A', suit: 'spades' }}
      selected={false}
      onClick={onClick}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'A' }));
  expect(onClick).toHaveBeenCalledTimes(1);

  rerender(
    <FlippingPlayingCard
      card={{ rank: 'A', suit: 'spades' }}
      selected
      faceDown
      onClick={onClick}
    />
  );

  expect(motionChildren(container)[0].dataset.animate)
    .toContain('180');
});

test('empty deck renders nothing; nonempty renders stacked deck', () => {
  const { container, rerender } = render(<DeckStack count={0} />);

  expect(container).toBeEmptyDOMElement();

  rerender(<DeckStack count={10} />);
  expect(container.firstElementChild).toHaveStyle({
    width: '40px',
  });

  rerender(<DeckStack />);
  expect(container.firstElementChild).toBeInTheDocument();
});

test('shuffle builds 52 animated cards', () => {
  const { container } = render(<ShuffleAnimation />);
  expect(motionChildren(container)).toHaveLength(52);
});

test.each([
  ['discard', undefined],
  ['receive', undefined],
  ['discard', 0],
  ['receive', 1],
  ['fold', 0],
])('draw exchange supports %s phase and seat %s', (phase, opponentIndex) => {
  const cards = [
    { rank: 'A', suit: '♥' },
    { rank: 'K', suit: 'clubs' },
  ];

  const { container } = render(
    <DrawExchangeAnimation
      phase={phase}
      indexes={[0, 1]}
      opponentIndex={opponentIndex}
      cards={cards}
    />
  );

  expect(motionChildren(container).length)
    .toBeGreaterThanOrEqual(2);
});

test('fold supports missing card data and black card suit', () => {
  const { container, rerender } = render(
    <DrawExchangeAnimation
      phase="fold"
      indexes={[0]}
      cards={[]}
    />
  );

  expect(motionChildren(container)).toHaveLength(1);

  rerender(
    <DrawExchangeAnimation
      phase="fold"
      indexes={[0]}
      cards={[{ rank: 'K', suit: 'spades' }]}
    />
  );

  expect(screen.getByText('K')).toBeInTheDocument();
});
