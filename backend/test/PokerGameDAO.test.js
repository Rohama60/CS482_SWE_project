import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockSave = jest.fn();
const PokerGameModel = jest.fn(function (data) {
    this.data = data;
    this.save = mockSave;
});

PokerGameModel.findById = jest.fn();
PokerGameModel.find = jest.fn();

jest.unstable_mockModule('../src/models/PokerGameModel.js', () => ({
    default: PokerGameModel
}));

const {
    createPokerGame,
    findPokerGameById,
    findGamesByTableId
} = await import('../src/dao/PokerGameDAO.js');

beforeEach(() => {
    for (const fn of [
        mockSave,
        PokerGameModel,
        PokerGameModel.findById,
        PokerGameModel.find
    ]) {
        fn.mockReset();
    }

    PokerGameModel.mockImplementation(function (data) {
        this.data = data;
        this.save = mockSave;
    });
});

describe('createPokerGame', () => {
    test('constructs and saves a game with no session by default', async () => {
        const gameData = { tableId: 'table-1', players: ['player-1'] };
        const savedGame = { _id: 'game-1', ...gameData };
        mockSave.mockResolvedValue(savedGame);

        const result = await createPokerGame(gameData);

        expect(PokerGameModel).toHaveBeenCalledWith(gameData);
        expect(mockSave).toHaveBeenCalledWith({ session: null });
        expect(result).toBe(savedGame);
    });

    test('saves with the supplied transaction session', async () => {
        mockSave.mockResolvedValue({ _id: 'game-1' });

        await createPokerGame({ tableId: 'table-1' }, 'session-1');

        expect(mockSave).toHaveBeenCalledWith({ session: 'session-1' });
    });

    test('propagates save errors', async () => {
        const error = new Error('database unavailable');
        mockSave.mockRejectedValue(error);

        await expect(createPokerGame({ tableId: 'table-1' })).rejects.toBe(error);
    });
});

describe('findPokerGameById', () => {
    test('finds a game by ID', async () => {
        const game = { _id: 'game-1', tableId: 'table-1' };
        PokerGameModel.findById.mockResolvedValue(game);

        const result = await findPokerGameById('game-1');

        expect(PokerGameModel.findById).toHaveBeenCalledWith('game-1');
        expect(result).toBe(game);
    });

    test('returns null when the game does not exist', async () => {
        PokerGameModel.findById.mockResolvedValue(null);

        await expect(findPokerGameById('missing-game')).resolves.toBeNull();
    });

    test('propagates lookup errors', async () => {
        const error = new Error('database unavailable');
        PokerGameModel.findById.mockRejectedValue(error);

        await expect(findPokerGameById('game-1')).rejects.toBe(error);
    });
});

describe('findGamesByTableId', () => {
    test('finds games for a table sorted newest first', async () => {
        const games = [
            { _id: 'game-2', createdAt: '2026-11-08T10:00:00.000Z' },
            { _id: 'game-1', createdAt: '2026-11-08T09:00:00.000Z' }
        ];
        const sort = jest.fn().mockResolvedValue(games);
        PokerGameModel.find.mockReturnValue({ sort });

        const result = await findGamesByTableId('table-1');

        expect(PokerGameModel.find).toHaveBeenCalledWith({ tableId: 'table-1' });
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(result).toBe(games);
    });

    test('returns an empty list when the table has no games', async () => {
        const sort = jest.fn().mockResolvedValue([]);
        PokerGameModel.find.mockReturnValue({ sort });

        await expect(findGamesByTableId('empty-table')).resolves.toEqual([]);
    });

    test('propagates query errors', async () => {
        const error = new Error('database unavailable');
        const sort = jest.fn().mockRejectedValue(error);
        PokerGameModel.find.mockReturnValue({ sort });

        await expect(findGamesByTableId('table-1')).rejects.toBe(error);
    });
});
