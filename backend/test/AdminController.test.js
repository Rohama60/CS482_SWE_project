import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockIsValidObjectId = jest.fn();
const mockFindById = jest.fn();
const mockFindByIdAndDelete = jest.fn();
const mockAuditCreate = jest.fn();
const mockUpdateOne = jest.fn();
const mockCollection = jest.fn(() => ({ updateOne: mockUpdateOne }));
const mockDb = jest.fn(() => ({ collection: mockCollection }));
const mockAccount = {
    _id: 'account-1',
    userId: 'auth-user-1',
    email: 'player@example.com',
    username: 'player',
    chipamount: 500,
    status: 'active',
    save: jest.fn(),
};

jest.unstable_mockModule('mongoose', () => ({
    default: { isValidObjectId: mockIsValidObjectId },
}));
jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { getSession: jest.fn() } },
    mongoClient: { db: mockDb },
}));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
    default: {
        findById: mockFindById,
        findByIdAndDelete: mockFindByIdAndDelete,
    },
}));
jest.unstable_mockModule('../src/models/AuditLog.js', () => ({
    default: { create: mockAuditCreate },
}));
jest.unstable_mockModule('better-auth/crypto', () => ({
    hashPassword: jest.fn(async password => `hashed:${password}`),
}));

const { AdminPasswordResetController, DeleteAdminUserController, UpdateAdminPlayerController } =
    await import('../src/controllers/AdminController.js');

function makeResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockIsValidObjectId.mockReturnValue(true);
    mockFindById.mockResolvedValue(mockAccount);
    mockFindByIdAndDelete.mockResolvedValue(mockAccount);
    mockUpdateOne.mockResolvedValue({ matchedCount: 1 });
    mockAccount.chipamount = 500;
    mockAccount.status = 'active';
    mockAccount.save.mockResolvedValue(mockAccount);
});

describe('admin player management', () => {
    test('updates chip balance and ban status on the application account', async () => {
        const res = makeResponse();

        await UpdateAdminPlayerController({
            params: { id: 'account-1' },
            body: { chips: 725, status: 'banned' },
            adminAccount: { _id: 'admin-account' },
        }, res);

        expect(mockFindById).toHaveBeenCalledWith('account-1');
        expect(mockAccount.chipamount).toBe(725);
        expect(mockAccount.status).toBe('banned');
        expect(mockAccount.save).toHaveBeenCalled();
        expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE_PLAYER',
            targetUserId: 'account-1',
        }));
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('updates the Better Auth credential password when supplied', async () => {
        const res = makeResponse();

        await UpdateAdminPlayerController({
            params: { id: 'account-1' },
            body: { chips: 500, password: 'strong-pass-1' },
            adminAccount: { _id: 'admin-account' },
        }, res);

        expect(mockDb).toHaveBeenCalledWith('poker');
        expect(mockCollection).toHaveBeenCalledWith('account');
        expect(mockUpdateOne).toHaveBeenCalledWith(
            { userId: 'auth-user-1', providerId: 'credential' },
            { $set: { password: 'hashed:strong-pass-1' } },
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('admin reset updates the Better Auth credential for an account ID', async () => {
        const res = makeResponse();

        await AdminPasswordResetController({
            body: { targetUserId: 'account-1', newPassword: 'new-password-1' },
        }, res);

        expect(mockFindById).toHaveBeenCalledWith('account-1');
        expect(mockUpdateOne).toHaveBeenCalledWith(
            { userId: 'auth-user-1', providerId: 'credential' },
            { $set: { password: 'hashed:new-password-1' } },
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('rejects invalid chip balances without changing the account', async () => {
        const res = makeResponse();

        await UpdateAdminPlayerController({
            params: { id: 'account-1' },
            body: { chips: -1 },
            adminAccount: { _id: 'admin-account' },
        }, res);

        expect(mockAccount.save).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Chip balance must be a non-negative number' });
    });

    test('prevents an administrator from deleting their own account', async () => {
        const res = makeResponse();

        await DeleteAdminUserController({
            params: { id: 'account-1' },
            adminAccount: { _id: 'account-1' },
        }, res);

        expect(mockFindByIdAndDelete).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });
});
