
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
  finished = false,
}: {
  step: number;
  opponents: number;
  spectating: boolean;
  finished?: boolean;
}) {
  const total = opponents + (spectating ? 0 : 1);

  if (!total) return null;

  const target = step >= 0 ? step % total : 0;

  const destination =
    target < opponents
      ? SEAT_TARGETS[target % SEAT_TARGETS.length]
      : { left: "50%", top: "91%" };

  const cardsDealt = finished
    ? total * 5
    : step < 0
      ? 0
      : Math.min(step + 1, total * 5);

  const remainingCards = Math.max(0, 52 - cardsDealt);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[35]"
      aria-hidden="true"
    >
     {/* Remaining deck next to the pot */}
        <div
          className="absolute"
          style={{
            left: "35%",
            top: "48%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <DeckStack count={remainingCards} />
        </div>

      {/* Card moves from the deck to a player */}
     {step >= 0 && ( 
      <motion.div
        key={step}
        className="absolute"
        style={{
          width: 40,
          height: 56,
        }}
        initial={{
          left: "35%",
          top: "48%",
          x: "-50%",
          y: "-50%",
          rotate: 0,
          scale: 1,
        }}
        animate={{
          left: destination.left,
          top: destination.top,
          x: "-50%",
          y: "-50%",
          rotate: target % 2 ? 8 : -8,
          scale: 0.8,
        }}
        transition={{
          duration: 0.27,
          ease: "easeOut",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#6b1010",
            backgroundImage:
              "repeating-linear-gradient(45deg, #6b1010 0px, #6b1010 3px, #9d2a23 3px, #9d2a23 6px)",
            border: "2px solid #eee9df",
            borderRadius: "5px",
            boxShadow: "0 5px 12px rgba(0,0,0,0.6)",
          }}
        />
      </motion.div>
     )}
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
  border: "2px solid #eee9df",
  borderRadius: "5px",
  boxShadow: "0 3px 8px rgba(0,0,0,0.6)",
};


function DeckStack({ count = 52 }: { count?: number }) {
  if (count <= 0) return null;

  const thickness = Math.min(7, count * 0.12);

  return (
    <div
      style={{
        position: "relative",
        width: 40,
        height: 56,

        // Red card back
        backgroundColor: "#6b1010",
        backgroundImage:
          "repeating-linear-gradient(45deg, #6b1010 0px, #6b1010 3px, #9d2a23 3px, #9d2a23 6px)",

        border: "2px solid #eee9df",
        borderRadius: "5px",

        // Cream-colored thickness below the red card
        boxShadow: `
          0 ${thickness}px 0 #d9d0c2,
          0 ${thickness + 2}px 0 #bfb4a3,
          0 ${thickness + 6}px 10px rgba(0,0,0,0.6)
        `,
      }}
    />
  );
}


export function ShuffleAnimation() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[35]"
      aria-hidden="true"
    >
      <div
        className="absolute"
        style={{
          left: "35%",
          top: "48%",
          width: 40,
          height: 56,
          transform: "translate(-50%, -50%)",
          perspective: 900,
        }}
      >
        {Array.from({ length: 52 }, (_, index) => {
          const leftHalf = index < 26;
          const cardIndex = index % 26;
          const direction = leftHalf ? -1 : 1;

          // Slightly stagger individual cards in each pile
          const spread = cardIndex * 2;

          return (
            <motion.div
              key={index}
              className="absolute inset-0 rounded-md"
              style={{
                ...cardBackStyle,
                zIndex: index,
                transformOrigin: "center bottom",
              }}
              initial={{
                x: 0,
                y: -index * 0.12,
                rotate: 0,
              }}
              animate={{
                // Split, fan out, interleave, stack
                x: [
                  0,
                  direction * (32 + spread),
                  direction * (18 + spread * 0.4),
                  0,
                ],
                y: [
                  -index * 0.12,
                  -cardIndex * 1.3,
                  -cardIndex * 1.6,
                  -index * 0.12,
                ],
                rotate: [
                  0,
                  direction * (8 + cardIndex * 0.7),
                  direction * (4 + cardIndex * 0.3),
                  0,
                ],
                rotateX: [0, 8, 18, 0],
              }}
              transition={{
                duration: 2.3,
                delay: cardIndex * 0.012,
                times: [0, 0.32, 0.7, 1],
                ease: "easeInOut",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
