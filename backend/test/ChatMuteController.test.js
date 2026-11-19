import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mute Others: As a Member, I want to mute another player in chat,
// so that I don't see their messages.

const mockGetSession = jest.fn();
const mockAccountFindOne = jest.fn();
const mockAccountFindById = jest.fn();
const mockDAO = {
    findMutedIds: jest.fn(),
    muteAccount: jest.fn(),
    unmuteAccount: jest.fn(),
};

// Fake login and database so no real data is touched
jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { getSession: mockGetSession } }
}));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
    default: { findOne: mockAccountFindOne, findById: mockAccountFindById }
}));
jest.unstable_mockModule('../src/dao/ChatMuteDAO.js', () => mockDAO);

const {
    GetMutesController,
    MutePlayerController,
    UnmutePlayerController,
    MEMBERS_ONLY,
} = await import('../src/controllers/ChatMuteController.js');

const ME = { _id: '507f1f77bcf86cd799439001', username: 'PrestonA7', displayName: 'Preston' };
const JOSUE = { _id: '507f1f77bcf86cd799439002', username: 'Josue', displayName: 'Josue S' };
const AYANA = { _id: '507f1f77bcf86cd799439003', username: 'Ayana' };

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

describe('Loading your mutes', () => {
    test('returns the ids of the players you muted', async () => {
        loggedIn();
        mockDAO.findMutedIds.mockResolvedValue([JOSUE._id]);
        const res = makeRes();

        await GetMutesController({ headers: { cookie: 'session=abc' } }, res);

        expect(mockAccountFindOne).toHaveBeenCalledWith({ userId: 'auth-me' });
        expect(mockDAO.findMutedIds).toHaveBeenCalledWith(ME._id);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ muted: [JOSUE._id] });
    });

    test('guests are told to log in', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();

        await GetMutesController({}, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: MEMBERS_ONLY });
        expect(mockDAO.findMutedIds).not.toHaveBeenCalled();
    });

    test('a login with no player account is treated like a guest', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'auth-me' } });
        mockAccountFindOne.mockResolvedValue(null);
        const res = makeRes();

        await GetMutesController({ headers: {} }, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a database error returns 500', async () => {
        loggedIn();
        mockDAO.findMutedIds.mockRejectedValue(new Error('db down'));
        const res = makeRes();

        await GetMutesController({ headers: {} }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load muted players' });
    });
});

describe('Muting a player', () => {
    test('saves the mute and says who was muted', async () => {
        loggedIn();
        mockAccountFindById.mockResolvedValue(JOSUE);
        mockDAO.muteAccount.mockResolvedValue({});
        const res = makeRes();

        await MutePlayerController({ headers: {}, body: { playerId: JOSUE._id } }, res);

        expect(mockAccountFindById).toHaveBeenCalledWith(JOSUE._id);
        expect(mockDAO.muteAccount).toHaveBeenCalledWith(ME._id, JOSUE._id);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ message: 'Josue S is muted', playerId: JOSUE._id });
    });

    test('uses the username when the player has no display name', async () => {
        loggedIn();
        mockAccountFindById.mockResolvedValue(AYANA);
        const res = makeRes();

        await MutePlayerController({ headers: {}, body: { playerId: AYANA._id } }, res);

        expect(res.json).toHaveBeenCalledWith({ message: 'Ayana is muted', playerId: AYANA._id });
    });

    test('guests are told to log in', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();

        await MutePlayerController({ headers: {}, body: { playerId: JOSUE._id } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(mockDAO.muteAccount).not.toHaveBeenCalled();
    });

    test.each([
        ['missing', undefined],
        ['not a real id', 'nope'],
    ])('a %s player id is rejected', async (_, playerId) => {
        loggedIn();
        const res = makeRes();

        await MutePlayerController({ headers: {}, body: { playerId } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid player' });
        expect(mockDAO.muteAccount).not.toHaveBeenCalled();
    });

    test('a request with no body is rejected', async () => {
        loggedIn();
        const res = makeRes();

        await MutePlayerController({ headers: {} }, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("you can't mute yourself", async () => {
        loggedIn();
        const res = makeRes();

        await MutePlayerController({ headers: {}, body: { playerId: ME._id } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "You can't mute yourself" });
        expect(mockDAO.muteAccount).not.toHaveBeenCalled();
    });

    test('a player who does not exist returns 404', async () => {
        loggedIn();
        mockAccountFindById.mockResolvedValue(null);
        const res = makeRes();

        await MutePlayerController({ headers: {}, body: { playerId: JOSUE._id } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Player not found' });
        expect(mockDAO.muteAccount).not.toHaveBeenCalled();
    });

    test('a database error returns 500', async () => {
        loggedIn();
        mockAccountFindById.mockResolvedValue(JOSUE);
        mockDAO.muteAccount.mockRejectedValue(new Error('db down'));
        const res = makeRes();

        await MutePlayerController({ headers: {}, body: { playerId: JOSUE._id } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to mute player' });
    });
});

describe('Unmuting a player', () => {
    test('removes the mute', async () => {
        loggedIn();
        mockDAO.unmuteAccount.mockResolvedValue({ muter: ME._id, muted: JOSUE._id });
        const res = makeRes();

        await UnmutePlayerController({ headers: {}, params: { playerId: JOSUE._id } }, res);

        expect(mockDAO.unmuteAccount).toHaveBeenCalledWith(ME._id, JOSUE._id);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Player unmuted', playerId: JOSUE._id });
    });

    test('guests are told to log in', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();

        await UnmutePlayerController({ headers: {}, params: { playerId: JOSUE._id } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(mockDAO.unmuteAccount).not.toHaveBeenCalled();
    });

    test('a bad player id is rejected', async () => {
        loggedIn();
        const res = makeRes();

        await UnmutePlayerController({ headers: {}, params: { playerId: 'nope' } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockDAO.unmuteAccount).not.toHaveBeenCalled();
    });

    test('a player who was not muted returns 404', async () => {
        loggedIn();
        mockDAO.unmuteAccount.mockResolvedValue(null);
        const res = makeRes();

        await UnmutePlayerController({ headers: {}, params: { playerId: JOSUE._id } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'That player is not muted' });
    });

    test('a database error returns 500', async () => {
        loggedIn();
        mockDAO.unmuteAccount.mockRejectedValue(new Error('db down'));
        const res = makeRes();

        await UnmutePlayerController({ headers: {}, params: { playerId: JOSUE._id } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to unmute player' });
    });
});
