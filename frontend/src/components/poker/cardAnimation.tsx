
import { motion } from 'motion/react'
import type { CardData } from '../../pokerApi'
import { PlayingCard } from './PokerPrimitives'

// Opponent positions around the poker table
const SEAT_TARGETS = [
  { left: '50%', top: '11%' },
  { left: '88%', top: '30%' },
  { left: '88%', top: '71%' },
  { left: '12%', top: '71%' },
  { left: '12%', top: '30%' },
]

export function DealingAnimation({
  step,
  opponents,
  spectating,
}: {
  step: number
  opponents: number
  spectating: boolean
}) {
  if (step < 0) return null

  const total = opponents + (spectating ? 0 : 1)
  if (!total) return null

  // Determine which player receives this card
  const target = step % total

  const destination =
    target < opponents
      ? SEAT_TARGETS[target % SEAT_TARGETS.length]
      : { left: '50%', top: '91%' }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[35]"
      aria-hidden="true"
    >
      {/* Deck positioned near the middle of the table */}
      <div className="absolute left-[35%] top-[48%] -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-14 w-10 rounded-md border-[3px] border-[#eee9df] shadow-xl"
          style={{
            background:
              'repeating-linear-gradient(45deg, #6b1010 0 3px, #9d2a23 3px 6px)',
          }}
        />
      </div>

      {/* Card moves from the deck to a player */}
      <motion.div
        key={step}
        className="absolute h-14 w-10 rounded-md border-[3px] border-[#eee9df] shadow-2xl"
        style={{
          background:
            'repeating-linear-gradient(45deg, #6b1010 0 3px, #9d2a23 3px 6px)',
        }}
        initial={{
          left: '35%',
          top: '48%',
          x: '-50%',
          y: '-50%',
          rotate: -10,
          scale: 1,
        }}
        animate={{
          left: destination.left,
          top: destination.top,
          rotate: target % 2 ? 12 : -12,
          scale: 0.8,
        }}
        transition={{
          duration: 0.27,
          ease: 'easeOut',
        }}
      />
    </div>
  )
}

// Flip your existing PlayingCard from back to front
export function FlippingPlayingCard({
  card,
  selected,
  onClick,
}: {
  card: CardData
  selected: boolean
  onClick: () => void
}) {
  return (
    <div className="shrink-0" style={{ perspective: 1000}}>
    <motion.div
      className="relative shrink-0"
      style={{ transformStyle: 'preserve-3d' }}
      initial={{ rotateY: 180 }}
      animate={{ rotateY: 0 }}
      transition={{
        duration: 0.42,
        ease: 'easeOut',
      }}
    >
      <div style={{ backfaceVisibility: 'hidden' }}>
        <PlayingCard
          card={card}
          selected={selected}
          onClick={onClick}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 rounded-xl border-4 border-[#eee9df]"
        style={{
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background:
            'repeating-linear-gradient(45deg, #6b1010 0 3px, #9d2a23 3px 6px)',
        }}
      />
    </motion.div>
  </div>
  )
}
const cardBackStyle = {
  background:
    "repeating-linear-gradient(45deg, #6b1010 0px, #6b1010 3px, #9d2a23 3px, #9d2a23 6px)",
  border: "3px solid #eee9df",
  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
};
function DeckStack({ count = 52 }: { count?: number }) {
  return (
    <div className="relative h-14 w-10">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="absolute inset-0 rounded-md"
          style={{
            ...cardBackStyle,
            transform: `translateY(${-index * 0.16}px)`,
          }}
        />
      ))}
    </div>
  );
}
export function ShuffleAnimation() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[35]"
      aria-hidden="true"
    >
      {/* Position relative to the poker table */}
      <div
        className="absolute"
        style={{
          left: "35%",
          top: "48%",
          width: "56px",
          height: "80px",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Left half */}
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={cardBackStyle}
          animate={{
            x: [0, -45, -45, 0],
            y: [0, -12, 8, 0],
            rotate: [0, -18, -8, 0],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Right half */}
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={cardBackStyle}
          animate={{
            x: [0, 45, 45, 0],
            y: [0, -12, 8, 0],
            rotate: [0, 18, 8, 0],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
}
