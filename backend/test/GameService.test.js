import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
    createGameService,
    GameConflictError,
    GameNotFoundError,
    BLIND_BY_STAKE
} from '../src/services/GameService.js';
import { GameRuleError } from '../game/PokerEngine.js';

// GameService gets its database, socket and timer passed in, so these tests use
// small in-memory fakes (wrapped in jest.fn so calls can be checked). No MongoDB needed.

const clone = value => JSON.parse(JSON.stringify(value));

const HUMAN = { kind: 'guest', refId: 'h1' };

function buildHarness({ table = {}, balances = { h1: 1000 }, botDelayMs = 7 } = {}) {
    const tableDoc = {
        _id: 't1',
        stakes: 'medium',          // blinds 5 / 10
        bots: 1,
        hands: 0,
        gameInProgress: false,
        seats: [{ kind: 'guest', refId: 'h1', displayName: 'Human' }],
        ...table
    };
    const games = [];

    const tableDao = {
        findTableById: jest.fn(async () => clone(tableDoc)),
        startTableGame: jest.fn(async () => {
            if (tableDoc.gameInProgress) return null;
            tableDoc.gameInProgress = true;
            return tableDoc;
        }),
        finishTableGame: jest.fn(async () => {
            tableDoc.gameInProgress = false;
            tableDoc.hands += 1;
        })
    };

    const gameDao = {
        runInTransaction: jest.fn(async fn => fn('session')),
        createPokerGame: jest.fn(async data => {
            const game = { _id: `g${games.length + 1}`, ...clone(data) };
            games.push(game);
            return clone(game);
        }),
        findPokerGameById: jest.fn(async id => {
            const game = games.find(g => g._id === id);
            return game ? clone(game) : null;
        }),
        updatePokerGame: jest.fn(async (id, changes) => {
            Object.assign(games.find(g => g._id === id), clone(changes));
        }),
        findLatestGameByTableId: jest.fn(async () => (games.length ? clone(games[games.length - 1]) : null))
    };

    const chipDao = {
        getChipBalance: jest.fn(async player => balances[player.refId] ?? null),
        addChips: jest.fn(async (player, amount) => { balances[player.refId] += amount; })
    };

    const emit = jest.fn();
    const delay = jest.fn(async () => {});

    const service = createGameService({ tableDao, gameDao, chipDao, emit, delay, botDelayMs });
    return { service, tableDoc, games, balances, tableDao, gameDao, chipDao, emit, delay };
}

// Lets a test set up an exact situation by editing the saved game directly
function patchEngine(games, fn) {
    fn(games[games.length - 1].engine);
}

describe('exports', () => {
    test('error classes are real errors', () => {
        expect(new GameConflictError('x')).toBeInstanceOf(Error);
        expect(new GameNotFoundError('x')).toBeInstanceOf(Error);
    });

    test('blind sizes for each stake', () => {
        expect(BLIND_BY_STAKE).toEqual({
            low: { small: 1, big: 2 },
            medium: { small: 5, big: 10 },
            high: { small: 25, big: 50 }
        });
    });
});

