import type { PokerTableData } from "./TableCreation";
import { useState, useEffect } from "react";
import { getGuest } from "../guestSession";
import { socket } from "../socket";
import { TableChat } from "../components/TableChat.tsx";
import {authClient } from "../AuthClient.ts";
const STAKE_LABELS: Record<string, string> = { low: 'Low Stakes', medium: 'Mid Stakes', high: 'High Stakes' }


type CardData = { rank: string; suit: string }

function BetChips({ amount, position, tone = 'red' }: { amount: string; position: string; tone?: 'red' | 'black' | 'cream' }) {
  const colors = {
    red: { face: '#c0392b', edge: '#f0a097' },
    black: { face: '#161820', edge: '#9ca0ad' },
    cream: { face: '#e8e4dc', edge: '#8b1a1a' },
  }[tone]

  return (
  <div className={`z-20 flex items-center gap-1.5 rounded-full px-2 py-1 ${position}`} style={{ background: 'rgba(8,8,10,0.62)', border: '1px solid rgba(232,228,220,0.12)' }}>
    <div className="relative h-6 w-7">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="absolute left-0 h-5 w-5 rounded-full border-2"
            style={{ bottom: `${i * 3}px`, background: colors.face, borderColor: colors.edge, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          />
        ))}
      </div>
      <span className="text-xs font-bold" style={{ color: '#e8e4dc' }}>{amount}</span>
    </div>
  )
}

function PlayerSeat({
  name,
  chips,
  position,
  dealer = false,
  active = false,
  empty = false,
  showCards = false,
  blindLabel = '',
  blindAmount = 0,
  betAmount = 0
}: {
  name: string
  chips?: string
  position: string
  dealer?: boolean
  active?: boolean
  empty?: boolean
  showCards?: boolean
  blindLabel?: string
  blindAmount?: number
  betAmount?: number
  
}) {
  return (
    <div className={`absolute z-20 flex flex-col items-center ${position}`}>
      <div
        className="absolute top-7 h-20 w-24 rounded-t-[2rem] border-2 shadow-2xl"
        style={{
          background: active ? 'linear-gradient(145deg, #8b1a1a, #350707)' : 'linear-gradient(145deg, #4b1212, #1d090a)',
          borderColor: active ? '#c0392b' : '#691d1a',
          boxShadow: 'inset 0 0 18px rgba(0,0,0,0.55), 0 12px 24px rgba(0,0,0,0.55)',
        }}
      >
        <span className="absolute -left-2 bottom-1 h-7 w-3 rounded-full" style={{ background: '#2b0a0b', border: '1px solid #691d1a' }} />
        <span className="absolute -right-2 bottom-1 h-7 w-3 rounded-full" style={{ background: '#2b0a0b', border: '1px solid #691d1a' }} />
      </div>
      {!empty && showCards && (
        <div className="relative z-10">
            <CardBacks />
        </div>
        )}
      <div
        className="relative z-10 -mt-1 min-w-28 rounded-xl px-3 py-2 text-center shadow-xl"
        style={{
          background: active ? 'linear-gradient(135deg, #6b1010, #450a0a)' : '#17191f',
          border: `1px solid ${active ? '#c0392b' : '#343743'}`,
        }}
      >
        {dealer && (
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: '#eee9df', color: '#15171d' }}>
            D
          </span>
        )}
        {empty ? (
          <span className="text-xs font-medium" style={{ color: '#e8e4dc', opacity: 0.35 }}>Open seat</span>
        ) : (
          <>
            <p className="truncate text-xs font-semibold" style={{ color: '#e8e4dc' }}>{name}</p>
            {blindLabel && (
            <p
                className="mt-1 text-[0.65rem] font-bold"
                style={{ color: '#fbbf24' }}
            >
                {blindLabel} · ${blindAmount}
            </p>
        )}
            <p className="mt-0.5 text-xs" style={{ color: active ? '#f0a097' : '#e8e4dc', opacity: active ? 1 : 0.45 }}>{chips}</p>
          </>
        )}
      </div>

      {!empty && betAmount > 0 && (
        <div className="relative z-20 mt-3 -translate-y-4">
          <BetChips
            amount={`$${betAmount}`}
            position="relative"
            tone="red"
          />
        </div>
      )}
    </div>
  )
}


function PlayingCard({
  card,
  selected = false,
  onClick,
}: {
  card: CardData
  selected?: boolean
  onClick?: () => void
}) {
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <button
      onClick={onClick}
      className={`relative flex h-28 w-20 shrink-0 flex-col justify-between rounded-xl p-2.5 text-left shadow-2xl transition-all duration-200 sm:h-32 sm:w-24 ${
        selected ? '-translate-y-4' : 'hover:-translate-y-1'
      }`}
      style={{
        background: 'linear-gradient(145deg, #fffdf8, #ded9cf)',
        border: selected ? '2px solid #e05c4e' : '2px solid rgba(255,255,255,0.5)',
        color: red ? '#b4232a' : '#15171d',
        boxShadow: selected ? '0 16px 30px rgba(192,57,43,0.35)' : '0 14px 28px rgba(0,0,0,0.45)',
      }}
      aria-pressed={selected}
      aria-label={`${card.rank} of ${card.suit}; ${selected ? 'selected to discard' : 'keep'}`}
    >
      <span className="text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{card.rank}</span>
      <span className="self-center text-3xl leading-none">{card.suit}</span>
      <span className="rotate-180 self-end text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{card.rank}</span>
    </button>
  )
}

