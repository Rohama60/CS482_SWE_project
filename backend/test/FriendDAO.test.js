import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// P11: the database functions behind friends and friend requests.
// The models are faked, so these check what each function asks the database for.

const mockPopulate2 = jest.fn();
const mockPopulate1 = jest.fn(() => ({ populate: mockPopulate2 }));
const mockSort = jest.fn();
const mockPopulateThenSort = jest.fn(() => ({ sort: mockSort }));

const Friendship = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn()
};
const Account = { findOne: jest.fn() };
const Table = { find: jest.fn() };

jest.unstable_mockModule('../src/models/FriendshipModel.js', () => ({ default: Friendship }));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({ default: Account }));
jest.unstable_mockModule('../src/models/TableModel.js', () => ({ default: Table }));

const {
    findAccountByPlayer,
    findFriendshipBetween,
    createFriendRequest,
    findFriendsOf,
    findIncomingRequests,
    acceptFriendRequest,
    deleteFriendRequest,
    deleteFriendship,
    findTablesWithPlayers
} = await import('../src/dao/FriendDAO.js');

const ME = 'account-me';
const THEM = 'account-them';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('findAccountByPlayer', () => {
    test('an email is looked up in lowercase', async () => {
        const account = { username: 'Josue' };
        Account.findOne.mockResolvedValue(account);

        const result = await findAccountByPlayer('  Josue@Example.COM ');

        expect(Account.findOne).toHaveBeenCalledWith({ email: 'josue@example.com' });
        expect(result).toBe(account);
    });

    test('a username matches any capitalization, but only the whole name', async () => {
        Account.findOne.mockResolvedValue(null);

        await findAccountByPlayer('josue');

        const { username } = Account.findOne.mock.calls[0][0];
        expect(username.test('Josue')).toBe(true);
        expect(username.test('JOSUE')).toBe(true);
        expect(username.test('Josue2')).toBe(false);
        expect(username.test('xjosue')).toBe(false);
    });

    test('special characters in a username are matched exactly', async () => {
        Account.findOne.mockResolvedValue(null);

        await findAccountByPlayer('a.b*');

        const { username } = Account.findOne.mock.calls[0][0];
        expect(username.test('a.b*')).toBe(true);
        expect(username.test('axbbb')).toBe(false);
    });

    test('returns null when nobody matches', async () => {
        Account.findOne.mockResolvedValue(null);
        expect(await findAccountByPlayer('Nobody')).toBeNull();
    });
});

describe('findFriendshipBetween', () => {
    test('looks in both directions', async () => {
        const friendship = { status: 'pending' };
        Friendship.findOne.mockResolvedValue(friendship);

        const result = await findFriendshipBetween(ME, THEM);

        expect(Friendship.findOne).toHaveBeenCalledWith({
            $or: [
                { requester: ME, recipient: THEM },
                { requester: THEM, recipient: ME }
            ]
        });
        expect(result).toBe(friendship);
    });
});

describe('createFriendRequest', () => {
    test('creates a pending request from one player to the other', async () => {
        const created = { _id: 'request-1' };
        Friendship.create.mockResolvedValue(created);

        const result = await createFriendRequest(ME, THEM);

        expect(Friendship.create).toHaveBeenCalledWith({ requester: ME, recipient: THEM, status: 'pending' });
        expect(result).toBe(created);
    });
});

describe('findFriendsOf', () => {
    test('finds accepted friendships on either side and fills in both players', async () => {
        const friendships = [{ requester: {}, recipient: {} }];
        Friendship.find.mockReturnValue({ populate: mockPopulate1 });
        mockPopulate2.mockResolvedValue(friendships);

        const result = await findFriendsOf(ME);

        expect(Friendship.find).toHaveBeenCalledWith({
            status: 'accepted',
            $or: [{ requester: ME }, { recipient: ME }]
        });
        // Only the public info about each player, never emails or passwords
        expect(mockPopulate1).toHaveBeenCalledWith('requester', 'username displayName chipamount');
        expect(mockPopulate2).toHaveBeenCalledWith('recipient', 'username displayName chipamount');
        expect(result).toBe(friendships);
    });
});

describe('findIncomingRequests', () => {
    test('finds pending requests sent to you, newest first', async () => {
        const requests = [{ _id: 'request-1' }];
        Friendship.find.mockReturnValue({ populate: mockPopulateThenSort });
        mockSort.mockResolvedValue(requests);

        const result = await findIncomingRequests(ME);

        expect(Friendship.find).toHaveBeenCalledWith({ recipient: ME, status: 'pending' });
        expect(mockPopulateThenSort).toHaveBeenCalledWith('requester', 'username displayName chipamount');
        expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(result).toBe(requests);
    });
});

describe('acceptFriendRequest', () => {
    test('only the person who got the request can accept it', async () => {
        const accepted = { status: 'accepted' };
        Friendship.findOneAndUpdate.mockResolvedValue(accepted);

        const result = await acceptFriendRequest('request-1', ME);

        expect(Friendship.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'request-1', recipient: ME, status: 'pending' },
            { $set: { status: 'accepted' } },
            { returnDocument: 'after' }
        );
        expect(result).toBe(accepted);
    });

    test('returns null if there is no matching request', async () => {
        Friendship.findOneAndUpdate.mockResolvedValue(null);
        expect(await acceptFriendRequest('request-1', THEM)).toBeNull();
    });
});

describe('deleteFriendRequest', () => {
    test('only the person who got the request can ignore it', async () => {
        Friendship.findOneAndDelete.mockResolvedValue({ _id: 'request-1' });

        await deleteFriendRequest('request-1', ME);

        expect(Friendship.findOneAndDelete).toHaveBeenCalledWith({ _id: 'request-1', recipient: ME, status: 'pending' });
    });
});

describe('deleteFriendship', () => {
    test('removes an accepted friendship no matter who sent the request', async () => {
        Friendship.findOneAndDelete.mockResolvedValue({ status: 'accepted' });

        await deleteFriendship(ME, THEM);

        expect(Friendship.findOneAndDelete).toHaveBeenCalledWith({
            status: 'accepted',
            $or: [
                { requester: ME, recipient: THEM },
                { requester: THEM, recipient: ME }
            ]
        });
    });
});

describe('findTablesWithPlayers', () => {
    test('finds tables where any of these players has a seat', async () => {
        const tables = [{ name: 'Velvet Room' }];
        Table.find.mockResolvedValue(tables);

        const result = await findTablesWithPlayers([{ toString: () => 'id-1' }, 'id-2']);

        expect(Table.find).toHaveBeenCalledWith({ 'seats.refId': { $in: ['id-1', 'id-2'] } }, 'name seats');
        expect(result).toBe(tables);
    });
});