describe('startGame', () => {
    test('throws GameNotFoundError when the table does not exist', async () => {
        const h = buildHarness();
        h.tableDao.findTableById.mockResolvedValueOnce(null);

        await expect(h.service.startGame('t1')).rejects.toBeInstanceOf(GameNotFoundError);
        expect(h.gameDao.createPokerGame).not.toHaveBeenCalled();
    });

    test('rejects stakes it has no blinds for', async () => {
        const h = buildHarness({ table: { stakes: 'huge' } });

        await expect(h.service.startGame('t1')).rejects.toBeInstanceOf(GameRuleError);
    });

    test('needs at least two players in total (humans + bots)', async () => {
        const h = buildHarness({ table: { bots: 0 } });

        await expect(h.service.startGame('t1')).rejects.toThrow('At least two players');
    });

    test('one human alone with one bot is enough to start', async () => {
        const h = buildHarness({ table: { bots: 1 } });

        const game = await h.service.startGame('t1');

        expect(game.engine.participants).toHaveLength(2);
    });

    test('rejects a human who cannot cover the big blind', async () => {
        const h = buildHarness({ balances: { h1: 9 } });

        await expect(h.service.startGame('t1')).rejects.toThrow('enough chips');
        expect(h.tableDao.startTableGame).not.toHaveBeenCalled();
    });

    test('rejects a human whose balance cannot be found', async () => {
        const h = buildHarness({ balances: {} });

        await expect(h.service.startGame('t1')).rejects.toThrow('enough chips');
    });

    test('deals the human plus every bot in and posts the blinds', async () => {
        const h = buildHarness({ table: { bots: 2 } });

        const game = await h.service.startGame('t1');
        const e = game.engine;

        expect(e.participants.map(p => p.refId)).toEqual(['h1', 'bot-1', 'bot-2']);
        expect(e.participants[1].kind).toBe('bot');
        expect(e.participants[1].displayName).toContain('(CPU)');
        expect(e.round).toBe('betting1');
        expect(e.potSize).toBe(15);                 // 5 + 10
        expect(Object.keys(e.hands)).toHaveLength(3);
        for (const id of Object.keys(e.hands)) expect(e.hands[id]).toHaveLength(5);
        expect(e.smallBlindPlayerId).toBe('h1');
        expect(e.bigBlindPlayerId).toBe('bot-1');
    });

    test('marks the table busy and tells the room', async () => {
        const h = buildHarness();

        await h.service.startGame('t1');

        expect(h.tableDoc.gameInProgress).toBe(true);
        expect(h.gameDao.runInTransaction).toHaveBeenCalled();
        expect(h.emit).toHaveBeenCalledWith('t1', 'game-updated', expect.objectContaining({ gameId: 'g1' }));
    });

    test('remembers how many chips each human started with', async () => {
        const h = buildHarness();

        const game = await h.service.startGame('t1');

        expect(game.startChips).toEqual({ h1: 1000 });
        expect(game.settled).toBe(false);
    });

    test('caps a human stack at 100 big blinds', async () => {
        const h = buildHarness({ balances: { h1: 1000000 } });

        const game = await h.service.startGame('t1');

        expect(game.startChips.h1).toBe(1000);       // 100 x 10
    });

    test('gives each bot a fresh 100 big blind stack', async () => {
        const h = buildHarness();

        const game = await h.service.startGame('t1');
        const bot = game.engine.participants.find(p => p.refId === 'bot-1');

        // bot is the big blind heads-up, so it has already posted 10
        expect(bot.chips + game.engine.playerBets['bot-1']).toBe(1000);
    });

    test('blinds rotate with the number of hands played at the table', async () => {
        const h = buildHarness({ table: { hands: 1 } });

        const game = await h.service.startGame('t1');

        expect(game.engine.smallBlindPlayerId).toBe('bot-1');
        expect(game.engine.bigBlindPlayerId).toBe('h1');
    });

    test('refuses to start a second game while one is running', async () => {
        const h = buildHarness();
        await h.service.startGame('t1');
        h.gameDao.createPokerGame.mockClear();

        await expect(h.service.startGame('t1')).rejects.toBeInstanceOf(GameConflictError);
        expect(h.gameDao.createPokerGame).not.toHaveBeenCalled();
    });
});

describe('load and findLatest', () => {
    test('load throws GameNotFoundError for an unknown game', async () => {
        const h = buildHarness();

        await expect(h.service.load('nope')).rejects.toBeInstanceOf(GameNotFoundError);
    });

    test('load throws GameNotFoundError for a game with no engine state', async () => {
        const h = buildHarness();
        h.gameDao.findPokerGameById.mockResolvedValueOnce({ _id: 'g9', engine: null });

        await expect(h.service.load('g9')).rejects.toBeInstanceOf(GameNotFoundError);
    });

    test('findLatest asks the DAO for the newest game at the table', async () => {
        const h = buildHarness();
        await h.service.startGame('t1');

        const latest = await h.service.findLatest('t1');

        expect(h.gameDao.findLatestGameByTableId).toHaveBeenCalledWith('t1');
        expect(latest._id).toBe('g1');
    });
});

