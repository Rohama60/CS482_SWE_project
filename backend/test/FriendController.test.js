import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// P11: As a Player, I want to be able to add friends to my friends list,
// so that I can play games with my friends.

const mockGetSession = jest.fn();
const mockAccountFindOne = jest.fn();
const mockDAO = {
    findAccountByPlayer: jest.fn(),
    findFriendshipBetween: jest.fn(),
    createFriendRequest: jest.fn(),
    findFriendsOf: jest.fn(),
    findIncomingRequests: jest.fn(),
    acceptFriendRequest: jest.fn(),
    deleteFriendRequest: jest.fn(),
    deleteFriendship: jest.fn(),
    findTablesWithPlayers: jest.fn(),
};

// Fake login and database so no real data is touched
jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { getSession: mockGetSession } }
}));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
    default: { findOne: mockAccountFindOne }
}));
jest.unstable_mockModule('../src/dao/FriendDAO.js', () => mockDAO);

const {
    GetFriendsController,
    GetFriendRequestsController,
    SendFriendRequestController,
    AcceptFriendRequestController,
    DeclineFriendRequestController,
    RemoveFriendController,
    toPlayer,
} = await import('../src/controllers/FriendController.js');

const ME = { _id: '507f1f77bcf86cd799439001', username: 'PrestonA7', displayName: 'Preston', chipamount: 500 };
const JOSUE = { _id: '507f1f77bcf86cd799439002', username: 'Josue', displayName: 'Josue S', chipamount: 925 };
const AYANA = { _id: '507f1f77bcf86cd799439003', username: 'Ayana', chipamount: 300 };
const REQUEST_ID = '507f1f77bcf86cd799439099';

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function loggedIn() {
    mockGetSession.mockResolvedValue({ user: { id: 'auth-me' } });
    mockAccountFindOne.mockResolvedValue(ME);
}

function loggedOut() {
    mockGetSession.mockResolvedValue(null);
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Showing a player', () => {
    test('uses the username when there is no display name', () => {
        expect(toPlayer(AYANA)).toEqual({ id: AYANA._id, username: 'Ayana', displayName: 'Ayana', chips: 300 });
    });

    test('shows 0 chips if the amount is missing', () => {
        expect(toPlayer({ _id: 'x', username: 'New' }).chips).toBe(0);
    });
});

