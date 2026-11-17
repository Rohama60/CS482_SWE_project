
export function getDealtToMe(
  dealing: boolean,
  dealStep: number,
  opponentCount: number
): number {

  if (!dealing) return 5;

  const totalPlayers = opponentCount + 1;

  return Math.max(
    0,
    Math.min(
      5,
      Math.floor(
        (dealStep - opponentCount) / totalPlayers
      ) + 1
    )
  );
}

export function getDealtToOpponent(
  dealing: boolean,
  dealStep: number,
  opponentCount: number,
  spectating: boolean,
  index: number
): number {

  if (!dealing) return 5;

  const totalPlayers =
    opponentCount + (spectating ? 0 : 1);

  if (totalPlayers === 0) return 0;

  return Math.max(
    0,
    Math.min(
      5,
      Math.floor(
        (dealStep - index) / totalPlayers
      ) + 1
    )
  );
}