describe('viewFor', () => {
    test('a player sees their own cards and their options', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');

        const view = await h.service.viewFor(game, HUMAN);

        expect(view.myHand).toHaveLength(5);
        expect(view.myHand).toEqual(game.engine.hands.h1);
        expect(view.legal.canAct).toBe(true);        // small blind acts first heads-up
        expect(view.myTurnToDraw).toBe(false);
        expect(view.finished).toBe(false);
        expect(view._id).toBe('g1');
        expect(view.tableId).toBe('t1');
    });

    test('never exposes the deck or anyone elses hand', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');

        const view = await h.service.viewFor(game, HUMAN);

        expect(view.deck).toBeUndefined();
        expect(view.hands).toBeUndefined();
        expect(view.revealedHands).toEqual({});
        for (const p of view.participants) expect(p.hand).toBeUndefined();
    });

    test('lists bots as bots', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');

        const view = await h.service.viewFor(game, HUMAN);

        expect(view.participants.find(p => p.refId === 'bot-1').isBot).toBe(true);
        expect(view.participants.find(p => p.refId === 'h1').isBot).toBe(false);
    });

    test('someone not in the hand (or nobody) gets no cards and no actions', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');

        const stranger = await h.service.viewFor(game, { refId: 'stranger' });
        const nobody = await h.service.viewFor(game, null);

        for (const view of [stranger, nobody]) {
            expect(view.myHand).toBeNull();
            expect(view.legal).toEqual({ canAct: false });
            expect(view.myTurnToDraw).toBe(false);
        }
    });

    test('myTurnToDraw is true when it is your turn in the draw round', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');
        game.engine.round = 'drawing';
        game.engine.currentTurn = 'h1';

        const view = await h.service.viewFor(game, HUMAN);

        expect(view.myTurnToDraw).toBe(true);
    });
});

describe('act (betting)', () => {
    test('saves the move and tells the room', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');
        h.emit.mockClear();

        const after = await h.service.act(game._id, HUMAN, { type: 'call' });

        expect(after.engine.lastAction).toEqual({ playerId: 'h1', type: 'call', amount: 5 });
        expect(h.gameDao.updatePokerGame).toHaveBeenCalledWith(
            'g1',
            expect.objectContaining({
                engine: expect.anything(),
                round: 'betting1'
            }),
            'session'
        );
        expect(h.emit).toHaveBeenCalledWith('t1', 'game-updated', expect.anything());
    });

    test('rejects a move out of turn', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');

        await expect(h.service.act(game._id, { refId: 'bot-1' }, { type: 'check' }))
            .rejects.toThrow('not your turn');
    });

    test('rejects an illegal move with a GameRuleError', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');

        await expect(h.service.act(game._id, HUMAN, { type: 'check' }))   // there is a bet to call
            .rejects.toBeInstanceOf(GameRuleError);
    });

    test('rejects a move in a game that does not exist', async () => {
        const h = buildHarness();

        await expect(h.service.act('nope', HUMAN, { type: 'call' }))
            .rejects.toBeInstanceOf(GameNotFoundError);
    });

    test('folding heads-up ends the hand, charges the human and frees the table', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');

        const after = await h.service.act(game._id, HUMAN, { type: 'fold' });

        expect(after.engine.round).toBe('finished');
        expect(after.settled).toBe(true);
        // human was the small blind and folded: loses 5
        expect(h.chipDao.addChips).toHaveBeenCalledWith({ kind: 'guest', refId: 'h1' }, -5, 'session');
        expect(h.balances.h1).toBe(995);
        expect(h.tableDao.finishTableGame).toHaveBeenCalledWith('t1', 'session');
        expect(h.tableDoc.gameInProgress).toBe(false);
        expect(h.tableDoc.hands).toBe(1);
        expect(h.gameDao.updatePokerGame).toHaveBeenCalledWith('g1', { settled: true }, 'session');
    });

    test('pays the human when everyone else has folded', async () => {
        const h = buildHarness({ table: { hands: 1 } });   // human is the big blind, bot acts first
        const game = await h.service.startGame('t1');
        patchEngine(h.games, e => {
            e.participants.find(p => p.refId === 'bot-1').folded = true;
            e.currentTurn = 'h1';
        });

        const after = await h.service.act(game._id, HUMAN, { type: 'check' });

        expect(after.engine.round).toBe('finished');
        // started with 1000, posted the 10 big blind, wins the 15 pot: +5
        expect(h.chipDao.addChips).toHaveBeenCalledWith(
    { kind: 'guest', refId: 'h1' },
        -10,
        'session'
    );

    expect(h.chipDao.addChips).toHaveBeenCalledWith(
        { kind: 'guest', refId: 'h1' },
        15,
        'session'
    );
        expect(h.balances.h1).toBe(1005);
    });

    test('never pays bots anything', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');

        await h.service.act(game._id, HUMAN, { type: 'fold' });

        for (const call of h.chipDao.addChips.mock.calls) expect(call[0].refId).not.toMatch(/^bot-/);
    });

    test('settles only once even if more moves are attempted after the end', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');
        await h.service.act(game._id, HUMAN, { type: 'fold' });

        await expect(h.service.act(game._id, HUMAN, { type: 'call' })).rejects.toBeInstanceOf(GameRuleError);
        expect(h.chipDao.addChips).toHaveBeenCalledTimes(1);
        expect(h.tableDao.finishTableGame).toHaveBeenCalledTimes(1);
    });
});