describe('Get friends (P11)', () => {
    test('lists friends from either side of the friendship', async () => {
        loggedIn();
        mockDAO.findFriendsOf.mockResolvedValue([
            { requester: ME, recipient: JOSUE },
            { requester: AYANA, recipient: ME },
        ]);
        mockDAO.findTablesWithPlayers.mockResolvedValue([]);
        const res = makeRes();

        await GetFriendsController({ headers: {} }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const { friends } = res.json.mock.calls[0][0];
        expect(friends.map(f => f.username)).toEqual(['Josue', 'Ayana']);
        expect(friends[0]).toEqual({
            id: JOSUE._id, username: 'Josue', displayName: 'Josue S', chips: 925,
            status: 'idle', activity: 'Not at a table',
        });
    });

    test('a friend sitting at a table shows as playing there', async () => {
        loggedIn();
        mockDAO.findFriendsOf.mockResolvedValue([{ requester: ME, recipient: JOSUE }]);
        mockDAO.findTablesWithPlayers.mockResolvedValue([
            { _id: 'table-1', name: 'Velvet Room', seats: [{ refId: JOSUE._id }] },
        ]);
        const res = makeRes();

        await GetFriendsController({ headers: {} }, res);

        expect(mockDAO.findTablesWithPlayers).toHaveBeenCalledWith([JOSUE._id]);
        const [friend] = res.json.mock.calls[0][0].friends;
        expect(friend.status).toBe('playing');
        expect(friend.activity).toBe('At the Velvet Room');
        // So the Friends page can offer to join them
        expect(friend.tableId).toBe('table-1');
    });

    test('a table with no seats list is skipped safely', async () => {
        loggedIn();
        mockDAO.findFriendsOf.mockResolvedValue([{ requester: ME, recipient: JOSUE }]);
        mockDAO.findTablesWithPlayers.mockResolvedValue([{ name: 'Empty' }]);
        const res = makeRes();

        await GetFriendsController({ headers: {} }, res);

        expect(res.json.mock.calls[0][0].friends[0].status).toBe('idle');
    });

    test('no friends means no table lookup', async () => {
        loggedIn();
        mockDAO.findFriendsOf.mockResolvedValue([]);
        const res = makeRes();

        await GetFriendsController({ headers: {} }, res);

        expect(mockDAO.findTablesWithPlayers).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ friends: [] });
    });

    test('a friend whose account was deleted is left out', async () => {
        loggedIn();
        mockDAO.findFriendsOf.mockResolvedValue([{ requester: ME, recipient: null }]);
        const res = makeRes();

        await GetFriendsController({ headers: {} }, res);

        expect(res.json).toHaveBeenCalledWith({ friends: [] });
    });

    test('guests and logged-out players are turned away', async () => {
        loggedOut();
        const res = makeRes();
        await GetFriendsController({ headers: {} }, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a logged-in session with no account is turned away', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'auth-me' } });
        mockAccountFindOne.mockResolvedValue(null);
        const res = makeRes();
        await GetFriendsController({}, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a database error returns 500', async () => {
        loggedIn();
        mockDAO.findFriendsOf.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await GetFriendsController({ headers: {} }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Get friend requests (P11)', () => {
    test('lists requests sent to you', async () => {
        loggedIn();
        mockDAO.findIncomingRequests.mockResolvedValue([{ _id: REQUEST_ID, requester: JOSUE }]);
        const res = makeRes();

        await GetFriendRequestsController({ headers: {} }, res);

        expect(mockDAO.findIncomingRequests).toHaveBeenCalledWith(ME._id);
        expect(res.json).toHaveBeenCalledWith({
            requests: [{ id: REQUEST_ID, from: toPlayer(JOSUE) }],
        });
    });

    test('a request from a deleted account is left out', async () => {
        loggedIn();
        mockDAO.findIncomingRequests.mockResolvedValue([{ _id: REQUEST_ID, requester: null }]);
        const res = makeRes();
        await GetFriendRequestsController({ headers: {} }, res);
        expect(res.json).toHaveBeenCalledWith({ requests: [] });
    });

    test('logged-out players are turned away', async () => {
        loggedOut();
        const res = makeRes();
        await GetFriendRequestsController({ headers: {} }, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a database error returns 500', async () => {
        loggedIn();
        mockDAO.findIncomingRequests.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await GetFriendRequestsController({ headers: {} }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Send a friend request (P11)', () => {
    const send = (player) => ({ headers: {}, body: { player } });

    test('sends a request by username', async () => {
        loggedIn();
        mockDAO.findAccountByPlayer.mockResolvedValue(JOSUE);
        mockDAO.findFriendshipBetween.mockResolvedValue(null);
        const res = makeRes();

        await SendFriendRequestController(send('  Josue '), res);

        expect(mockDAO.findAccountByPlayer).toHaveBeenCalledWith('Josue');
        expect(mockDAO.createFriendRequest).toHaveBeenCalledWith(ME._id, JOSUE._id);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ message: 'Friend request sent to Josue', to: toPlayer(JOSUE) });
    });

    test('if they already asked you, you just become friends', async () => {
        loggedIn();
        mockDAO.findAccountByPlayer.mockResolvedValue(JOSUE);
        mockDAO.findFriendshipBetween.mockResolvedValue({ _id: REQUEST_ID, requester: JOSUE._id, status: 'pending' });
        const res = makeRes();

        await SendFriendRequestController(send('Josue'), res);

        expect(mockDAO.acceptFriendRequest).toHaveBeenCalledWith(REQUEST_ID, ME._id);
        expect(mockDAO.createFriendRequest).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('a blank name is rejected', async () => {
        loggedIn();
        const res = makeRes();
        await SendFriendRequestController(send('   '), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockDAO.findAccountByPlayer).not.toHaveBeenCalled();
    });

    test('a missing body is rejected', async () => {
        loggedIn();
        const res = makeRes();
        await SendFriendRequestController({ headers: {} }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('a player who does not exist returns 404', async () => {
        loggedIn();
        mockDAO.findAccountByPlayer.mockResolvedValue(null);
        const res = makeRes();
        await SendFriendRequestController(send('Nobody'), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('you cannot add yourself', async () => {
        loggedIn();
        mockDAO.findAccountByPlayer.mockResolvedValue(ME);
        const res = makeRes();
        await SendFriendRequestController(send('PrestonA7'), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "You can't add yourself" });
    });

    test('you cannot add someone who is already your friend', async () => {
        loggedIn();
        mockDAO.findAccountByPlayer.mockResolvedValue(JOSUE);
        mockDAO.findFriendshipBetween.mockResolvedValue({ requester: ME._id, status: 'accepted' });
        const res = makeRes();
        await SendFriendRequestController(send('Josue'), res);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ error: "You're already friends with Josue" });
    });

    test('you cannot send the same request twice', async () => {
        loggedIn();
        mockDAO.findAccountByPlayer.mockResolvedValue(JOSUE);
        mockDAO.findFriendshipBetween.mockResolvedValue({ requester: ME._id, status: 'pending' });
        const res = makeRes();
        await SendFriendRequestController(send('Josue'), res);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(mockDAO.createFriendRequest).not.toHaveBeenCalled();
    });

    test('logged-out players are turned away', async () => {
        loggedOut();
        const res = makeRes();
        await SendFriendRequestController(send('Josue'), res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a database error returns 500', async () => {
        loggedIn();
        mockDAO.findAccountByPlayer.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await SendFriendRequestController(send('Josue'), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Accept and ignore requests (P11)', () => {
    const byId = (id) => ({ headers: {}, params: { id } });

    test('accepting makes you friends', async () => {
        loggedIn();
        mockDAO.acceptFriendRequest.mockResolvedValue({ status: 'accepted' });
        const res = makeRes();

        await AcceptFriendRequestController(byId(REQUEST_ID), res);

        expect(mockDAO.acceptFriendRequest).toHaveBeenCalledWith(REQUEST_ID, ME._id);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('accepting a request that is not yours (or is gone) returns 404', async () => {
        loggedIn();
        mockDAO.acceptFriendRequest.mockResolvedValue(null);
        const res = makeRes();
        await AcceptFriendRequestController(byId(REQUEST_ID), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('ignoring removes the request', async () => {
        loggedIn();
        mockDAO.deleteFriendRequest.mockResolvedValue({ _id: REQUEST_ID });
        const res = makeRes();

        await DeclineFriendRequestController(byId(REQUEST_ID), res);

        expect(mockDAO.deleteFriendRequest).toHaveBeenCalledWith(REQUEST_ID, ME._id);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('ignoring a request that is gone returns 404', async () => {
        loggedIn();
        mockDAO.deleteFriendRequest.mockResolvedValue(null);
        const res = makeRes();
        await DeclineFriendRequestController(byId(REQUEST_ID), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test.each([
        ['accept', AcceptFriendRequestController],
        ['ignore', DeclineFriendRequestController],
    ])('%s: a bad id is rejected', async (_, controller) => {
        loggedIn();
        const res = makeRes();
        await controller(byId('nope'), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test.each([
        ['accept', AcceptFriendRequestController],
        ['ignore', DeclineFriendRequestController],
    ])('%s: logged-out players are turned away', async (_, controller) => {
        loggedOut();
        const res = makeRes();
        await controller(byId(REQUEST_ID), res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test.each([
        ['accept', AcceptFriendRequestController, 'acceptFriendRequest'],
        ['ignore', DeclineFriendRequestController, 'deleteFriendRequest'],
    ])('%s: a database error returns 500', async (_, controller, daoName) => {
        loggedIn();
        mockDAO[daoName].mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await controller(byId(REQUEST_ID), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Remove a friend (P11)', () => {
    const byFriend = (friendId) => ({ headers: {}, params: { friendId } });

    test('removes the friendship', async () => {
        loggedIn();
        mockDAO.deleteFriendship.mockResolvedValue({ status: 'accepted' });
        const res = makeRes();

        await RemoveFriendController(byFriend(JOSUE._id), res);

        expect(mockDAO.deleteFriendship).toHaveBeenCalledWith(ME._id, JOSUE._id);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('removing someone who is not your friend returns 404', async () => {
        loggedIn();
        mockDAO.deleteFriendship.mockResolvedValue(null);
        const res = makeRes();
        await RemoveFriendController(byFriend(JOSUE._id), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('a bad id is rejected', async () => {
        loggedIn();
        const res = makeRes();
        await RemoveFriendController(byFriend('nope'), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('logged-out players are turned away', async () => {
        loggedOut();
        const res = makeRes();
        await RemoveFriendController(byFriend(JOSUE._id), res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a database error returns 500', async () => {
        loggedIn();
        mockDAO.deleteFriendship.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await RemoveFriendController(byFriend(JOSUE._id), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