function CardBacks({ count = 5 }: { count?: number }) {
  return (
    <div className="flex -space-x-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-10 w-7 rounded border p-0.5 shadow-lg"
          style={{
            background: '#eee9df',
            borderColor: '#0a0a0b',
            transform: `rotate(${(i - 2) * 4}deg)`,
          }}
        >
          <div className="h-full w-full rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, #6b1010 0 3px, #9d2a23 3px 6px)' }} />
        </div>
      ))}
    </div>
  )
}
type PokerTableProps = {
  table: PokerTableData;
  onLeave: () => void;
  spectating?: boolean;
  onTakeSeat?: () => void;
  isHost?: boolean;
};

type TableSeat = {
  kind: 'user' | 'guest';
  refId: string;
  displayName: string;
  ready?: boolean;
  isHost?: boolean;
};

type GameState = {
    _id: string;
    smallBlind: number;
    bigBlind: number;
    smallBlindPlayerId: string;
    bigBlindPlayerId: string;
    currentBet: number;
    currentTurn: string;
    playerBets: Record<string, number>;
    potSize: number;
    round: string;
    //filled in by the server once bots/betting are in play
    participants?: ServerPlayer[];
    legal?: LegalActions;
    myHand?: {rank: string; suit: string}[] | null;
    myTurnToDraw? : boolean;
    winners?: { refId: string; amount: number; handName: string | null }[];
    resultText?: string;
    revealedHands?: Record<string, {rank: string; suit: string}[]>;
};

type ServerPlayer = { refId: string; displayName: string; isBot: boolean; chips: number; folded: boolean; allIn: boolean; bet: number };
type LegalActions = { canAct: boolean; toCall?: number; canCheck?: boolean; canCall?: boolean; canRaise?: boolean; minRaise?: number; maxRaise?: number };
const SERVER_ROUNDS = ['betting1', 'drawing', 'betting2', 'finished'];
const SUIT_SYMBOLS: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const ROUND_LABELS: Record<string, string> = { betting1: 'First betting round', drawing: 'Draw', betting2: 'Final betting round', finished: 'Hand over' };