describe('draw', () => {
    async function inDrawRound() {
        const h = buildHarness();
        const game = await h.service.startGame('t1');
        patchEngine(h.games, e => {
            e.round = 'drawing';
            e.currentTurn = 'h1';
            e.playerBets = {};
            e.currentBet = 0;
            e.hands.h1 = [
                { rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }, { rank: '2', suit: 'clubs' },
                { rank: '3', suit: 'clubs' }, { rank: '9', suit: 'diamonds' }
            ];
            e.deck = [
                { rank: '5', suit: 'hearts' }, { rank: '6', suit: 'hearts' }, { rank: '7', suit: 'hearts' }
            ];
        });
        return { h, game };
    }

    test('replaces the chosen cards from the deck', async () => {
        const { h, game } = await inDrawRound();

        const after = await h.service.draw(game._id, HUMAN, [0, 1]);

        const hand = after.engine.hands.h1;
        expect(hand[0]).toEqual({ rank: '7', suit: 'hearts' });   // top of the deck first
        expect(hand[1]).toEqual({ rank: '6', suit: 'hearts' });
        expect(hand.slice(2)).toEqual([
            { rank: '2', suit: 'clubs' }, { rank: '3', suit: 'clubs' }, { rank: '9', suit: 'diamonds' }
        ]);
        expect(after.engine.discards).toHaveLength(2);
        expect(after.engine.deck).toHaveLength(1);
    });

    test('hands the turn to the next player and saves', async () => {
        const { h, game } = await inDrawRound();

        const after = await h.service.draw(game._id, HUMAN, [4]);

        expect(after.engine.currentTurn).toBe('bot-1');
        expect(after.engine.round).toBe('drawing');
        expect(h.gameDao.updatePokerGame).toHaveBeenCalledWith(
            'g1',
            expect.objectContaining({
                round: 'drawing'
            }),
            'session'
        );
    });

    test('standing pat (no cards) is allowed and keeps the hand', async () => {
        const { h, game } = await inDrawRound();
        const before = clone(h.games[0].engine.hands.h1);

        const after = await h.service.draw(game._id, HUMAN, []);

        expect(after.engine.hands.h1).toEqual(before);
        expect(after.engine.lastAction).toEqual({ playerId: 'h1', type: 'draw', amount: 0 });
    });

    test('rejects bad card positions', async () => {
        const { h, game } = await inDrawRound();

        await expect(h.service.draw(game._id, HUMAN, [5])).rejects.toBeInstanceOf(GameRuleError);
        await expect(h.service.draw(game._id, HUMAN, [1, 1])).rejects.toBeInstanceOf(GameRuleError);
        await expect(h.service.draw(game._id, HUMAN, [-1])).rejects.toBeInstanceOf(GameRuleError);
    });

    test('rejects a draw out of turn', async () => {
        const { h, game } = await inDrawRound();

        await expect(h.service.draw(game._id, { refId: 'bot-1' }, [0])).rejects.toThrow('not your turn');
    });

    test('rejects drawing during a betting round', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');

        await expect(h.service.draw(game._id, HUMAN, [0])).rejects.toThrow('Drawing is not open');
    });
});

describe('leave', () => {
    test('does nothing when the table has never had a game', async () => {
        const h = buildHarness();

        const result = await h.service.leave('t1', HUMAN);

        expect(result).toBeNull();
        expect(h.gameDao.updatePokerGame).not.toHaveBeenCalled();
    });

    test('does nothing when the last hand is already over', async () => {
        const h = buildHarness();
        const game = await h.service.startGame('t1');
        await h.service.act(game._id, HUMAN, { type: 'fold' });
        h.gameDao.updatePokerGame.mockClear();

        const result = await h.service.leave('t1', HUMAN);

        expect(result).toBeNull();
        expect(h.gameDao.updatePokerGame).not.toHaveBeenCalled();
    });

    test('folds a player who leaves mid-hand, ending a heads-up game', async () => {
        const h = buildHarness();
        await h.service.startGame('t1');

        const after = await h.service.leave('t1', HUMAN);

        expect(after.engine.round).toBe('finished');
        expect(after.engine.resultText).toContain('wins');
        expect(after.settled).toBe(true);
        expect(h.balances.h1).toBe(995);
        expect(h.tableDoc.gameInProgress).toBe(false);
    });

    test('with several players the hand carries on without the leaver', async () => {
        const h = buildHarness({ table: { bots: 2 } });
        await h.service.startGame('t1');

        const after = await h.service.leave('t1', HUMAN);

        expect(after.engine.participants.find(p => p.refId === 'h1').folded).toBe(true);
        expect(after.engine.round).not.toBe('finished');
        expect(after.engine.currentTurn).not.toBe('h1');
    });
});

