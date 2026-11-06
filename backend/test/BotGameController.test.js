import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const VALID_ID = '507f1f77bcf86cd799439011';
const TABLE_ID = '507f1f77bcf86cd799439022';

// ---- stand-ins for everything the controller imports ----
const mockFindTableById = jest.fn();
const mockStartTableGame = jest.fn();
const mockGetJoiningPlayer = jest.fn();

const botGameDao = {
    createPokerGame: jest.fn(),
    findPokerGameById: jest.fn(),
    updatePokerGame: jest.fn(),
    findLatestGameByTableId: jest.fn(),
    runInTransaction: jest.fn(),
    addChips: jest.fn(),
    getChipBalance: jest.fn(),
    finishTableGame: jest.fn()
};

class GameConflictError extends Error {}
class GameNotFoundError extends Error {}

const service = {
    startGame: jest.fn(),
    act: jest.fn(),
    draw: jest.fn(),
    leave: jest.fn(),
    runBots: jest.fn(),
    viewFor: jest.fn(),
    load: jest.fn(),
    findLatest: jest.fn()
};

let wiredDeps = null;
const mockCreateGameService = jest.fn(deps => {
    wiredDeps = deps;
    return service;
});

jest.unstable_mockModule('mongoose', () => ({
    default: { isValidObjectId: id => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) }
}));
jest.unstable_mockModule('../src/dao/TableDAO.js', () => ({
    findTableById: mockFindTableById,
    startTableGame: mockStartTableGame
}));
jest.unstable_mockModule('../src/dao/BotGameDAO.js', () => botGameDao);
jest.unstable_mockModule('../src/controllers/JoinTableController.js', () => ({
    getJoiningPlayer: mockGetJoiningPlayer
}));
jest.unstable_mockModule('../src/services/GameService.js', () => ({
    createGameService: mockCreateGameService,
    GameConflictError,
    GameNotFoundError
}));

// The real rules error, so the controller's instanceof check is the real one
const { GameRuleError } = await import('../game/PokerEngine.js');
const {
    CreateBotGameController,
    BotGameActionController,
    BotGameDrawController,
    GetBotGameController,
    GetTableBotGameController,
    FoldBotGamePlayerOnLeave
} = await import('../src/controllers/BotGameController.js');

// ---- tiny Express stand-ins ----
function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function makeReq({ body = {}, params = {} } = {}) {
    const emit = jest.fn();
    const io = { to: jest.fn(() => ({ emit })) };
    return { body, params, app: { get: jest.fn(() => io) }, io, emit };
}

const PLAYER = { kind: 'guest', refId: 'h1', displayName: 'Human' };
const VIEW = { _id: 'g1', round: 'betting1', myHand: [{ rank: 'A', suit: 'spades' }], legal: { canAct: true } };

beforeEach(() => {
    for (const fn of [mockFindTableById, mockStartTableGame, mockGetJoiningPlayer, ...Object.values(service)]) {
        fn.mockReset();
    }
    mockGetJoiningPlayer.mockResolvedValue(PLAYER);
    service.viewFor.mockResolvedValue(VIEW);
});

describe('wiring', () => {
    test('emit does nothing (and does not crash) before any request has supplied the socket server', () => {
        // Must stay the first test: later tests give the controller a socket server.
        expect(() => wiredDeps.emit('t1', 'game-updated', {})).not.toThrow();
    });

    test('builds the game service from the DAOs', () => {
        expect(mockCreateGameService).toHaveBeenCalledTimes(1);
        expect(wiredDeps.tableDao.findTableById).toBe(mockFindTableById);
        expect(wiredDeps.tableDao.startTableGame).toBe(mockStartTableGame);
        expect(wiredDeps.tableDao.finishTableGame).toBe(botGameDao.finishTableGame);
        expect(wiredDeps.gameDao.createPokerGame).toBe(botGameDao.createPokerGame);
        expect(wiredDeps.gameDao.runInTransaction).toBe(botGameDao.runInTransaction);
        expect(wiredDeps.chipDao.addChips).toBe(botGameDao.addChips);
        expect(wiredDeps.chipDao.getChipBalance).toBe(botGameDao.getChipBalance);
    });

    test('emit sends to the table room once a request has supplied the socket server', async () => {
        const req = makeReq({ params: { gameId: VALID_ID } });
        service.load.mockResolvedValue({ _id: VALID_ID });
        await GetBotGameController(req, makeRes());

        wiredDeps.emit('t1', 'game-updated', { gameId: 'g1' });

        expect(req.io.to).toHaveBeenCalledWith('table-t1');
        expect(req.emit).toHaveBeenCalledWith('game-updated', { gameId: 'g1' });
    });
});

