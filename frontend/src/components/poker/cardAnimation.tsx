
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
  step: number;
  opponents: number;
  spectating: boolean;
}) {
  const total = opponents + (spectating ? 0 : 1);

  if (!total) return null;

  const target = step >= 0 ? step % total : 0;

  const destination =
    target < opponents
      ? SEAT_TARGETS[target % SEAT_TARGETS.length]
      : { left: "50%", top: "91%" };

  
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[35]"
      aria-hidden="true"
    >
     

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
          left: "50%",
          top: "42%",
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
  faceDown = false,
}: {
  card: CardData
  selected: boolean
  onClick: () => void
  faceDown?: boolean
}) {
  return (
    <div className="shrink-0" style={{ perspective: 1000}}>
    <motion.div
      className="relative shrink-0"
      style={{ transformStyle: 'preserve-3d' }}
      initial={{ rotateY: 180 }}
      animate={{ rotateY: faceDown ? 180 : 0 }}
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


export function DeckStack({ count = 52 }: { count?: number }) {
  if (count <= 0) return null;

  const thickness = Math.min(7, count * 0.12);

  return (
    <div
      style={{
        position: "relative",
        width: 40,
        height: 56,
        boxSizing: "border-box",

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
  const splitDuration = 0.7;
  const cardInterval = 0.065;
  const cardMoveDuration = 0.25;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[35]"
      aria-hidden="true"
    >
        {/* Shuffle stays in the center of the table */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: "42%",
          width: 40,
          height: 56,
          transform: "translate(-50%, -50%)",
        }}
      >
        {Array.from({ length: 52 }, (_, index) => {
          const leftPile = index % 2 === 0;
          const pileIndex = Math.floor(index / 2);

          const pileX = leftPile ? -65 : 65;

          // Left card, right card, left card, right card...
          const returnDelay =
            splitDuration + index * cardInterval;

          // Small offsets to make the new stack build naturally
          const stackY = -index * 0.10;

          const totalDuration =
            returnDelay + cardMoveDuration;

          return (
            <motion.div
              key={index}
              className="absolute inset-0"
              style={{
                zIndex: index,
              }}
              initial={{
                x: 0,
                y: -pileIndex * 0.12,
                rotate: 0,
              }}
              animate={{
                x: [0, pileX, pileX, 0],
                y: [
                  -pileIndex * 0.12,
                  -pileIndex * 0.12,
                  -pileIndex * 0.12,
                  stackY,
                ],
                rotate: 0,
              }}
              transition={{
                duration: totalDuration,
                times: [
                  0,
                  splitDuration / totalDuration,
                  returnDelay / totalDuration,
                  1,
                ],
                ease: "easeInOut",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 56,
                  boxSizing: "border-box",
                  background:
                    "repeating-linear-gradient(45deg, #6b1010 0px, #6b1010 3px, #9d2a23 3px, #9d2a23 6px)",
                  border: "2px solid #eee9df",
                  borderRadius: 5,
                  boxShadow: "none",
                }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}




type DrawExchangeAnimationProps = {
  phase: "discard" | "receive" | "fold";
  indexes: number[];
  opponentIndex?: number;
  cards?: CardData[];
};

export function DrawExchangeAnimation({
  phase,
  indexes,
  opponentIndex,
  cards,
}: DrawExchangeAnimationProps) {
  const discarding = phase !== "receive";
  const folding = phase === "fold";
  const isOpponent = opponentIndex !== undefined;

  const seat = isOpponent
    ? SEAT_TARGETS[opponentIndex % SEAT_TARGETS.length]
    : null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 ${
        discarding ? "z-[34]" : "z-[36]"
      }`}
      aria-hidden="true"
    >
      {indexes.map((slot, index) => {
        const spacing = isOpponent ? 16 : 36;

        const handX = isOpponent
          ? `calc(${seat!.left} + ${(slot - 2) * spacing}px)`
          : `calc(50% + ${(slot - 2) * spacing}px)`;

        const handY = isOpponent ? seat!.top : "91%";

        // Fold: flip first, pause, then move to deck.
        const travelDelay = folding
          ? 0.55 + index * 0.2
          : index * 0.16;

        const card = folding ? cards?.[slot] : undefined;

        return (
          <motion.div
            key={`${phase}-${slot}`}
            className="absolute"
            style={{
              width: 40,
              height: 56,
              perspective: 1000,
            }}
            initial={{
              left: discarding ? handX : "35%",
              top: discarding ? handY : "42%",
              x: "-50%",
              y: "-50%",
              scale: 1,
            }}
            animate={{
              left: discarding ? "35%" : handX,
              top: discarding ? "42%" : handY,
              x: "-50%",
              y: "-50%",
              scale: 1,
            }}
            transition={{
              duration: 0.42,
              delay: travelDelay,
              ease: "easeInOut",
            }}
          >
            {folding && card ? (
              // Reverse of receiving a card:
              // face up -> flip -> red back
              <motion.div
                className="relative h-full w-full"
                style={{ transformStyle: "preserve-3d" }}
                initial={{ rotateY: 0 }}
                animate={{ rotateY: 180 }}
                transition={{
                  duration: 0.35,
                  ease: "easeInOut",
                }}
              >
                {/* Front of the card */}
                <div
                  className="absolute inset-0 flex flex-col
                    items-center justify-center rounded-md
                    border-2 border-[#eee9df] bg-[#eee9df]"
                  style={{
                    backfaceVisibility: "hidden",
                    color:
                      card.suit === "♥" ||
                      card.suit === "♦" ||
                      card.suit === "hearts" ||
                      card.suit === "diamonds"
                        ? "#b4232a"
                        : "#15171d",
                  }}
                >
                  <span className="text-lg font-bold">
                    {card.rank}
                  </span>
                  <span className="text-xl">
                    {card.suit}
                  </span>
                </div>

                {/* Red back of the card */}
                <div
                  className="absolute inset-0 rounded-md"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    background:
                      "repeating-linear-gradient(45deg, #6b1010 0px, #6b1010 3px, #9d2a23 3px, #9d2a23 6px)",
                    border: "2px solid #eee9df",
                  }}
                />
              </motion.div>
            ) : (
              // Bots and opponents already show card backs
              <div
                className="h-full w-full rounded-md"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, #6b1010 0px, #6b1010 3px, #9d2a23 3px, #9d2a23 6px)",
                  border: "2px solid #eee9df",
                }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