describe('runBots', () => {
    test('does nothing while it is the humans turn', async () => {
        const h = buildHarness();                    // human is first to act heads-up
        await h.service.startGame('t1');
        h.gameDao.updatePokerGame.mockClear();

        await h.service.runBots('g1');

        expect(h.delay).not.toHaveBeenCalled();
        expect(h.gameDao.updatePokerGame).not.toHaveBeenCalled();
    });

    test('plays the bots turn after a pause, then waits for the human', async () => {
        const h = buildHarness({ table: { hands: 1 } });   // bot is the small blind and acts first
        await h.service.startGame('t1');

        await h.service.runBots('g1');

        expect(h.delay).toHaveBeenCalledWith(7);
        const game = await h.service.load('g1');
        const handIsOver = game.engine.round === 'finished';
        expect(handIsOver || game.engine.currentTurn === 'h1').toBe(true);
        expect(game.engine.lastAction).not.toBeNull();
        expect(game.engine.lastAction.playerId).toBe('bot-1');
    });

    test('with only bots left in the hand it plays all the way to the end', async () => {
        const h = buildHarness({ table: { bots: 2, hands: 0 } });
        await h.service.startGame('t1');
        await h.service.leave('t1', HUMAN);          // human folds out, bots finish the hand

        await h.service.runBots('g1');

        const game = await h.service.load('g1');
        expect(game.engine.round).toBe('finished');
        expect(game.settled).toBe(true);
        expect(h.tableDoc.gameInProgress).toBe(false);
    });

    test('calling it twice at once does not break the hand', async () => {
        const h = buildHarness({ table: { hands: 1 } });
        await h.service.startGame('t1');

        await Promise.all([h.service.runBots('g1'), h.service.runBots('g1')]);

        const game = await h.service.load('g1');
        const handIsOver = game.engine.round === 'finished';
        expect(handIsOver || game.engine.currentTurn === 'h1').toBe(true);
    });

    test('logs and swallows errors instead of crashing the server', async () => {
        const h = buildHarness();
        await h.service.startGame('t1');
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        h.gameDao.findPokerGameById.mockRejectedValueOnce(new Error('db down'));

        await expect(h.service.runBots('g1')).resolves.toBeUndefined();

        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    test('can run again after an error', async () => {
        const h = buildHarness({ table: { hands: 1 } });
        await h.service.startGame('t1');
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        h.gameDao.findPokerGameById.mockRejectedValueOnce(new Error('db down'));
        await h.service.runBots('g1');
        spy.mockRestore();

        await h.service.runBots('g1');

        expect(h.delay).toHaveBeenCalled();
    });
});

describe('whole hands against bots', () => {
    test('10 hands: chips are conserved, the table frees up and the balance matches', async () => {
        const h = buildHarness({ table: { bots: 2 } });

        for (let i = 0; i < 10; i++) {
            const before = h.balances.h1;
            const game = await h.service.startGame('t1');
            const gameId = game._id;

            for (let step = 0; step < 100; step++) {
                await h.service.runBots(gameId);
                const current = await h.service.load(gameId);
                const e = current.engine;
                if (e.round === 'finished') break;
                expect(e.currentTurn).toBe('h1');
                if (e.round === 'drawing') {
                    await h.service.draw(gameId, HUMAN, []);
                } else {
                    const view = await h.service.viewFor(current, HUMAN);
                    await h.service.act(gameId, HUMAN, view.legal.canCheck ? { type: 'check' } : { type: 'call' });
                }
            }

            const done = await h.service.load(gameId);
            const e = done.engine;
            expect(e.round).toBe('finished');
            expect(done.settled).toBe(true);
            expect(h.tableDoc.gameInProgress).toBe(false);
            // nothing created or destroyed: stacks add up to what everyone brought
            const total = e.participants.reduce((sum, p) => sum + p.chips, 0);
            expect(total).toBe(done.startChips.h1 + 2 * 1000);
            // the human's real balance moved by exactly their win or loss
            const me = e.participants.find(p => p.refId === 'h1');
            expect(h.balances.h1 - before).toBe(me.chips - done.startChips.h1);
            if (h.balances.h1 < 10) h.balances.h1 = 1000;   // keep the test going if the human goes broke
        }
        expect(h.tableDoc.hands).toBe(10);
    });
});