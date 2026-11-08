import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockSave = jest.fn();
const Account = jest.fn(function (data) {
    this.data = data;
    this.save = mockSave;
});

Account.findOne = jest.fn();
Account.findOneAndUpdate = jest.fn();

jest.unstable_mockModule('../src/models/AccountModel.js', () => ({ default: Account }));

const {
    createAccount,
    findAccountByEmail,
    findAccountByUsername,
    setAccountChips
} = await import('../src/dao/AccountDAO.js');

beforeEach(() => {
    for (const fn of [
        mockSave,
        Account,
        Account.findOne,
        Account.findOneAndUpdate
    ]) {
        fn.mockReset();
    }

    Account.mockImplementation(function (data) {
        this.data = data;
        this.save = mockSave;
    });
});

describe('createAccount', () => {
    test('constructs and saves an account with the supplied data', async () => {
        const accountData = {
            userId: 'user-1',
            email: 'player@example.com',
            username: 'player1'
        };
        const savedAccount = { _id: 'account-1', ...accountData };
        mockSave.mockResolvedValue(savedAccount);

        const result = await createAccount(accountData);

        expect(Account).toHaveBeenCalledWith(accountData);
        expect(mockSave).toHaveBeenCalledTimes(1);
        expect(result).toBe(savedAccount);
    });

    test('propagates save errors', async () => {
        const error = new Error('database unavailable');
        mockSave.mockRejectedValue(error);

        await expect(createAccount({ email: 'player@example.com' })).rejects.toBe(error);
    });
});

describe('findAccountByEmail', () => {
    test('finds an account by email', async () => {
        const account = { email: 'player@example.com' };
        Account.findOne.mockResolvedValue(account);

        const result = await findAccountByEmail(account.email);

        expect(Account.findOne).toHaveBeenCalledWith({ email: account.email });
        expect(result).toBe(account);
    });

    test('returns null when no email matches', async () => {
        Account.findOne.mockResolvedValue(null);

        expect(await findAccountByEmail('missing@example.com')).toBeNull();
    });
});

describe('findAccountByUsername', () => {
    test('finds an account by username', async () => {
        const account = { username: 'player1' };
        Account.findOne.mockResolvedValue(account);

        const result = await findAccountByUsername(account.username);

        expect(Account.findOne).toHaveBeenCalledWith({ username: account.username });
        expect(result).toBe(account);
    });

    test('returns null when no username matches', async () => {
        Account.findOne.mockResolvedValue(null);

        expect(await findAccountByUsername('missing-user')).toBeNull();
    });
});

describe('setAccountChips', () => {
    test('updates chips and returns the updated account', async () => {
        const updatedAccount = { userId: 'user-1', chipamount: 750 };
        Account.findOneAndUpdate.mockResolvedValue(updatedAccount);

        const result = await setAccountChips('user-1', 750);

        expect(Account.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: 'user-1' },
            { $set: { chipamount: 750 } },
            { returnDocument: 'after' }
        );
        expect(result).toBe(updatedAccount);
    });

    test('returns null when the account does not exist', async () => {
        Account.findOneAndUpdate.mockResolvedValue(null);

        expect(await setAccountChips('missing-user', 750)).toBeNull();
    });
});
