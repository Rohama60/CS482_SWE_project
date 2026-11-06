import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// ---- fake Mongoose models: record what the DAO asks them to do ----
const mockSave = jest.fn();
const BotGame = jest.fn(function (data) {
    this.data = data;
    this.save = mockSave;
});
BotGame.findById = jest.fn();
BotGame.findByIdAndUpdate = jest.fn();
BotGame.findOne = jest.fn();

const Table = { findByIdAndUpdate: jest.fn() };
const Account = { findOneAndUpdate: jest.fn(), findById: jest.fn() };
const Guest = { findOneAndUpdate: jest.fn(), findById: jest.fn() };

const mockStartSession = jest.fn();

jest.unstable_mockModule('mongoose', () => ({ default: { startSession: mockStartSession } }));
jest.unstable_mockModule('../src/models/BotGameModel.js', () => ({ default: BotGame }));
jest.unstable_mockModule('../src/models/TableModel.js', () => ({ default: Table }));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({ default: Account }));
jest.unstable_mockModule('../src/models/GuestModel.js', () => ({ default: Guest }));

const {
    createPokerGame,
    findPokerGameById,
    updatePokerGame,
    findLatestGameByTableId,
    runInTransaction,
    addChips,
    getChipBalance,
    finishTableGame
} = await import('../src/dao/BotGameDAO.js');

beforeEach(() => {
    for (const fn of [
        mockSave, BotGame, BotGame.findById, BotGame.findByIdAndUpdate, BotGame.findOne,
        Table.findByIdAndUpdate, Account.findOneAndUpdate, Account.findById,
        Guest.findOneAndUpdate, Guest.findById, mockStartSession
    ]) {
        fn.mockReset();
    }
    // mockReset also clears the constructor body, so put it back
    BotGame.mockImplementation(function (data) {
        this.data = data;
        this.save = mockSave;
    });
});

describe('createPokerGame', () => {
    test('builds a BotGame from the data and saves it', async () => {
        mockSave.mockResolvedValue({ _id: 'g1' });

        const result = await createPokerGame({ tableId: 't1' });

        expect(BotGame).toHaveBeenCalledWith({ tableId: 't1' });
        expect(mockSave).toHaveBeenCalledWith({ session: null });
        expect(result).toEqual({ _id: 'g1' });
    });

    test('saves inside the transaction when a session is given', async () => {
        mockSave.mockResolvedValue({ _id: 'g1' });

        await createPokerGame({ tableId: 't1' }, 'session');

        expect(mockSave).toHaveBeenCalledWith({ session: 'session' });
    });
});

describe('findPokerGameById', () => {
    test('looks the game up by id', async () => {
        BotGame.findById.mockResolvedValue({ _id: 'g1' });

        const result = await findPokerGameById('g1');

        expect(BotGame.findById).toHaveBeenCalledWith('g1');
        expect(result).toEqual({ _id: 'g1' });
    });

    test('returns null when nothing matches', async () => {
        BotGame.findById.mockResolvedValue(null);

        expect(await findPokerGameById('missing')).toBeNull();
    });
});

describe('updatePokerGame', () => {
    test('sets only the given fields and returns the updated game', async () => {
        BotGame.findByIdAndUpdate.mockResolvedValue({ _id: 'g1', settled: true });

        const result = await updatePokerGame('g1', { settled: true });

        expect(BotGame.findByIdAndUpdate).toHaveBeenCalledWith(
            'g1',
            { $set: { settled: true } },
            { returnDocument: 'after', session: null }
        );
        expect(result).toEqual({ _id: 'g1', settled: true });
    });

    test('uses the session when one is given', async () => {
        BotGame.findByIdAndUpdate.mockResolvedValue({});

        await updatePokerGame('g1', { round: 'drawing' }, 'session');

        expect(BotGame.findByIdAndUpdate).toHaveBeenCalledWith(
            'g1',
            { $set: { round: 'drawing' } },
            { returnDocument: 'after', session: 'session' }
        );
    });
});

