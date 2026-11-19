import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// P13: As a Player, I want to be able to see the games that I have played,
// so that I can see how I've been doing.

const mockGetSession = jest.fn();
const mockAccountFindOne = jest.fn();
const mockFindFinishedHandsFor = jest.fn();

// Fake login and database so no real data is touched
jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { getSession: mockGetSession } }
}));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
    default: { findOne: mockAccountFindOne }
}));
jest.unstable_mockModule('../src/dao/GameHistoryDAO.js', () => ({
    findFinishedHandsFor: mockFindFinishedHandsFor,
}));

const {
    GetGameHistoryController,
    toHistoryEntry,
    toStats,
    MEMBERS_ONLY,
    RECENT_LIMIT,
} = await import('../src/controllers/GameHistoryController.js');

const ME = { _id: 'acct-me', username: 'PrestonA7' };
const FINISHED_AT = new Date('2026-11-18T20:00:00Z');

// A finished hand, like the game saves it
function hand({ id = 'g1', myStart = 1000, myEnd = 1040, won = true, folded = false, table = { name: 'Velvet Room' } } = {}) {
    return {
        _id: id,
        tableId: table,
        updatedAt: FINISHED_AT,
        createdAt: new Date('2026-11-18T19:58:00Z'),
        startChips: { 'acct-me': myStart, 'bot-1': 1000 },
        engine: {
            participants: [
                { refId: 'acct-me', kind: 'user', displayName: 'Preston', chips: myEnd, folded },
                { refId: 'bot-1', kind: 'bot', displayName: 'Ace (CPU)', chips: 960, folded: !won },
            ],
            winners: won ? [{ refId: 'acct-me', amount: 80, handName: 'Two Pair' }] : [{ refId: 'bot-1', amount: 80, handName: 'Flush' }],
            resultText: won ? 'Preston wins $80 with Two Pair' : 'Ace (CPU) wins $80 with Flush',
        },
    };
}

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function loggedIn() {
    mockGetSession.mockResolvedValue({ user: { id: 'auth-me' } });
    mockAccountFindOne.mockResolvedValue(ME);
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('One hand from your side (toHistoryEntry)', () => {
    test('a hand you won', () => {
        expect(toHistoryEntry(hand(), 'acct-me')).toEqual({
            id: 'g1',
            tableName: 'Velvet Room',
            playedAt: FINISHED_AT,
            result: 'won',
            folded: false,
            chipsChange: 40,
            handName: 'Two Pair',
            summary: 'Preston wins $80 with Two Pair',
            players: 2,
            opponents: ['Ace (CPU)'],
        });
    });

    test('a hand you lost', () => {
        const entry = toHistoryEntry(hand({ won: false, myEnd: 960 }), 'acct-me');
        expect(entry.result).toBe('lost');
        expect(entry.chipsChange).toBe(-40);
        expect(entry.handName).toBeNull();
        expect(entry.summary).toBe('Ace (CPU) wins $80 with Flush');
    });

    test('a hand you folded', () => {
        const entry = toHistoryEntry(hand({ won: false, folded: true, myEnd: 990 }), 'acct-me');
        expect(entry.result).toBe('lost');
        expect(entry.folded).toBe(true);
        expect(entry.chipsChange).toBe(-10);
    });

    test('a split pot counts as a win', () => {
        const split = hand();
        split.engine.winners.push({ refId: 'bot-1', amount: 40, handName: 'Two Pair' });
        expect(toHistoryEntry(split, 'acct-me').result).toBe('won');
    });

    test('a table that was deleted shows as "Table"', () => {
        expect(toHistoryEntry(hand({ table: null }), 'acct-me').tableName).toBe('Table');
    });

    test('ids are compared as text', () => {
        expect(toHistoryEntry(hand(), { toString: () => 'acct-me' }).result).toBe('won');
    });

    test('uses the start time if there is no finish time', () => {
        const old = hand();
        delete old.updatedAt;
        expect(toHistoryEntry(old, 'acct-me').playedAt).toEqual(new Date('2026-11-18T19:58:00Z'));
    });

    test('missing pieces of an old hand do not break it', () => {
        expect(toHistoryEntry({ _id: 'g9' }, 'acct-me')).toEqual({
            id: 'g9', tableName: 'Table', playedAt: undefined, result: 'lost', folded: false,
            chipsChange: 0, handName: null, summary: '', players: 0, opponents: [],
        });
    });

    test('a winner with no hand name (everyone else folded) has a null hand name', () => {
        const foldedOut = hand();
        foldedOut.engine.winners = [{ refId: 'acct-me', amount: 15, handName: null }];
        expect(toHistoryEntry(foldedOut, 'acct-me').handName).toBeNull();
    });
});

describe('Adding up your stats (toStats)', () => {
    test('counts wins, losses, win rate and chips won or lost', () => {
        const entries = [
            { result: 'won', chipsChange: 40 },
            { result: 'lost', chipsChange: -10 },
            { result: 'lost', chipsChange: -20 },
        ];
        expect(toStats(entries)).toEqual({ hands: 3, wins: 1, losses: 2, winRate: 33, netChips: 10 });
    });

    test('no hands means all zeros', () => {
        expect(toStats([])).toEqual({ hands: 0, wins: 0, losses: 0, winRate: 0, netChips: 0 });
    });
});

describe('GET /api/history', () => {
    test('returns your stats and recent games', async () => {
        loggedIn();
        mockFindFinishedHandsFor.mockResolvedValue([hand({ id: 'g2' }), hand({ id: 'g1', won: false, myEnd: 960 })]);
        const res = makeRes();

        await GetGameHistoryController({ headers: { cookie: 'session=abc' } }, res);

        expect(mockAccountFindOne).toHaveBeenCalledWith({ userId: 'auth-me' });
        expect(mockFindFinishedHandsFor).toHaveBeenCalledWith('acct-me');
        expect(res.status).toHaveBeenCalledWith(200);
        const { stats, games } = res.json.mock.calls[0][0];
        expect(stats).toEqual({ hands: 2, wins: 1, losses: 1, winRate: 50, netChips: 0 });
        expect(games.map(game => game.id)).toEqual(['g2', 'g1']);
    });

    test(`the list shows the newest ${RECENT_LIMIT}, but stats count every hand`, async () => {
        loggedIn();
        mockFindFinishedHandsFor.mockResolvedValue(Array.from({ length: RECENT_LIMIT + 5 }, (_, i) => hand({ id: `g${i}` })));
        const res = makeRes();

        await GetGameHistoryController({ headers: {} }, res);

        const { stats, games } = res.json.mock.calls[0][0];
        expect(games).toHaveLength(RECENT_LIMIT);
        expect(stats.hands).toBe(RECENT_LIMIT + 5);
    });

    test('no hands yet gives empty history', async () => {
        loggedIn();
        mockFindFinishedHandsFor.mockResolvedValue([]);
        const res = makeRes();

        await GetGameHistoryController({}, res);

        expect(res.json).toHaveBeenCalledWith({ stats: { hands: 0, wins: 0, losses: 0, winRate: 0, netChips: 0 }, games: [] });
    });

    test('guests are told to log in', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();

        await GetGameHistoryController({ headers: {} }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: MEMBERS_ONLY });
        expect(mockFindFinishedHandsFor).not.toHaveBeenCalled();
    });

    test('a login with no player account is treated like a guest', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'auth-me' } });
        mockAccountFindOne.mockResolvedValue(null);
        const res = makeRes();

        await GetGameHistoryController({ headers: {} }, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a database error returns 500', async () => {
        loggedIn();
        mockFindFinishedHandsFor.mockRejectedValue(new Error('db down'));
        const res = makeRes();

        await GetGameHistoryController({ headers: {} }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load game history' });
    });
});
