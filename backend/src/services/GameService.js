import { createDeck, shuffleDeck } from '../../game/PlayingCards.js';
import { startHand, applyBettingAction, applyDraw, forceFold, toPublicState, getLegalActions, GameRuleError } from '../../game/PokerEngine.js';
import { decideBet, decideDraw, botStyleFor, BOT_NAMES } from '../../game/BotPlayer.js';

export class GameConflictError extends Error {}
export class GameNotFoundError extends Error {}

export const BLIND_BY_STAKE = {
    low: { small: 1, big: 2 },
    medium: { small: 5, big: 10 },
    high: { small: 25, big: 50 },
};
const STACK_IN_BIG_BLINDS = 100; // most a player can put on the table in one hand
const BOT_STACK_IN_BIG_BLINDS = 100;

/**
 * Everything about running a hand against the database, with the database, socket and
 * timer passed in. That lets tests use in-memory fakes. See controllers for the real wiring.
 *
 * deps = { tableDao, gameDao, chipDao, emit(tableId, event, payload), delay(ms), rng, botDelayMs }
 */
export function createGameService(deps) {
    const { tableDao, gameDao, chipDao, emit } = deps;
    const delay = deps.delay ?? (ms => new Promise(r => setTimeout(r, ms)));
    const rng = deps.rng ?? Math.random;
    const botDelayMs = deps.botDelayMs ?? 1200;

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
        return {
            _id: String(game._id),
            tableId: tableOf(game),
            handNumber: game.handNumber,
            ...pub,
            myHand: me ? engine.hands[me.refId] : null,
            legal: me ? getLegalActions(engine, me.refId) : { canAct: false },
            myTurnToDraw: !!me && engine.round === 'drawing' && engine.currentTurn === me.refId,
            finished,
        };
    }

    async function broadcast(game) {
        emit(tableOf(game), 'game-updated', { gameId: String(game._id), game: toPublicState(game.engine), handNumber: game.handNumber });
    }

    // Pays out chips to humans and frees the table. Runs once, inside one transaction.
    async function settle(game, engine) {
        await gameDao.runInTransaction(async session => {
            for (const p of engine.participants) {
                if (p.kind === 'bot') continue;
                const delta = p.chips - game.startChips[p.refId];
                if (delta !== 0) await chipDao.addChips({ kind: p.kind, refId: p.refId }, delta, session);
            }
            await tableDao.finishTableGame(tableOf(game), session);
            await gameDao.updatePokerGame(game._id, { settled: true }, session);
        });
        game.settled = true;
    }

    // Saves the new engine state, settles if the hand just ended, tells the table
    async function commit(game, engine) {
        await gameDao.updatePokerGame(game._id, { engine, ...mirror(engine) });
        game.engine = engine;
        if (engine.round === 'finished' && !game.settled) await settle(game, engine);
        await broadcast(game);
    }

    async function load(gameId) {
        const game = await gameDao.findPokerGameById(gameId);
        if (!game || !game.engine) throw new GameNotFoundError('Game not found');
        return game;
    }

    async function startGame(tableId) {
        const table = await tableDao.findTableById(tableId);
        if (!table) throw new GameNotFoundError('Table not found');
        const blinds = BLIND_BY_STAKE[table.stakes];
        if (!blinds) throw new GameRuleError('Invalid stakes');

        const seats = table.seats || [];
        const botCount = table.bots || 0;
        if (seats.length + botCount < 2) throw new GameRuleError('At least two players are required to start a game');

        const participants = [];
        const startChips = {};
        for (const seat of seats) {
            const balance = await chipDao.getChipBalance({ kind: seat.kind, refId: seat.refId });
            if (balance === null || balance < blinds.big) {
                throw new GameRuleError(`${seat.displayName || 'A player'} does not have enough chips`);
            }
            const stack = Math.min(balance, blinds.big * STACK_IN_BIG_BLINDS);
            startChips[String(seat.refId)] = stack;
            participants.push({ refId: String(seat.refId), kind: seat.kind, displayName: seat.displayName || 'Player', chips: stack });
        }
        for (let i = 0; i < botCount; i++) {
            const refId = `bot-${i + 1}`;
            participants.push({
                refId, kind: 'bot', displayName: `${BOT_NAMES[i % BOT_NAMES.length]} (CPU)`,
                chips: blinds.big * BOT_STACK_IN_BIG_BLINDS, style: botStyleFor(i),
            });
        }

        let game;
        await gameDao.runInTransaction(async session => {
            const claimed = await tableDao.startTableGame(tableId, session);
            if (!claimed) throw new GameConflictError('A game is already in progress at this table');
            const handNumber = table.hands ?? 0;
            const engine = startHand({
                participants, smallBlind: blinds.small, bigBlind: blinds.big,
                deck: shuffleDeck(createDeck()), rotate: handNumber,
            });
            game = await gameDao.createPokerGame({
                tableId: table._id,
                playerIds: seats.filter(s => s.kind === 'user').map(s => s.refId),
                guestIds: seats.filter(s => s.kind === 'guest').map(s => s.refId),
                smallBlind: blinds.small, bigBlind: blinds.big,
                smallBlindPlayerId: engine.smallBlindPlayerId, bigBlindPlayerId: engine.bigBlindPlayerId,
                startChips, handNumber, engine, settled: false,
                ...mirror(engine),
            }, session);
        });

        game = await load(game._id);
        // A hand can end immediately (everyone all-in from the blinds)
        if (game.engine.round === 'finished') await withLock(String(game._id), () => commit(game, game.engine));
        else await broadcast(game);
        return game;
    }

    async function act(gameId, player, action) {
        return withLock(String(gameId), async () => {
            const game = await load(gameId);
            applyBettingAction(game.engine, String(player.refId), action);
            await commit(game, game.engine);
            return game;
        });
    }

    async function draw(gameId, player, indexes) {
        return withLock(String(gameId), async () => {
            const game = await load(gameId);
            applyDraw(game.engine, String(player.refId), indexes);
            await commit(game, game.engine);
            return game;
        });
    }

    // A player left: fold them out of the hand if one is running
    async function leave(tableId, player) {
        const game = await gameDao.findLatestGameByTableId(tableId);
        if (!game?.engine || game.engine.round === 'finished') return null;
        return withLock(String(game._id), async () => {
            const fresh = await load(game._id);
            forceFold(fresh.engine, String(player.refId));
            await commit(fresh, fresh.engine);
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
            const turn = engine.participants.find(p => p.refId === engine.currentTurn);
            if (engine.round === 'finished' || !turn || turn.kind !== 'bot') return false;
            if (engine.round === 'drawing') applyDraw(engine, turn.refId, decideDraw(engine, turn.refId));
            else {
                let action = decideBet(engine, turn.refId, rng);
                try { applyBettingAction(engine, turn.refId, action); }
                catch { applyBettingAction(engine, turn.refId, getLegalActions(engine, turn.refId).canCheck ? { type: 'check' } : { type: 'fold' }); }
            }
            await commit(game, engine);
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