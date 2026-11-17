
import { useEffect } from "react";

type DealingTimerProps = {
  dealing: boolean;
  dealOpponentCount: number;
  spectating: boolean;
  setDealing: (value: boolean) => void;
  setDealStep: (value: number) => void;
  setShuffling: (value: boolean) => void;
};

const SHUFFLE_DURATION = 4500;
const CARD_INTERVAL = 340;

export function useDealingTimer({
  dealing,
  dealOpponentCount,
  spectating,
  setDealing,
  setDealStep,
  setShuffling,
}: DealingTimerProps) {

  useEffect(() => {
    if (!dealing) return;

    const reducedMotion =
      typeof window.matchMedia !== "function" ||
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (reducedMotion) {
      setShuffling(false);
      setDealStep(-1);
      setDealing(false);
      return;
    }

    const totalPlayers =
      dealOpponentCount + (spectating ? 0 : 1);

    if (totalPlayers <= 0) {
      setShuffling(false);
      setDealing(false);
      return;
    }

    let nextStep = 0;
    let dealTimer: number | undefined;

    // First, allow the shuffle animation to play
    const shuffleTimer = window.setTimeout(() => {

      // Shuffle is finished
      setShuffling(false);

      // Now begin dealing cards
      dealTimer = window.setInterval(() => {

        if (nextStep >= totalPlayers * 5) {
          window.clearInterval(dealTimer);
          setDealing(false);
          setDealStep(-1);
          return;
        }

        setDealStep(nextStep);
        nextStep++;

      }, CARD_INTERVAL);

    }, SHUFFLE_DURATION);

    // Clean up timers if the component unmounts
    return () => {
      window.clearTimeout(shuffleTimer);
      window.clearInterval(dealTimer);
    };

  }, [
    dealing,
    dealOpponentCount,
    spectating,
    setDealing,
    setDealStep,
    setShuffling,
  ]);
}