export function PokerTable({table,onLeave,spectating = false,onTakeSeat,isHost}: PokerTableProps) {
  const seatOpen = table.players < table.max
  const watcherCount = table.spectators?.length ?? 1
  const [selected, setSelected] = useState<number[]>([])
  const [hand, setHand] = useState<CardData[]>([])
  const [gameStarted, setGameStarted] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [gameId, setGameId] = useState<string | null>(null)
  const [chipBalance, setChipBalance] = useState<number | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [players, setPlayers] = useState<TableSeat[]>([])
  const [raiseBy, setRaiseBy] = useState(0)
  const [busy, setBusy] = useState(false)
  const [readyPending, setReadyPending] = useState(false);
  const [readyError, setReadyError] = useState('');
  const { data: session } = authClient.useSession();
  const currentPlayer = players.find(player =>
    player.kind === 'user'
        ? player.displayName === session?.user?.name
        : player.refId === getGuest()?.id
);

const otherPlayers = players.filter(player =>
    player.refId !== currentPlayer?.refId
);


const host =
  !spectating &&
  currentPlayer?.kind === 'user' &&
  table.host != null &&
  String(currentPlayer.refId) === String(table.host);


const myReady = Boolean(currentPlayer?.ready);

const tableHostId =
  (table as PokerTableData & { host?: string | null }).host;

const otherSeatedPlayers = players.filter(
  player => String(player.refId) !== String(table.host)
);
const everyoneReady =
  host &&
  !!currentPlayer &&
  players.length + (table.bots ?? 0) >= 2 &&
  otherSeatedPlayers.every(player => player.ready === true);

function handleReady() {
  if (spectating || host || !currentPlayer || myReady || readyPending) {
    return;
  }

  setReadyError('');
  setReadyPending(true);

  socket.timeout(5000).emit(
    'table:set-ready',
    {
      tableId: table.id,
      ready: true
    },
    (err: Error | null, result?: { ok: boolean; error?: string }) => {
      setReadyPending(false);

      if (err || !result?.ok) {
        setReadyError(
          result?.error ?? 'Could not mark you ready. Please try again.'
        );
      }
    }
  );
}
// Current player's betting information
const myPlayerId = currentPlayer?.refId;

const myBet = myPlayerId
    ? game?.playerBets?.[String(myPlayerId)] ?? 0
    : 0;

const currentBet = game?.currentBet ?? 0;

// Additional chips needed to match the highest bet
const amountToCall = Math.max(0, currentBet - myBet);

// Determine which buttons to display
const needsToCall = amountToCall > 0;

// Only allow betting controls on the player's turn
const isMyTurn =
    !!myPlayerId &&
    game?.currentTurn === String(myPlayerId);
    
// Bot game(server-run hand: bots, betting,real draw)

const serverMode = !!game && SERVER_ROUNDS.includes(game.round) && Array.isArray(game.participants);
const serverPlayerId = !spectating
  ? (myPlayerId ?? game?.participants?.find(player => !player.isBot)?.refId)
  : undefined;
const me = serverMode ? game!.participants!.find(p => String(p.refId) === String(serverPlayerId)) : undefined;
const opponents = serverMode ? game!.participants!.filter(p => String(p.refId) !== String(serverPlayerId)) : [];
const myTurn = serverMode && String(game!.currentTurn) === String(serverPlayerId) && !spectating;
const legal = game?.legal;
const champions = serverMode
  ? (game!.winners ?? []).map(winner => ({
      ...winner,
      player: game!.participants!.find(player => player.refId === winner.refId),
      cards: game!.revealedHands?.[winner.refId] ?? [],
    }))
  : [];

function guestHeaders(): Record<string, string> {
  const guest = getGuest();
  return guest
    ? { 'x-guest-id': guest.id, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function applyServerGame(g: GameState) {
  setGame(g);
  if (g.myHand) {
    setHand(g.myHand.map(c => ({ rank: c.rank, suit: SUIT_SYMBOLS[c.suit] ?? c.suit })));
  }
  setSelected([]);
}

async function refreshGame(id: string) {
  try {
    const response = await fetch(`/api/bot-games/${id}`, { credentials: 'include', headers: guestHeaders() });
    const data = await response.json();
    if (response.ok && data.game) {
      applyServerGame(data.game);
      void fetchMyChips();
    }
  } catch (e) {
    console.error('Could not refresh game', e);
  }
}

async function sendToGame(path: 'action' | 'draw', body: object) {
  if (!gameId || busy) return;
  setBusy(true);
  setError('');
  try {
    const response = await fetch(`/api/bot-games/${gameId}/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: guestHeaders(),
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'That move was not allowed');
    applyServerGame(data.game);
    await fetchMyChips();
  } catch (e) {
    setError(e instanceof Error ? e.message : 'That move was not allowed');
  } finally {
    setBusy(false);
  }
}
  const PLAYER_POSITIONS = [
    "left-1/2 top-4 -translate-x-1/2",
    "right-3 top-[27%] sm:right-8",
    "right-4 bottom-[24%] sm:right-10",
    "left-4 bottom-[24%] sm:left-10",
    "left-3 top-[27%] sm:left-8"
];

async function fetchMyChips() {
    try {
        const guest = getGuest();

        const response = await fetch('/api/players/me/chips', {
            credentials: 'include',
            headers: guest
                ? { 'x-guest-id': guest.id }
                : {}
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch chips');
        }

        setChipBalance(data.chipamount);

    } catch (error) {
        console.error('Error fetching chips:', error);
    }
   
}
useEffect(() => {
    void fetchMyChips();
  }, []);



async function fetchMyHand(id: string) {
    try {
        const guest = getGuest();

        const response = await fetch(`/api/games/${id}/hand`, {
            credentials: 'include',
            headers: guest
                ? { 'x-guest-id': guest.id }
                : {}
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to retrieve cards');
        }

        const suitSymbols: Record<string, string> = {
            hearts: '♥',
            diamonds: '♦',
            clubs: '♣',
            spades: '♠'
        };

        setHand(data.cards.map((card: CardData) => ({
            rank: card.rank,
            suit: suitSymbols[card.suit] ?? card.suit
        })));

    } catch (error) {
        console.error('Error fetching hand:', error);
        setError('Could not load your cards');
    }
}
  async function handleStartGame() {
    if (
      isStarting ||
      (!gameStarted && (!host || !everyoneReady || spectating))
    ) {
      return;
    }

    setIsStarting(true);

      try {
          const response = await fetch('/api/bot-games', {
              method: 'POST',
              headers: guestHeaders(),
              credentials: 'include',
              body: JSON.stringify({ 
                  tableId: table.id 
                })
              })

          const data = await response.json()

          if (!response.ok) {
              throw new Error(data.message || data.error || 'Failed to start game')
          }
          setGameId(data.game._id);
          applyServerGame(data.game);
          setPlayers(data.seats ?? []);
          setGameStarted(true);
          await fetchMyChips();
          console.log('Game started with ID:', data.game._id)

      } catch (error) {
        setError(
          error instanceof Error
          ? error.message
          : 'Unable to start game'
        )

      } finally {
          setIsStarting(false)
      }
  }
  function toggleCard(index: number) {
   if (complete || spectating || game?.round !== 'drawing') {
        return;
    }

    setSelected(current =>
        current.includes(index)
            ? current.filter(i => i !== index)
            : [...current, index]
    );
  }

  function draw() {
    if (!myTurn || busy) return;
    void sendToGame('draw', { discard: selected });
  }

  function newHand() {
    setHand([])
    setSelected([])
    setComplete(false)
  }
  async function handleLeaveTable() {
    console.log('1. Leave button')
    if(spectating) {
      onLeave();
      return;
    }
    try {
        const guest = getGuest();
        console.log('2. Guest info:', guest);
        const response = await fetch(`/api/tables/${table.id}/leave`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                guestId: guest?.id
            })
        });
        
        console.log('3. Backend response status:', response.status);

        const data = await response.json();

        console.log('4. Backend response:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Failed to leave table');
        }

        console.log('Player removed from table:', data);

        // Return to the lobby after successful removal
        onLeave();

    } catch (error) {
        console.error('Error leaving table:', error);
    }
}
useEffect(() => {
    let active = true;
    let requestNumber = 0;

    async function fetchPlayers() {
        const currentRequest = ++requestNumber;

        try {
            const response = await fetch(`/api/tables/${table.id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch table players');
            }

            const data = await response.json();
            console.log('TABLE ID:', table.id);
            console.log('ALL SEATS FROM DATABASE:', data.seats);

            console.log('Fetched players:', data.seats);

            if (active && currentRequest === requestNumber) {
                setPlayers(data.table?.seats ?? data.seats  ?? []);
            }

        } catch (error) {
            console.error('Error fetching players:', error);
        }

    }

   const handleTableUpdated = (updatedTable: { seats: TableSeat[] }) => {
    console.log('Real-time table update:', updatedTable);
    
    requestNumber++; // Invalidate any ongoing fetch requests
    setPlayers(updatedTable.seats || []);
    };

    socket.on('table-updated', handleTableUpdated);
    // Listen for the host starting the game
    const handleGameStarted = (data: {
    gameId: string;
    game: GameState;
    }) => {
      console.log('Game started:', data.gameId);

      setGameId(data.gameId);
      setGame(data.game);
      setGameStarted(true);

      if (!spectating) {
        // Bot games send a full private view; older games load the hand seprately
          if(data.game.participants) void refreshGame(data.gameId);
          else void fetchMyHand(data.gameId);
          void fetchMyChips();
      }
  };

  // Bots and other players move on the server: reload our private view
    
    const handleGameUpdated = (data: { gameId: string;}) => {
      if (!spectating) void refreshGame(data.gameId);
    };

    socket.on('game-updated', handleGameUpdated);

    socket.on('game-started', handleGameStarted);

    const handleConnect = () => {
      console.log('Socket connected:', socket.id);

      socket.emit('join-table-room', table.id);

    fetchPlayers();
  };

  socket.on('connect', handleConnect);

  if (socket.connected) {
    handleConnect();
  } else {
    socket.connect();
  }
    fetchPlayers();

    return () => {
        active = false;

        socket.off('table-updated', handleTableUpdated);
        socket.off('game-started', handleGameStarted);
        socket.off('game-updated', handleGameUpdated); 
        socket.off('connect', handleConnect);

        socket.emit('leave-table-room', table.id);
    };

}, [table.id, spectating]);
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#090a0c' }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(90,10,10,0.3), transparent 72%)' }} />
      <header className="relative z-40 flex items-center justify-between border-b px-4 py-3 sm:px-6" style={{ background: 'rgba(10,10,11,0.9)', borderColor: '#222430', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-4">
          <button onClick={handleLeaveTable}  className="rounded-lg px-3 py-2 text-xs font-semibold hover:brightness-125" style={{ 
            backgroundColor: '#1c1e25',
                border: 'none',
                color: '#fff' }}>
            {spectating ? '← Stop watching' : '← Leave table'}
          </button>
          <div className="hidden h-5 w-px sm:block" style={{ background: '#2a2d38' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>{table.name}</p>
            <p className="hidden text-xs sm:block" style={{ color: '#e8e4dc', opacity: 0.35 }}>5-card draw · Blinds {table.blind}</p>
          </div>
          {/* P7: only the host's copy of the table includes the code, so only the host sees this */}
          {table.isPrivate && table.inviteCode && (
            <div className="rounded-lg px-3 py-1.5" style={{ background: '#1c1e25', border: '1px dashed rgba(192,57,43,0.6)' }} title="Share this code so friends can join">
              <p className="text-[0.6rem] font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Invite code</p>
              <p className="text-sm font-bold" style={{ color: '#e8e4dc', letterSpacing: '0.18em' }}>{table.inviteCode}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>Your total balance</p>
          <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>
              {chipBalance !== null ? `$${chipBalance}` : 'Loading...'}
          </p>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all hover:brightness-125"
            style={{ background: '#1c1e25', border: '1px solid #c0392b', color: '#e8e4dc' }}
            aria-label="How to play"
            title="How to play"
          >
            ?
          </button>
         
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl gap-5 px-3 py-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: '#4ade80' }} />
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: '#e8e4dc', opacity: 0.45 }}>Hand in progress</span>
            </div>
            <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>Hand #143</span>
          </div>

          <div className="relative min-h-[36rem] overflow-hidden rounded-[2rem] border sm:min-h-[40rem]" style={{ background: '#111318', borderColor: '#292c35' }}>
            <div className="absolute inset-x-[8%] bottom-[19%] top-[14%] rounded-[48%] border-[10px] shadow-2xl sm:inset-x-[12%]" style={{ background: 'radial-gradient(ellipse at center, #8f231f 0%, #681512 58%, #3b0909 100%)', borderColor: '#160607', boxShadow: 'inset 0 0 70px rgba(0,0,0,0.48), 0 25px 60px rgba(0,0,0,0.7), 0 0 0 3px #7b2a24, 0 0 0 8px #260909' }}>
              <div className="absolute inset-4 rounded-[48%] border" style={{ borderColor: 'rgba(232,228,220,0.08)' }} />
              
              
              
            {gameStarted && (
            <>
              <p
                className="text-xs uppercase tracking-[0.3em]"
                style={{ color: '#e8e4dc', opacity: 0.5 }}
              >
                Current pot
              </p>

              <p
                className="mt-1 text-3xl font-semibold"
                style={{ color: '#e8e4dc' }}
              >
                ${game?.potSize ?? 0}
              </p>

              {serverMode && (
                <p
                  className="mt-1 text-xs"
                  style={{ color: '#e8e4dc', opacity: 0.55 }}
                >
                  {ROUND_LABELS[game!.round]}
                  {game!.round === 'finished' && game!.resultText
                    ? ` · ${game!.resultText}`
                    : ''}
                </p>
              )}
            </>
          )}              
              
            </div>
            {!gameStarted && !spectating && (
                <div
                  className="absolute left-1/2 top-[28%] z-30 w-[min(90%,24rem)] -translate-x-1/2 rounded-2xl border p-5 text-center shadow-2xl"
                  style={{
                    background: 'rgba(20,22,27,0.96)',
                    borderColor: 'rgba(251,191,36,0.7)'
                  }}
                >
                  <p
                    className="text-[0.65rem] font-bold uppercase tracking-[0.25em]"
                    style={{ color: '#fbbf24' }}
                  >
                    Ready to Play?
                  </p>

                  <p
                    className="mt-2 text-xs"
                    style={{ color: '#e8e4dc', opacity: 0.7 }}
                  >
                    {host
                      ? `${otherSeatedPlayers.filter(p => p.ready).length} / ${otherSeatedPlayers.length} other players ready`
                      : myReady
                        ? 'You are ready. The host will start the game.'
                        : 'Press Ready when you are ready to play.'}
                  </p>

                  {host ? (
                    <button
                      type="button"
                      onClick={() => void handleStartGame()}
                      disabled={!everyoneReady || isStarting}
                      className="mt-4 w-full rounded-xl px-7 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        background: everyoneReady ? '#15803d' : '#475569'
                      }}
                    >
                      {isStarting
                        ? 'Starting...'
                        : everyoneReady
                          ? 'Start'
                          : 'Waiting for others...'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleReady}
                      disabled={myReady || readyPending || !currentPlayer}
                      className="mt-4 w-full rounded-xl px-7 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        background: myReady ? '#475569' : '#15803d'
                      }}
                    >
                      {myReady
                        ? 'Waiting for Host...'
                        : readyPending
                          ? 'Marking ready...'
                          : 'Ready'}
                    </button>
                  )}

                  {(error || readyError) && (
                    <p className="mt-3 text-xs text-red-400">
                      {error || readyError}
                    </p>
                  )}
                </div>
              )}
            {serverMode && game!.round === 'finished' && champions.length > 0 && (
              <div
                className="absolute left-1/2 top-1/2 z-30 w-[min(90%,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-4 text-center shadow-2xl"
                style={{ top: '20%', background: 'rgba(20,22,27,0.94)', borderColor: 'rgba(251,191,36,0.7)' }}
              >
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em]" style={{ color: '#fbbf24' }}>
                  {champions.length === 1 ? 'Winner' : 'Champions'}
                </p>
                {champions.map(champion => (
                  <div key={champion.refId} className="mt-2">
                    <p className="text-lg font-bold" style={{ color: '#e8e4dc' }}>
                      {champion.player?.displayName ?? 'Winner'}
                    </p>
                    <p className="text-sm" style={{ color: '#f0a097' }}>
                      {champion.handName ?? 'Won uncontested'} · ${champion.amount}
                    </p>
                    {champion.cards.length > 0 && (
                      <div className="mt-3 flex justify-center gap-1.5">
                        {champion.cards.map((card, index) => (
                          <span
                            key={`${card.rank}-${card.suit}-${index}`}
                            className="rounded-md px-2 py-1 text-xs font-bold"
                            style={{
                              background: '#eee9df',
                              color: card.suit === 'hearts' || card.suit === 'diamonds' ? '#b4232a' : '#15171d',
                            }}
                          >
                            {card.rank}{SUIT_SYMBOLS[card.suit] ?? card.suit}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            
{serverMode && opponents.map((player, index) => {
  const isSmallBlind =
    String(game!.smallBlindPlayerId) === String(player.refId);

  const isBigBlind =
    String(game!.bigBlindPlayerId) === String(player.refId);

  return (
    <PlayerSeat
      key={player.refId}
      name={`${player.displayName}${player.folded ? ' · folded' : player.allIn ? ' · all-in' : ''}`}
      chips={`$${player.chips}`}
      dealer={false}
      active={String(game!.currentTurn) === String(player.refId)}
      position={PLAYER_POSITIONS[index % PLAYER_POSITIONS.length]}
      showCards={!player.folded}
      blindLabel={
        isSmallBlind
          ? 'Small Blind (SB)'
          : isBigBlind
            ? 'Big Blind (BB)'
            : ''
      }
      blindAmount={
        isSmallBlind
          ? game!.smallBlind
          : isBigBlind
            ? game!.bigBlind
            : 0
      }
      betAmount={game!.playerBets?.[String(player.refId)] ?? player.bet ?? 0}
    />
  );
})}


            {!serverMode && otherPlayers.map((player, index) => {
    const isSmallBlind =
        game?.smallBlindPlayerId === String(player.refId);

    const isBigBlind =
        game?.bigBlindPlayerId === String(player.refId);

        return (
            <PlayerSeat
                key={`${player.kind}-${player.refId}`}
                name={player.displayName}
                chips={`$${500 - (
                    isSmallBlind
                        ? game?.smallBlind ?? 0
                        : isBigBlind
                            ? game?.bigBlind ?? 0
                            : 0
                )}`}
                dealer={index === 0}
                active={game?.currentTurn === String(player.refId)}
                position={PLAYER_POSITIONS[index % PLAYER_POSITIONS.length]}
                showCards={gameStarted}
                blindLabel={
                    isSmallBlind
                        ? 'Small Blind (SB)'
                        : isBigBlind
                            ? 'Big Blind (BB)'
                            : ''
                }
                blindAmount={
                    isSmallBlind
                        ? game?.smallBlind ?? 0
                        : isBigBlind
                            ? game?.bigBlind ?? 0
                            : 0
                }
            />
        );
    })}
    {serverMode && me &&
  (game!.playerBets?.[String(me.refId)] ?? me.bet ?? 0) > 0 && (
    <div
      className="absolute left-1/2 z-30"
      style={{
        bottom: '35%',
        transform: 'translateX(-50%)'
      }}
    >
      <BetChips
        amount={`$${game!.playerBets?.[String(me.refId)] ?? me.bet ?? 0}`}
        position="relative"
        tone="cream"
      />
    </div>
)}
    <div className="absolute inset-x-0 bottom-3 z-30 flex flex-col items-center">
  
              <div
                className="absolute -bottom-8 h-36 w-72 rounded-t-[4rem] border-2"
                style={{
                  background: 'linear-gradient(145deg, #6b1010, #260909)',
                  borderColor: '#9d2a23',
                  boxShadow: 'inset 0 0 28px rgba(0,0,0,0.55), 0 15px 30px rgba(0,0,0,0.65)',
                }}
              />
              <div className="relative z-10 mb-2 flex items-end justify-center -space-x-1 sm:space-x-1">
                {spectating ? (
                  gameStarted ? <CardBacks count={5} /> : null
                ) : gameStarted && hand.length > 0 ? (
                   hand.map((card, index) => (
                  <PlayingCard key={`${card.rank}${card.suit}${index}`} card={card} selected={selected.includes(index)} onClick={() => toggleCard(index)} />
                ))
              ) : (
                <p className="text-sm font-semibold" style={{ color: '#e8e4dc'}}>
                  Waiting for cards...</p>
              )}
              </div>
              <div
              className="relative z-10 rounded-xl px-6 py-2 shadow-xl"
              style={{
                background: '#17191f',
                border: '1px solid #c0392b',
                width: '260px'
              }}
            >
              {/* Name and balance in the same row */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-semibold"
                  style={{ color: '#e8e4dc' }}
                >
                  {currentPlayer?.displayName || 'You'}
                </span>

                <span
                  className="text-xs font-semibold"
                  style={{ color: '#e8e4dc' }}
                >
                  {chipBalance !== null ? `$${chipBalance}` : 'Loading...'}
                </span>
              </div>

              {/* Blind label below the name */}
              <div className="text-left">
                {game?.smallBlindPlayerId != null &&
                  serverPlayerId != null &&
                  String(game.smallBlindPlayerId) === String(serverPlayerId) && (
                    <span
                      className="text-[0.65rem] font-bold"
                      style={{ color: '#fbbf24' }}
                    >
                      Small Blind · ${game.smallBlind}
                    </span>
                  )}

                {game?.bigBlindPlayerId != null &&
                  serverPlayerId != null &&
                  String(game.bigBlindPlayerId) === String(serverPlayerId) && (
                    <span
                      className="text-[0.65rem] font-bold"
                      style={{ color: '#fbbf24' }}
                    >
                      Big Blind · ${game.bigBlind}
                    </span>
                  )}
              </div>
            </div>
            </div>
          </div>

          {spectating ? (
            /* P3: what a spectator sees instead of their own hand and buttons */
            <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-2xl border p-3 sm:flex-row" style={{ background: '#14161b', borderColor: '#292c35' }}>
              <div className="flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: 'rgba(192,57,43,0.16)', border: '1px solid rgba(192,57,43,0.45)', color: '#f0a097' }}>
                  👁
                </div>
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Spectating</p>
                  <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>
                    {seatOpen ? `${table.max - table.players} seat${table.max - table.players === 1 ? '' : 's'} open` : 'Table is full'}
                  </p>
                  <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                    {watcherCount} watching · players' cards stay hidden
                  </p>
                </div>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  className="w-full rounded-xl px-7 py-3 text-sm font-semibold transition-all hover:brightness-110 sm:w-auto"
                  style={{ background: seatOpen ? 'linear-gradient(135deg, #c0392b, #8b1a1a)' : '#1c1e25', color: seatOpen ? '#fff' : '#e8e4dc', opacity: seatOpen ? 1 : 0.4, cursor: seatOpen ? 'pointer' : 'not-allowed' }}
                  disabled={!seatOpen}
                  onClick={onTakeSeat}
                >
                  {seatOpen ? 'Take a Seat' : 'No seats open'}
                </button>
              </div>
            </div>
          ) : serverMode ? (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: '#14161b', borderColor: '#292c35' }}>
            <div className="px-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>{ROUND_LABELS[game!.round]}</p>
              <p className="text-sm font-semibold" style={{ color: game!.round === 'finished' ? '#4ade80' : '#e8e4dc' }}>
                {game!.round === 'finished'
                  ? (game!.resultText || 'Hand over')
                  : myTurn
                    ? (game!.round === 'drawing' ? 'Your turn: pick cards to replace' : legal?.canCall ? `Your turn: $${legal.toCall} to call` : 'Your turn: check or bet')
                    : me?.folded ? 'You folded' : `Waiting for ${game!.participants!.find(p => p.refId === game!.currentTurn)?.displayName ?? 'other players'}...`}
              </p>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {game!.round === 'finished' ? (
                <button className="w-full rounded-xl px-7 py-3 text-sm font-semibold transition-all hover:brightness-110 sm:w-auto" style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }} onClick={handleStartGame} disabled={isStarting}>
                  {isStarting ? 'Dealing...' : 'Deal next hand'}
                </button>
              ) : game!.round === 'drawing' ? (
                <>
                  <button disabled={!myTurn || busy} className="flex-1 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-40 sm:flex-none" style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }} onClick={() => { setSelected([]); void sendToGame('draw', { discard: [] }) }}>
                    Stand pat
                  </button>
                  <button disabled={!myTurn || busy} className="flex-1 rounded-xl px-7 py-3 text-sm font-semibold disabled:opacity-40 sm:flex-none" style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }} onClick={draw}>
                    {selected.length ? `Draw ${selected.length}` : 'Draw'}
                  </button>
                </>
              ) : (
                <>
                  
                  {myTurn && legal?.canRaise && (
                    <>
                      <input type="number" aria-label="Raise amount" min={legal.minRaise} max={legal.maxRaise} step={legal.minRaise}
                        value={raiseBy || legal.minRaise} onChange={e => setRaiseBy(Number(e.target.value))}
                        className="w-24 rounded-lg px-3 py-2 text-sm" style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }} />
                      <button disabled={busy} className="rounded-xl px-6 py-3 text-sm font-semibold" style={{ background: '#B45309', border: '1px solid #343743', color: '#e8e4dc' }}
                        onClick={() => void sendToGame('action', { type: 'raise', amount: raiseBy || legal.minRaise })}>
                        Raise
                      </button>
                    </>
                  )}
                  {legal?.canCall
                    ? <button disabled={!myTurn || busy} className="rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40" style={{ background: '#15803D', border: '1px solid #343743', color: '#e8e4dc' }} onClick={() => void sendToGame('action', { type: 'call' })}>Call ${legal.toCall}</button>
                    : <button disabled={!myTurn || busy} className="rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40" style={{ background: '#475569', border: '1px solid #343743', color: '#e8e4dc' }} onClick={() => void sendToGame('action', { type: 'check' })}>Check</button>}
                  <button disabled={!myTurn || busy} className="rounded-xl px-4 py-3 text-sm font-semibold  hover:brightness-110 disabled:opacity-40" style={{ background: '#b81010', border: '1px solid #343743', color: '#e8e4dc' }} onClick={() => void sendToGame('action', { type: 'fold' })}>Fold</button>

                </>
              )}
            </div>
          </div>
           ) : gameStarted ? (
          <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-2xl border p-3 sm:flex-row" style={{ background: '#14161b', borderColor: '#292c35' }}>
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: 'rgba(192,57,43,0.16)', border: '1px solid rgba(192,57,43,0.45)', color: '#f0a097' }}>
                ♠
              </div>
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Your hand</p>
                <p className="text-sm font-semibold" style={{ color: complete ? '#4ade80' : '#e8e4dc' }}>
                  {complete ? 'Three of a kind — Aces' : 'One pair — Aces'}
                </p>
                <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                  {complete
                    ? 'Three aces with a king kicker'
                    : selected.length
                      ? `${selected.length} cards marked to discard`
                      : 'A pair of aces with a 10 kicker'}
                </p>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
             
              {game?.round === 'betting1' ? (
                isMyTurn ? (
                    <>
                        {needsToCall ? (
                            // SCENARIO 1: Player needs to call
                            <button
                                className="flex-1 rounded-xl px-6 py-3 text-sm font-semibold sm:flex-none hover:brightness-110"
                                style={{
                                    background: '#15803D',
                                    border: '1px solid #343743',
                                    color: '#e8e4dc'
                                }}
                                onClick={() => console.log('Call')}
                            >
                                Call ${amountToCall}
                            </button>
                        ) : (
                            // SCENARIO 2: Player can check
                            <button
                                className="flex-1 rounded-xl px-6 py-3 text-sm font-semibold sm:flex-none hover:brightness-110"
                                style={{
                                    background: '#475569',
                                    border: '1px solid #343743',
                                    color: '#e8e4dc'
                                }}
                                onClick={() => console.log('Check')}
                            >
                                Check
                            </button>
                        )}

                        {/* Raise is available in both scenarios */}
                        <button
                            className="flex-1 rounded-xl px-7 py-3 text-sm font-semibold sm:flex-none hover:brightness-110"
                            style={{
                                background: '#B45309',
                                border: '1px solid #343743',
                                color: '#e8e4dc'
                            }}
                            onClick={() => console.log('Raise')}
                        >
                            Raise
                        </button>

                        {/* Fold is available in both scenarios */}
                        <button
                            className="flex-1 rounded-xl px-7 py-3 text-sm font-semibold sm:flex-none hover:brightness-110"
                            style={{
                                background: 'linear-gradient(135deg, #c0392b, #8b1a1a)',
                                border: '1px solid #343743',
                                color: '#e8e4dc'
                            }}
                            onClick={() => console.log('Fold')}
                        >
                            Fold
                        </button>
                    </>
                ) : (
                    <span
                        className="text-sm"
                        style={{ color: '#e8e4dc', opacity: 0.6 }}
                    >
                        Waiting for another player...
                    </span>
                )
            ) : game?.round === 'drawing' ? (
                <button
                    className="flex-1 rounded-xl px-7 py-3 text-sm font-semibold transition-all hover:brightness-110 sm:flex-none"
                    style={{
                        background: 'linear-gradient(135deg, #c0392b, #8b1a1a)',
                        color: '#fff'
                    }}
                    onClick={draw}
                >
                    {selected.length ? `Draw ${selected.length}` : 'Stand Pat'}
                </button>
            ) : null}
            </div>
          </div>
          ) : null }
        </div>

        <aside className="hidden w-60 shrink-0 flex-col gap-4 lg:flex">
          <div className="rounded-2xl border p-5" style={{ background: '#14161b', borderColor: '#292c35' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Table details</p>
            <div className="mt-4 space-y-3">
              {[['Game', '5-card draw'], ['Stakes', STAKE_LABELS[table.stakes]], ['Blinds', table.blind], ['Players', `${players.length} / ${table.max}`], ['Watching', String(watcherCount)]].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span style={{ color: '#e8e4dc', opacity: 0.35 }}>{label}</span>
                  <span className="font-medium" style={{ color: '#e8e4dc' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          {!spectating && gameStarted && (
          <div className="rounded-2xl border p-5" style={{ background: 'linear-gradient(145deg, rgba(107,16,16,0.42), rgba(28,30,37,0.8))', borderColor: 'rgba(192,57,43,0.45)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Your hand</p>
            <p className="mt-2 text-lg font-semibold" style={{ color: complete ? '#4ade80' : '#e8e4dc', fontFamily: 'var(--font-display)' }}>
              {complete ? 'Three Aces' : 'Pair of Aces'}
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.4 }}>
              {complete ? 'Three cards of the same rank. This beats two pair.' : 'Two cards of the same rank. Try drawing three cards to improve.'}
            </p>
            <button onClick={() => setShowHelp(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold" style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}>
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[0.65rem]" style={{ border: '1px solid #c0392b', color: '#f0a097' }}>?</span>
              How to play
            </button>
          </div>
          )}
          {/* M3: member chat (Rohama's chat box, now live) */}
          <TableChat
            tableId={table.id}
            isMember={Boolean(session?.user)}
            isSeated={!spectating && Boolean(currentPlayer)}
            myName={currentPlayer?.displayName ?? session?.user?.name}
          />
        </aside>
      </main>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }} onClick={() => setShowHelp(false)}>
          <div className="relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl sm:p-8" style={{ background: '#17191f', borderColor: '#3a2528' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowHelp(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-sm" style={{ background: '#22242c', color: '#e8e4dc' }} aria-label="Close how to play">
              ✕
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: '#c0392b' }}>Quick guide</p>
            <h2 className="mt-2 text-2xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>How to play 5-card draw</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ['1', 'Bet', 'Players bet chips based on the five cards they were dealt.'],
                ['2', 'Draw', 'Select cards you do not want, then draw replacements once.'],
                ['3', 'Showdown', 'The best five-card poker hand wins everything in the pot.'],
              ].map(([number, title, copy]) => (
                <div key={number} className="rounded-xl border p-4" style={{ background: '#111318', borderColor: '#292c35' }}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: '#6b1010', color: '#f0a097' }}>{number}</span>
                  <p className="mt-3 text-sm font-semibold" style={{ color: '#e8e4dc' }}>{title}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.4 }}>{copy}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border p-4" style={{ background: 'rgba(107,16,16,0.18)', borderColor: 'rgba(192,57,43,0.3)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Hands, strongest to weakest</p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.72 }}>
                Royal flush · Straight flush · Four of a kind · Full house · Flush · Straight · Three of a kind · Two pair · One pair · High card
              </p>
            </div>
            <button onClick={() => setShowHelp(false)} className="mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