describe('findLatestGameByTableId', () => {
    test('finds the newest game for the table', async () => {
        const sort = jest.fn().mockResolvedValue({ _id: 'g9' });
        BotGame.findOne.mockReturnValue({ sort });

        const result = await findLatestGameByTableId('t1');

        expect(BotGame.findOne).toHaveBeenCalledWith({ tableId: 't1' });
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(result).toEqual({ _id: 'g9' });
    });

    test('returns null when the table has no games', async () => {
        BotGame.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

        expect(await findLatestGameByTableId('t1')).toBeNull();
    });
});

describe('runInTransaction', () => {
    function fakeSession() {
        return {
            withTransaction: jest.fn(async callback => { await callback(); }),
            endSession: jest.fn().mockResolvedValue(undefined)
        };
    }

    test('runs the function inside a transaction and returns its result', async () => {
        const session = fakeSession();
        mockStartSession.mockResolvedValue(session);
        const work = jest.fn().mockResolvedValue('done');

        const result = await runInTransaction(work);

        expect(work).toHaveBeenCalledWith(session);
        expect(session.withTransaction).toHaveBeenCalledTimes(1);
        expect(result).toBe('done');
    });

    test('always ends the session after success', async () => {
        const session = fakeSession();
        mockStartSession.mockResolvedValue(session);

        await runInTransaction(async () => 1);

        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    test('ends the session and passes the error on when the work fails', async () => {
        const session = fakeSession();
        mockStartSession.mockResolvedValue(session);

        await expect(runInTransaction(async () => { throw new Error('boom'); })).rejects.toThrow('boom');

        expect(session.endSession).toHaveBeenCalledTimes(1);
    });
});

describe('addChips', () => {
    test('adds to a registered users balance', async () => {
        Account.findOneAndUpdate.mockResolvedValue({ chipamount: 550 });

        const result = await addChips({ kind: 'user', refId: 'a1' }, 50, 'session');

        expect(Account.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'a1' },
            { $inc: { chipamount: 50 } },
            { new: true, session: 'session' }
        );
        expect(Guest.findOneAndUpdate).not.toHaveBeenCalled();
        expect(result).toEqual({ chipamount: 550 });
    });

    test('adds to a guests balance', async () => {
        Guest.findOneAndUpdate.mockResolvedValue({ chipamount: 520 });

        await addChips({ kind: 'guest', refId: 'g1' }, 20, 'session');

        expect(Guest.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'g1' },
            { $inc: { chipamount: 20 } },
            { new: true, session: 'session' }
        );
        expect(Account.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('a negative amount takes chips away', async () => {
        Guest.findOneAndUpdate.mockResolvedValue({});

        await addChips({ kind: 'guest', refId: 'g1' }, -5, 'session');

        expect(Guest.findOneAndUpdate.mock.calls[0][1]).toEqual({ $inc: { chipamount: -5 } });
    });
});

describe('getChipBalance', () => {
    test('returns a users chip amount', async () => {
        const select = jest.fn().mockResolvedValue({ chipamount: 500 });
        Account.findById.mockReturnValue({ select });

        const balance = await getChipBalance({ kind: 'user', refId: 'a1' });

        expect(Account.findById).toHaveBeenCalledWith('a1');
        expect(select).toHaveBeenCalledWith('chipamount');
        expect(balance).toBe(500);
    });

    test('returns a guests chip amount', async () => {
        Guest.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ chipamount: 250 }) });

        expect(await getChipBalance({ kind: 'guest', refId: 'g1' })).toBe(250);
        expect(Account.findById).not.toHaveBeenCalled();
    });

    test('a balance of zero is returned as zero, not null', async () => {
        Guest.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ chipamount: 0 }) });

        expect(await getChipBalance({ kind: 'guest', refId: 'g1' })).toBe(0);
    });

    test('returns null when the player does not exist', async () => {
        Account.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

        expect(await getChipBalance({ kind: 'user', refId: 'ghost' })).toBeNull();
    });
});

describe('finishTableGame', () => {
    test('frees the table and counts the hand', async () => {
        Table.findByIdAndUpdate.mockResolvedValue({ _id: 't1', gameInProgress: false, hands: 4 });

        const result = await finishTableGame('t1', 'session');

        expect(Table.findByIdAndUpdate).toHaveBeenCalledWith(
            't1',
            { $set: { gameInProgress: false }, $inc: { hands: 1 } },
            { returnDocument: 'after', session: 'session' }
        );
        expect(result.gameInProgress).toBe(false);
    });
});