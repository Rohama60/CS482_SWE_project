import { createDeck, shuffleDeck } from '../../game/PlayingCards.js';
import { startHand, applyBettingAction, applyDraw, forceFold, toPublicState, getLegalActions, GameRuleError } from '../../game/PokerEngine.js';
import { decideBet, decideDraw, botStyleFor, BOT_NAMES } from '../../game/BotPlayer.js';
import { evaluateHand, calculateWinProbability } from '../../game/HandEvaluator.js';
export class GameConflictError extends Error {}
export class GameNotFoundError extends Error {}

export const ANTE_BY_STAKE = {
    low: 1,
    medium: 5,
    high: 25,
};
// Backwards-compatible export name; the values are antes, never blinds.
export const BLIND_BY_STAKE = ANTE_BY_STAKE;
const STACK_IN_ANTES = 100;
const BOT_STACK_IN_ANTES = 100;

/**
 * Everything about running a hand against the database, with the database, socket and
 * timer passed in. That lets tests use in-memory fakes. See controllers for the real wiring.
 *
 * deps = { tableDao, gameDao, chipDao, emit(tableId, event, payload), delay(ms), rng, botDelayMs }
 */
export function createGameService(deps) {
    const oddsCache = new Map();
    const { tableDao, gameDao, chipDao, emit } = deps;
    const delay = deps.delay ?? (ms => new Promise(r => setTimeout(r, ms)));
    const rng = deps.rng ?? Math.random;
    const botDelayMs = deps.botDelayMs ?? 1200;
    const TURN_MS = 30_000;
    const timers = new Map();
    const armedGames = new Set();

    // One move at a time per game (single server instance)
    const locks = new Map();
    function withLock(gameId, fn) {
        const prev = locks.get(gameId) ?? Promise.resolve();
        const run = prev.catch(() => {}).then(fn);
        locks.set(gameId, run);
        run.finally(() => { if (locks.get(gameId) === run) locks.delete(gameId); }).catch(() => {});
        return run;
    }

    const tableOf = game => String(game.tableId);

    function mirror(engine) {
        const pub = toPublicState(engine);
        return {
            round: engine.round,
            potSize: engine.potSize,
            currentBet: engine.currentBet,
            currentTurn: engine.currentTurn ?? '',
            resultText: pub.resultText,
        };
    }

    // What one player may see: public table state plus their own cards and options
    async function viewFor(game, viewer) {
        const engine = game.engine;
        const pub = toPublicState(engine);
        const me = viewer ? engine.participants.find(p => p.refId === String(viewer.refId)) : null;
        const finished = engine.round === 'finished';
        const myCards = me ? engine.hands[me.refId] : null;
        const myHandRanking = myCards?.length === 5
            ? evaluateHand(myCards)
            : null;
        const opponentCount = me ? engine.participants.filter(player => !player.folded && player.refId !== me.refId).length: 0;
        let myWinProbability = null;

        if (myCards?.length === 5 && me && !me.folded && !finished) {
            const handKey = myCards
                .map(card => `${card.rank}-${card.suit}`)
                .sort()
                .join('|');

            const cacheKey =
                `${game._id}-${game.handNumber}-${me.refId}-${handKey}-${opponentCount}`;

            if (oddsCache.has(cacheKey)) {
                myWinProbability = oddsCache.get(cacheKey);
            } else {
                myWinProbability = calculateWinProbability(
                    myCards,
                    opponentCount
                );

                oddsCache.set(cacheKey, myWinProbability);
            }
        }
        return {
            _id: String(game._id),
            tableId: tableOf(game),
            handNumber: game.handNumber,
            ...pub,
            legal: me ? getLegalActions(engine, me.refId) : { canAct: false },
            myTurnToDraw: !!me && engine.round === 'drawing' && engine.currentTurn === me.refId,
            finished,
            myHand: myCards,
            myHandRanking: myHandRanking,
            myWinProbability: myWinProbability,
        };
    }

    async function broadcast(game) {
        emit(tableOf(game), 'game-updated', { gameId: String(game._id), game: toPublicState(game.engine), handNumber: game.handNumber });
    }

    async function applyChipChanges(engine, previousChips, session) {
        for (const player of engine.participants) {
            if (player.kind === 'bot') continue;
            const previous = previousChips.get(player.refId);
            const delta = player.chips - previous;
            if (delta === 0) continue;

            const updated = await chipDao.addChips(
                { kind: player.kind, refId: player.refId },
                delta,
                session
            );
            if (updated === null) throw new GameRuleError('Unable to update player chip balance');
        }
    }

    // Saves the new engine state and applies chip changes atomically.
    async function commit(game, engine, previousChips) {
        await gameDao.runInTransaction(async session => {
            if (previousChips) await applyChipChanges(engine, previousChips, session);
            await gameDao.updatePokerGame(game._id, { engine, ...mirror(engine) }, session);
            if (engine.round === 'finished' && !game.settled) {
                await tableDao.finishTableGame(tableOf(game), session);
                await gameDao.updatePokerGame(game._id, { settled: true }, session);
            }
        });
        game.engine = engine;
        if (engine.round === 'finished') game.settled = true;
        await broadcast(game);
    }

    async function load(gameId) {
        const game = await gameDao.findPokerGameById(gameId);
        if (!game || !game.engine) throw new GameNotFoundError('Game not found');
        return game;
    }

    // Automatically folds in betting or stands pat in drawing.
    async function expireTurn(game) {
        const e = game.engine;
        const turn = e.participants.find(p => p.refId === e.currentTurn);

        if (!turn || turn.kind === 'bot' ||
            e.round === 'finished' ||
            !game.turnDeadline ||
            Date.now() < game.turnDeadline) return false;

        const previous = new Map(
            e.participants.map(p => [p.refId, p.chips])
        );

        if (e.round === 'drawing') {
            applyDraw(e, turn.refId, []);
        } else {
            applyBettingAction(e, turn.refId, { type: 'fold' });
        }

        await commit(game, e, previous);
        return true;
    }

    function scheduleTurn(game) {
        const id = String(game._id);
        clearTimeout(timers.get(id));
        timers.delete(id);

        if (game.engine.round === 'finished') {
            armedGames.delete(id);
            return;
        }

        const player = game.engine.participants.find(
            p => p.refId === game.engine.currentTurn
        );

        if (!armedGames.has(id) ||
            !player || player.kind === 'bot' ||
            !game.turnDeadline) return;

        const deadline = Number(game.turnDeadline);

        const timer = setTimeout(() => {
            withLock(id, async () => {
                const fresh = await load(id);
                if (Number(fresh.turnDeadline) !== deadline) return false;
                return expireTurn(fresh);
            })
            .then(expired => {
                if (expired) void runBots(id);
            })
            .catch(err => console.error('Turn timer failed:', err));
        }, Math.max(0, deadline - Date.now()));

        timer.unref?.();
        timers.set(id, timer);
    }

    // Called once the initial shuffle/deal animation has finished.
    async function armTurn(gameId) {
        const id = String(gameId);

        return withLock(id, async () => {
            const game = await load(id);
            if (armedGames.has(id) || game.engine.round === 'finished') return;

            armedGames.add(id);
            const player = game.engine.participants.find(
                p => p.refId === game.engine.currentTurn
            );

            game.turnDeadline =
                player && player.kind !== 'bot'
                    ? Date.now() + TURN_MS
                    : null;

            await gameDao.updatePokerGame(id, {
                turnDeadline: game.turnDeadline,
            });

            scheduleTurn(game);
            await broadcast(game);
        });
    }


    async function startGame(tableId) {
        const table = await tableDao.findTableById(tableId);
        if (!table) throw new GameNotFoundError('Table not found');
        const ante = ANTE_BY_STAKE[table.stakes];
        if (ante === undefined) throw new GameRuleError('Invalid stakes');

        const seats = table.seats || [];
        const botCount = table.bots || 0;
        if (seats.length + botCount < 2) throw new GameRuleError('At least two players are required to start a game');

        const participants = [];
        const startChips = {};
        for (const seat of seats) {
            const balance = await chipDao.getChipBalance({ kind: seat.kind, refId: seat.refId });
            if (balance === null || balance < ante) {
                throw new GameRuleError(`${seat.displayName || 'A player'} does not have enough chips`);
            }
            const stack = Math.min(balance, ante * STACK_IN_ANTES);
            startChips[String(seat.refId)] = stack;
            participants.push({ refId: String(seat.refId), kind: seat.kind, displayName: seat.displayName || 'Player', chips: stack });
        }
        for (let i = 0; i < botCount; i++) {
            const refId = `bot-${i + 1}`;
            participants.push({
                refId, kind: 'bot', displayName: `${BOT_NAMES[i % BOT_NAMES.length]} (CPU)`,
                chips: ante * BOT_STACK_IN_ANTES, style: botStyleFor(i),
            });
        }

        let game;
        await gameDao.runInTransaction(async session => {
            const claimed = await tableDao.startTableGame(tableId, session);
            if (!claimed) throw new GameConflictError('A game is already in progress at this table');
            const handNumber = table.hands ?? 0;
            const engine = startHand({
                participants, ante,
                deck: shuffleDeck(createDeck()), rotate: handNumber,
            });
            await applyChipChanges(
                engine,
                new Map(participants.map(player => [String(player.refId), player.chips])),
                session
            );
            game = await gameDao.createPokerGame({
                tableId: table._id,
                playerIds: seats.filter(s => s.kind === 'user').map(s => s.refId),
                guestIds: seats.filter(s => s.kind === 'guest').map(s => s.refId),
                ante,
                handStartIndex: engine.handStartIndex, handStartPlayerId: engine.handStartPlayerId,
                startChips, handNumber, engine, settled: false,
                ...mirror(engine),
            }, session);
        });

        game = await load(game._id);
        // A hand can end immediately (everyone is all-in after posting the ante)
        if (game.engine.round === 'finished') await withLock(String(game._id), () => commit(game, game.engine));
        else await broadcast(game);
        return game;
    }

    async function act(gameId, player, action) {
        return withLock(String(gameId), async () => {
            const game = await load(gameId);
            const previousChips = new Map(game.engine.participants.map(p => [p.refId, p.chips]));
            applyBettingAction(game.engine, String(player.refId), action);
            await commit(game, game.engine, previousChips);
            return game;
        });
    }

    async function draw(gameId, player, indexes) {
        return withLock(String(gameId), async () => {
            const game = await load(gameId);
            const previousChips = new Map(game.engine.participants.map(p => [p.refId, p.chips]));
            applyDraw(game.engine, String(player.refId), indexes);
            await commit(game, game.engine, previousChips);
            return game;
        });
    }

    // A player left: fold them out of the hand if one is running
    async function leave(tableId, player) {
        const game = await gameDao.findLatestGameByTableId(tableId);
        if (!game?.engine || game.engine.round === 'finished') return null;
        return withLock(String(game._id), async () => {
            const fresh = await load(game._id);
            const previousChips = new Map(fresh.engine.participants.map(p => [p.refId, p.chips]));
            forceFold(fresh.engine, String(player.refId));
            await commit(fresh, fresh.engine, previousChips);
            return fresh;
        });
    }

    // ---- bots -------------------------------------------------------
    const running = new Set();
    const again = new Set();

    async function botStep(gameId) {
        return withLock(String(gameId), async () => {
            const game = await load(gameId);
            const engine = game.engine;
            const previousChips = new Map(engine.participants.map(p => [p.refId, p.chips]));
            const turn = engine.participants.find(p => p.refId === engine.currentTurn);
            if (engine.round === 'finished' || !turn || turn.kind !== 'bot') return false;
            if (engine.round === 'drawing') applyDraw(engine, turn.refId, decideDraw(engine, turn.refId));
            else {
                let action = decideBet(engine, turn.refId, rng);
                try { applyBettingAction(engine, turn.refId, action); }
                catch { applyBettingAction(engine, turn.refId, getLegalActions(engine, turn.refId).canCheck ? { type: 'check' } : { type: 'fold' }); }
            }
            await commit(game, engine, previousChips);
            return true;
        });
    }

    // Plays bot turns one by one with a pause between them. Safe to call many times.
    async function runBots(gameId) {
        const id = String(gameId);
        if (running.has(id)) { again.add(id); return; }
        running.add(id);
        try {
            do {
                again.delete(id);
                for (;;) {
                    const game = await load(id);
                    const e = game.engine;
                    const turn = e.participants.find(p => p.refId === e.currentTurn);
                    if (e.round === 'finished' || !turn || turn.kind !== 'bot') break;
                    await delay(botDelayMs);
                    if (!(await botStep(id))) break;
                }
            } while (again.has(id));
        } catch (err) {
            console.error('Bot runner stopped:', err);
        } finally {
            running.delete(id);
        }
    }

    return { startGame, act, draw, leave, runBots, viewFor, load, findLatest: tableId => gameDao.findLatestGameByTableId(tableId) };
}