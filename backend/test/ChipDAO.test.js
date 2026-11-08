import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const createModel = () => ({
    findOneAndUpdate: jest.fn(),
    findById: jest.fn()
});

const Account = createModel();
const Guest = createModel();

jest.unstable_mockModule('../src/models/AccountModel.js', () => ({ default: Account }));
jest.unstable_mockModule('../src/models/GuestModel.js', () => ({ default: Guest }));

const { deductChips, getPlayerChips } = await import('../src/dao/ChipDAO.js');

beforeEach(() => {
    for (const model of [Account, Guest]) {
        model.findOneAndUpdate.mockReset();
        model.findById.mockReset();
    }
});

describe('deductChips', () => {
    test('deducts chips from a registered user only when enough chips are available', async () => {
        const updatedAccount = { _id: 'account-1', chipamount: 450 };
        Account.findOneAndUpdate.mockResolvedValue(updatedAccount);

        const result = await deductChips({ kind: 'user', refId: 'account-1' }, 50, 'session-1');

        expect(Account.findOneAndUpdate).toHaveBeenCalledWith(
            {
                _id: 'account-1',
                chipamount: { $gte: 50 }
            },
            { $inc: { chipamount: -50 } },
            { new: true, session: 'session-1' }
        );
        expect(Guest.findOneAndUpdate).not.toHaveBeenCalled();
        expect(result).toBe(updatedAccount);
    });

    test('deducts chips from a guest', async () => {
        const updatedGuest = { _id: 'guest-1', chipamount: 300 };
        Guest.findOneAndUpdate.mockResolvedValue(updatedGuest);

        const result = await deductChips({ kind: 'guest', refId: 'guest-1' }, 200);

        expect(Guest.findOneAndUpdate).toHaveBeenCalledWith(
            {
                _id: 'guest-1',
                chipamount: { $gte: 200 }
            },
            { $inc: { chipamount: -200 } },
            { new: true, session: undefined }
        );
        expect(Account.findOneAndUpdate).not.toHaveBeenCalled();
        expect(result).toBe(updatedGuest);
    });

    test('returns null when the player has insufficient chips or does not exist', async () => {
        Account.findOneAndUpdate.mockResolvedValue(null);

        const result = await deductChips({ kind: 'user', refId: 'account-1' }, 600);

        expect(result).toBeNull();
        expect(Account.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'account-1', chipamount: { $gte: 600 } },
            { $inc: { chipamount: -600 } },
            { new: true, session: undefined }
        );
    });
});

describe('getPlayerChips', () => {
    test('gets a registered user chip balance using a limited projection', async () => {
        const account = { chipamount: 500 };
        const select = jest.fn().mockResolvedValue(account);
        Account.findById.mockReturnValue({ select });

        const result = await getPlayerChips({ kind: 'user', refId: 'account-1' });

        expect(Account.findById).toHaveBeenCalledWith('account-1');
        expect(select).toHaveBeenCalledWith('chipamount');
        expect(Guest.findById).not.toHaveBeenCalled();
        expect(result).toBe(account);
    });

    test('gets a guest chip balance', async () => {
        const guest = { chipamount: 250 };
        const select = jest.fn().mockResolvedValue(guest);
        Guest.findById.mockReturnValue({ select });

        const result = await getPlayerChips({ kind: 'guest', refId: 'guest-1' });

        expect(Guest.findById).toHaveBeenCalledWith('guest-1');
        expect(select).toHaveBeenCalledWith('chipamount');
        expect(Account.findById).not.toHaveBeenCalled();
        expect(result).toBe(guest);
    });

    test('returns null when the player cannot be found', async () => {
        const select = jest.fn().mockResolvedValue(null);
        Account.findById.mockReturnValue({ select });

        await expect(getPlayerChips({ kind: 'user', refId: 'missing' })).resolves.toBeNull();
    });
});