describe('CreateBotGameController', () => {
    const game = { _id: 'g1', playerIds: [], guestIds: [] };

    test('400 for a table id that is not valid', async () => {
        const res = makeRes();

        await CreateBotGameController(makeReq({ body: { tableId: 'nope' } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid table ID' });
        expect(service.startGame).not.toHaveBeenCalled();
    });

    test('400 when no table id is sent', async () => {
        const res = makeRes();

        await CreateBotGameController(makeReq({ body: {} }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('404 when the table does not exist', async () => {
        mockFindTableById.mockResolvedValue(null);
        const res = makeRes();

        await CreateBotGameController(makeReq({ body: { tableId: TABLE_ID } }), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Table not found' });
        expect(service.startGame).not.toHaveBeenCalled();
    });

    test('201: starts the hand, tells the room, starts the bots and returns the players view', async () => {
        const seats = [{ kind: 'guest', refId: 'h1', displayName: 'Human' }];
        mockFindTableById.mockResolvedValue({ _id: TABLE_ID, seats });
        service.startGame.mockResolvedValue(game);
        const req = makeReq({ body: { tableId: TABLE_ID } });
        const res = makeRes();

        await CreateBotGameController(req, res);

        expect(service.startGame).toHaveBeenCalledWith(TABLE_ID);
        expect(service.viewFor).toHaveBeenCalledWith(game, PLAYER);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ game: VIEW, seats });
        expect(service.runBots).toHaveBeenCalledWith('g1');
    });

    test('the room announcement does not include the starting players private cards or options', async () => {
        mockFindTableById.mockResolvedValue({ _id: TABLE_ID, seats: [] });
        service.startGame.mockResolvedValue(game);
        const req = makeReq({ body: { tableId: TABLE_ID } });

        await CreateBotGameController(req, makeRes());

        expect(req.io.to).toHaveBeenCalledWith(`table-${TABLE_ID}`);
        const [event, payload] = req.emit.mock.calls[0];
        expect(event).toBe('game-started');
        expect(payload.gameId).toBe('g1');
        expect(payload.game.round).toBe('betting1');
        expect(payload.game.myHand).toBeUndefined();
        expect(payload.game.legal).toBeUndefined();
    });

    test('returns an empty seat list if the table has none', async () => {
        mockFindTableById.mockResolvedValue({ _id: TABLE_ID });
        service.startGame.mockResolvedValue(game);
        const res = makeRes();

        await CreateBotGameController(makeReq({ body: { tableId: TABLE_ID } }), res);

        expect(res.json).toHaveBeenCalledWith({ game: VIEW, seats: [] });
    });

    test('409 when a game is already running', async () => {
        mockFindTableById.mockResolvedValue({ _id: TABLE_ID });
        service.startGame.mockRejectedValue(new GameConflictError('A game is already in progress at this table'));
        const res = makeRes();

        await CreateBotGameController(makeReq({ body: { tableId: TABLE_ID } }), res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ message: 'A game is already in progress at this table' });
        expect(service.runBots).not.toHaveBeenCalled();
    });

    test('404 when the service cannot find the table', async () => {
        mockFindTableById.mockResolvedValue({ _id: TABLE_ID });
        service.startGame.mockRejectedValue(new GameNotFoundError('Table not found'));
        const res = makeRes();

        await CreateBotGameController(makeReq({ body: { tableId: TABLE_ID } }), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('400 with the rule message (for example not enough chips)', async () => {
        mockFindTableById.mockResolvedValue({ _id: TABLE_ID });
        service.startGame.mockRejectedValue(new GameRuleError('Human does not have enough chips'));
        const res = makeRes();

        await CreateBotGameController(makeReq({ body: { tableId: TABLE_ID } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Human does not have enough chips' });
    });

    test('500 for anything unexpected, without leaking the error', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockFindTableById.mockResolvedValue({ _id: TABLE_ID });
        service.startGame.mockRejectedValue(new Error('db exploded'));
        const res = makeRes();

        await CreateBotGameController(makeReq({ body: { tableId: TABLE_ID } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
        spy.mockRestore();
    });
});

describe('BotGameActionController', () => {
    test('401 when nobody is logged in or a guest', async () => {
        mockGetJoiningPlayer.mockResolvedValue(null);
        const res = makeRes();

        await BotGameActionController(makeReq({ params: { gameId: VALID_ID }, body: { type: 'fold' } }), res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Player not authenticated' });
        expect(service.act).not.toHaveBeenCalled();
    });

    test('400 for an invalid game id', async () => {
        const res = makeRes();

        await BotGameActionController(makeReq({ params: { gameId: 'bad' }, body: { type: 'fold' } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid game ID' });
    });

    test('200: applies the move, wakes the bots and returns the new view', async () => {
        const updated = { _id: VALID_ID };
        service.act.mockResolvedValue(updated);
        const res = makeRes();

        await BotGameActionController(
            makeReq({ params: { gameId: VALID_ID }, body: { type: 'raise', amount: 20, hack: 'ignored' } }),
            res
        );

        expect(service.act).toHaveBeenCalledWith(VALID_ID, PLAYER, { type: 'raise', amount: 20 });
        expect(service.runBots).toHaveBeenCalledWith(VALID_ID);
        expect(service.viewFor).toHaveBeenCalledWith(updated, PLAYER);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ game: VIEW });
    });

    test('works with no body at all (the service will reject the unknown move)', async () => {
        service.act.mockRejectedValue(new GameRuleError('Unknown action'));
        const res = makeRes();
        const req = makeReq({ params: { gameId: VALID_ID } });
        req.body = undefined;

        await BotGameActionController(req, res);

        expect(service.act).toHaveBeenCalledWith(VALID_ID, PLAYER, { type: undefined, amount: undefined });
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('400 when the move breaks the rules', async () => {
        service.act.mockRejectedValue(new GameRuleError('It is not your turn'));
        const res = makeRes();

        await BotGameActionController(makeReq({ params: { gameId: VALID_ID }, body: { type: 'call' } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'It is not your turn' });
        expect(service.runBots).not.toHaveBeenCalled();
    });

    test('404 when the game does not exist', async () => {
        service.act.mockRejectedValue(new GameNotFoundError('Game not found'));
        const res = makeRes();

        await BotGameActionController(makeReq({ params: { gameId: VALID_ID }, body: { type: 'call' } }), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('500 for unexpected errors', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        service.act.mockRejectedValue(new Error('boom'));
        const res = makeRes();

        await BotGameActionController(makeReq({ params: { gameId: VALID_ID }, body: { type: 'call' } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
    });
});

describe('BotGameDrawController', () => {
    test('401 when not authenticated', async () => {
        mockGetJoiningPlayer.mockResolvedValue(null);
        const res = makeRes();

        await BotGameDrawController(makeReq({ params: { gameId: VALID_ID }, body: { discard: [0] } }), res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(service.draw).not.toHaveBeenCalled();
    });

    test('400 for an invalid game id', async () => {
        const res = makeRes();

        await BotGameDrawController(makeReq({ params: { gameId: 'bad' }, body: { discard: [] } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('200: passes the chosen cards to the service and wakes the bots', async () => {
        service.draw.mockResolvedValue({ _id: VALID_ID });
        const res = makeRes();

        await BotGameDrawController(makeReq({ params: { gameId: VALID_ID }, body: { discard: [1, 3] } }), res);

        expect(service.draw).toHaveBeenCalledWith(VALID_ID, PLAYER, [1, 3]);
        expect(service.runBots).toHaveBeenCalledWith(VALID_ID);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ game: VIEW });
    });

    test('no discard list means stand pat', async () => {
        service.draw.mockResolvedValue({ _id: VALID_ID });
        const req = makeReq({ params: { gameId: VALID_ID } });
        req.body = undefined;

        await BotGameDrawController(req, makeRes());

        expect(service.draw).toHaveBeenCalledWith(VALID_ID, PLAYER, []);
    });

    test('400 for an illegal draw', async () => {
        service.draw.mockRejectedValue(new GameRuleError('Invalid cards selected'));
        const res = makeRes();

        await BotGameDrawController(makeReq({ params: { gameId: VALID_ID }, body: { discard: [9] } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid cards selected' });
    });
});

describe('GetBotGameController', () => {
    test('400 for an invalid game id', async () => {
        const res = makeRes();

        await GetBotGameController(makeReq({ params: { gameId: 'bad' } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('200: returns the view and restarts the bots', async () => {
        const stored = { _id: VALID_ID };
        service.load.mockResolvedValue(stored);
        const res = makeRes();

        await GetBotGameController(makeReq({ params: { gameId: VALID_ID } }), res);

        expect(service.load).toHaveBeenCalledWith(VALID_ID);
        expect(service.runBots).toHaveBeenCalledWith(VALID_ID);
        expect(service.viewFor).toHaveBeenCalledWith(stored, PLAYER);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ game: VIEW });
    });

    test('spectators (not seated) can still read the public view', async () => {
        mockGetJoiningPlayer.mockResolvedValue(null);
        service.load.mockResolvedValue({ _id: VALID_ID });
        const res = makeRes();

        await GetBotGameController(makeReq({ params: { gameId: VALID_ID } }), res);

        expect(service.viewFor).toHaveBeenCalledWith({ _id: VALID_ID }, null);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('404 for an unknown game', async () => {
        service.load.mockRejectedValue(new GameNotFoundError('Game not found'));
        const res = makeRes();

        await GetBotGameController(makeReq({ params: { gameId: VALID_ID } }), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Game not found' });
    });
});

describe('GetTableBotGameController', () => {
    test('400 for an invalid table id', async () => {
        const res = makeRes();

        await GetTableBotGameController(makeReq({ params: { id: 'bad' } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid table ID' });
    });

    test('404 when the table has never had a game', async () => {
        service.findLatest.mockResolvedValue(null);
        const res = makeRes();

        await GetTableBotGameController(makeReq({ params: { id: TABLE_ID } }), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'No game at this table yet' });
    });

    test('404 when the latest record has no game state', async () => {
        service.findLatest.mockResolvedValue({ _id: 'g1', engine: null });
        const res = makeRes();

        await GetTableBotGameController(makeReq({ params: { id: TABLE_ID } }), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('200: returns the latest hand and restarts the bots', async () => {
        const latest = { _id: 'g1', engine: { round: 'betting1' } };
        service.findLatest.mockResolvedValue(latest);
        const res = makeRes();

        await GetTableBotGameController(makeReq({ params: { id: TABLE_ID } }), res);

        expect(service.findLatest).toHaveBeenCalledWith(TABLE_ID);
        expect(service.runBots).toHaveBeenCalledWith('g1');
        expect(service.viewFor).toHaveBeenCalledWith(latest, PLAYER);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ game: VIEW });
    });

    test('500 for unexpected errors', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        service.findLatest.mockRejectedValue(new Error('boom'));
        const res = makeRes();

        await GetTableBotGameController(makeReq({ params: { id: TABLE_ID } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
    });
});

describe('FoldBotGamePlayerOnLeave (runs before the normal leave controller)', () => {
    test('folds the leaving player, then continues to the next handler', async () => {
        service.leave.mockResolvedValue(null);
        const next = jest.fn();

        await FoldBotGamePlayerOnLeave(makeReq({ params: { id: TABLE_ID } }), makeRes(), next);

        expect(service.leave).toHaveBeenCalledWith(TABLE_ID, PLAYER);
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('skips folding for an invalid table id but still continues', async () => {
        const next = jest.fn();

        await FoldBotGamePlayerOnLeave(makeReq({ params: { id: 'bad' } }), makeRes(), next);

        expect(service.leave).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('skips folding when the player cannot be identified but still continues', async () => {
        mockGetJoiningPlayer.mockResolvedValue(null);
        const next = jest.fn();

        await FoldBotGamePlayerOnLeave(makeReq({ params: { id: TABLE_ID } }), makeRes(), next);

        expect(service.leave).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('a failure while folding never blocks the leave', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        service.leave.mockRejectedValue(new Error('db down'));
        const next = jest.fn();

        await FoldBotGamePlayerOnLeave(makeReq({ params: { id: TABLE_ID } }), makeRes(), next);

        expect(spy).toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
});