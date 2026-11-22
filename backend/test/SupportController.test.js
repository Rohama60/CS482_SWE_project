import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// P18: As a Player, I want to chat with an admin, so that I can get help with a problem.

const mockGetSession = jest.fn();
const mockAccountFindOne = jest.fn();
const mockAccountFindById = jest.fn();
const mockDAO = {
    saveSupportMessage: jest.fn(),
    findConversation: jest.fn(),
    findConversationsForAdmin: jest.fn(),
    markReadByAdmin: jest.fn(),
    markReadByPlayer: jest.fn(),
    countUnreadForPlayer: jest.fn(),
};

// Fake login and database so no real data is touched
jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { getSession: mockGetSession } }
}));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
    default: { findOne: mockAccountFindOne, findById: mockAccountFindById }
}));
jest.unstable_mockModule('../src/dao/SupportDAO.js', () => mockDAO);

const {
    GetMySupportController,
    GetMyUnreadController,
    SendSupportMessageController,
    GetSupportInboxController,
    GetSupportConversationController,
    ReplySupportController,
    handleSupportJoin,
    registerSupportHandlers,
    toSupportMessage,
    checkMessage,
    MEMBERS_ONLY,
    ADMIN_ROOM,
    playerRoom,
} = await import('../src/controllers/SupportController.js');

const PLAYER = { _id: '507f1f77bcf86cd799439001', username: 'PrestonA7', displayName: 'Preston', role: 'player' };
const NO_DISPLAY = { _id: '507f1f77bcf86cd799439003', username: 'Josue', role: 'player' };
const ADMIN = { _id: '507f1f77bcf86cd799439002', username: 'Ayana', displayName: 'Ayana T', role: 'admin' };
const NOW = new Date('2026-11-19T20:00:00Z');

function savedDoc(data) {
    return { _id: 'msg1', createdAt: NOW, ...data };
}

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

// A fake Express app with a fake Socket.IO, so we can see what gets sent live
function makeReq({ body, params, withIo = true } = {}) {
    const emit = jest.fn();
    const to = jest.fn(() => ({ to, emit }));
    const io = { to };
    return { req: { headers: { cookie: 'session=abc' }, body, params, app: { get: name => (withIo && name === 'io' ? io : undefined) } }, to, emit };
}

function loggedInAs(account) {
    mockGetSession.mockResolvedValue({ user: { id: 'auth-id' } });
    mockAccountFindOne.mockResolvedValue(account);
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('helpers', () => {
    test('toSupportMessage keeps only what the browser needs', () => {
        expect(toSupportMessage(savedDoc({ playerId: PLAYER._id, from: 'player', senderId: PLAYER._id, senderName: 'Preston', message: 'help', readByAdmin: false })))
            .toEqual({ id: 'msg1', playerId: PLAYER._id, from: 'player', senderName: 'Preston', message: 'help', createdAt: NOW });
    });

    test('checkMessage trims and accepts a normal message', () => {
        expect(checkMessage({ message: '  I lost my chips  ' })).toEqual({ message: 'I lost my chips' });
    });

    test.each([
        ['empty', { message: '   ' }, 'Type a message first'],
        ['missing', {}, 'Type a message first'],
        ['not text', { message: 42 }, 'Type a message first'],
        ['no body', undefined, 'Type a message first'],
        ['too long', { message: 'a'.repeat(501) }, 'Messages can be up to 500 characters'],
    ])('checkMessage rejects a %s message', (_, body, error) => {
        expect(checkMessage(body)).toEqual({ error });
    });

    test('each player has their own room', () => {
        expect(playerRoom('abc')).toBe('support-abc');
    });
});

describe('Player: loading your chat', () => {
    test('returns your conversation and marks admin replies as read', async () => {
        loggedInAs(PLAYER);
        mockDAO.findConversation.mockResolvedValue([savedDoc({ playerId: PLAYER._id, from: 'admin', senderName: 'Ayana T', message: 'How can I help?' })]);
        const res = makeRes();

        await GetMySupportController({ headers: {} }, res);

        expect(mockDAO.findConversation).toHaveBeenCalledWith(PLAYER._id);
        expect(mockDAO.markReadByPlayer).toHaveBeenCalledWith(PLAYER._id);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            playerId: PLAYER._id,
            messages: [{ id: 'msg1', playerId: PLAYER._id, from: 'admin', senderName: 'Ayana T', message: 'How can I help?', createdAt: NOW }],
        });
    });

    test('guests are told to log in', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();
        await GetMySupportController({}, res);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: MEMBERS_ONLY });
    });

    test('a login with no player account is treated like a guest', async () => {
        loggedInAs(null);
        const res = makeRes();
        await GetMySupportController({ headers: {} }, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a database error returns 500', async () => {
        loggedInAs(PLAYER);
        mockDAO.findConversation.mockRejectedValue(new Error('db down'));
        const res = makeRes();
        await GetMySupportController({ headers: {} }, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load your messages' });
    });
});

describe('Player: unread replies', () => {
    test('returns how many admin replies you have not seen', async () => {
        loggedInAs(PLAYER);
        mockDAO.countUnreadForPlayer.mockResolvedValue(2);
        const res = makeRes();
        await GetMyUnreadController({ headers: {} }, res);
        expect(mockDAO.countUnreadForPlayer).toHaveBeenCalledWith(PLAYER._id);
        expect(res.json).toHaveBeenCalledWith({ unread: 2 });
    });

    test('guests are told to log in', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();
        await GetMyUnreadController({ headers: {} }, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a database error returns 500', async () => {
        loggedInAs(PLAYER);
        mockDAO.countUnreadForPlayer.mockRejectedValue(new Error('db down'));
        const res = makeRes();
        await GetMyUnreadController({ headers: {} }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Player: sending a message', () => {
    test('saves it and sends it live to you and the admins', async () => {
        loggedInAs(PLAYER);
        mockDAO.saveSupportMessage.mockImplementation(async data => savedDoc(data));
        const { req, to, emit } = makeReq({ body: { message: '  I lost my chips  ' } });
        const res = makeRes();

        await SendSupportMessageController(req, res);

        expect(mockDAO.saveSupportMessage).toHaveBeenCalledWith({
            playerId: PLAYER._id, from: 'player', senderId: PLAYER._id, senderName: 'Preston', message: 'I lost my chips',
        });
        const sent = { id: 'msg1', playerId: PLAYER._id, from: 'player', senderName: 'Preston', message: 'I lost my chips', createdAt: NOW };
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ message: sent });
        expect(to).toHaveBeenCalledWith(`support-${PLAYER._id}`);
        expect(to).toHaveBeenCalledWith(ADMIN_ROOM);
        expect(emit).toHaveBeenCalledWith('support:message', sent);
    });

    test('uses the username when there is no display name', async () => {
        loggedInAs(NO_DISPLAY);
        mockDAO.saveSupportMessage.mockImplementation(async data => savedDoc(data));
        const { req } = makeReq({ body: { message: 'hi' } });
        await SendSupportMessageController(req, makeRes());
        expect(mockDAO.saveSupportMessage.mock.calls[0][0].senderName).toBe('Josue');
    });

    test('uses "Player" when there is no name at all', async () => {
        loggedInAs({ _id: PLAYER._id });
        mockDAO.saveSupportMessage.mockImplementation(async data => savedDoc(data));
        const { req } = makeReq({ body: { message: 'hi' } });
        await SendSupportMessageController(req, makeRes());
        expect(mockDAO.saveSupportMessage.mock.calls[0][0].senderName).toBe('Player');
    });

    test('still saves when live updates are not set up', async () => {
        loggedInAs(PLAYER);
        mockDAO.saveSupportMessage.mockImplementation(async data => savedDoc(data));
        const { req } = makeReq({ body: { message: 'hi' }, withIo: false });
        const res = makeRes();
        await SendSupportMessageController(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('an empty message is rejected', async () => {
        loggedInAs(PLAYER);
        const { req } = makeReq({ body: { message: ' ' } });
        const res = makeRes();
        await SendSupportMessageController(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Type a message first' });
        expect(mockDAO.saveSupportMessage).not.toHaveBeenCalled();
    });

    test('guests are told to log in', async () => {
        mockGetSession.mockResolvedValue(null);
        const { req } = makeReq({ body: { message: 'hi' } });
        const res = makeRes();
        await SendSupportMessageController(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(mockDAO.saveSupportMessage).not.toHaveBeenCalled();
    });

    test('a database error returns 500', async () => {
        loggedInAs(PLAYER);
        mockDAO.saveSupportMessage.mockRejectedValue(new Error('db down'));
        const { req } = makeReq({ body: { message: 'hi' } });
        const res = makeRes();
        await SendSupportMessageController(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Message could not be sent' });
    });
});

describe('Admin: the inbox', () => {
    test('lists every conversation with the player name, last message and unread count', async () => {
        mockDAO.findConversationsForAdmin.mockResolvedValue([
            { _id: PLAYER._id, lastMessage: 'I lost my chips', lastFrom: 'player', lastAt: NOW, unread: 2, player: PLAYER },
            { _id: NO_DISPLAY._id, lastMessage: 'Fixed!', lastFrom: 'admin', lastAt: NOW, unread: 0, player: NO_DISPLAY },
            { _id: 'gone', lastMessage: 'hello?', lastFrom: 'player', lastAt: NOW, unread: 1 },
        ]);
        const res = makeRes();

        await GetSupportInboxController({ adminAccount: ADMIN }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            conversations: [
                { playerId: PLAYER._id, playerName: 'Preston', lastMessage: 'I lost my chips', lastFrom: 'player', lastAt: NOW, unread: 2 },
                { playerId: NO_DISPLAY._id, playerName: 'Josue', lastMessage: 'Fixed!', lastFrom: 'admin', lastAt: NOW, unread: 0 },
                { playerId: 'gone', playerName: 'Deleted player', lastMessage: 'hello?', lastFrom: 'player', lastAt: NOW, unread: 1 },
            ],
        });
    });

    test('a database error returns 500', async () => {
        mockDAO.findConversationsForAdmin.mockRejectedValue(new Error('db down'));
        const res = makeRes();
        await GetSupportInboxController({ adminAccount: ADMIN }, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load support inbox' });
    });
});

describe('Admin: opening a conversation', () => {
    test('returns the player and their messages, and marks them as read', async () => {
        mockAccountFindById.mockResolvedValue(PLAYER);
        mockDAO.findConversation.mockResolvedValue([savedDoc({ playerId: PLAYER._id, from: 'player', senderName: 'Preston', message: 'help' })]);
        const res = makeRes();

        await GetSupportConversationController({ params: { playerId: PLAYER._id }, adminAccount: ADMIN }, res);

        expect(mockDAO.markReadByAdmin).toHaveBeenCalledWith(PLAYER._id);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            player: { id: PLAYER._id, name: 'Preston' },
            messages: [{ id: 'msg1', playerId: PLAYER._id, from: 'player', senderName: 'Preston', message: 'help', createdAt: NOW }],
        });
    });

    test('a deleted player still shows their messages', async () => {
        mockAccountFindById.mockResolvedValue(null);
        mockDAO.findConversation.mockResolvedValue([]);
        const res = makeRes();
        await GetSupportConversationController({ params: { playerId: PLAYER._id }, adminAccount: ADMIN }, res);
        expect(res.json).toHaveBeenCalledWith({ player: { id: PLAYER._id, name: 'Deleted player' }, messages: [] });
    });

    test('a bad player id is rejected', async () => {
        const res = makeRes();
        await GetSupportConversationController({ params: { playerId: 'nope' }, adminAccount: ADMIN }, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockDAO.findConversation).not.toHaveBeenCalled();
    });

    test('a database error returns 500', async () => {
        mockAccountFindById.mockRejectedValue(new Error('db down'));
        const res = makeRes();
        await GetSupportConversationController({ params: { playerId: PLAYER._id }, adminAccount: ADMIN }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Admin: replying', () => {
    test('saves the reply from the admin, marks the conversation read and sends it live', async () => {
        mockAccountFindById.mockResolvedValue(PLAYER);
        mockDAO.saveSupportMessage.mockImplementation(async data => savedDoc(data));
        const { req, to, emit } = makeReq({ body: { message: 'Your chips are back' }, params: { playerId: PLAYER._id } });
        req.adminAccount = ADMIN;
        const res = makeRes();

        await ReplySupportController(req, res);

        expect(mockDAO.saveSupportMessage).toHaveBeenCalledWith({
            playerId: PLAYER._id, from: 'admin', senderId: ADMIN._id, senderName: 'Ayana T', message: 'Your chips are back',
        });
        expect(mockDAO.markReadByAdmin).toHaveBeenCalledWith(PLAYER._id);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(to).toHaveBeenCalledWith(`support-${PLAYER._id}`);
        expect(to).toHaveBeenCalledWith(ADMIN_ROOM);
        expect(emit).toHaveBeenCalledWith('support:message', expect.objectContaining({ from: 'admin', message: 'Your chips are back' }));
    });

    test('a bad player id is rejected', async () => {
        const { req } = makeReq({ body: { message: 'hi' }, params: { playerId: 'nope' } });
        const res = makeRes();
        await ReplySupportController(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid player' });
    });

    test('an empty reply is rejected', async () => {
        const { req } = makeReq({ body: { message: '' }, params: { playerId: PLAYER._id } });
        const res = makeRes();
        await ReplySupportController(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Type a message first' });
        expect(mockDAO.saveSupportMessage).not.toHaveBeenCalled();
    });

    test('a player who does not exist returns 404', async () => {
        mockAccountFindById.mockResolvedValue(null);
        const { req } = makeReq({ body: { message: 'hi' }, params: { playerId: PLAYER._id } });
        const res = makeRes();
        await ReplySupportController(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Player not found' });
    });

    test('a database error returns 500', async () => {
        mockAccountFindById.mockResolvedValue(PLAYER);
        mockDAO.saveSupportMessage.mockRejectedValue(new Error('db down'));
        const { req } = makeReq({ body: { message: 'hi' }, params: { playerId: PLAYER._id } });
        req.adminAccount = ADMIN;
        const res = makeRes();
        await ReplySupportController(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Reply could not be sent' });
    });
});

describe('Live updates (support:join)', () => {
    function makeSocket(headers = { cookie: 'session=abc' }) {
        return { handshake: { headers }, join: jest.fn(), on: jest.fn() };
    }

    test('a player joins their own room', async () => {
        loggedInAs(PLAYER);
        const socket = makeSocket();
        const callback = jest.fn();

        await handleSupportJoin(socket, callback);

        expect(socket.join).toHaveBeenCalledWith(`support-${PLAYER._id}`);
        expect(socket.join).not.toHaveBeenCalledWith(ADMIN_ROOM);
        expect(callback).toHaveBeenCalledWith({ ok: true, admin: false });
    });

    test('an admin also joins the admins room', async () => {
        loggedInAs(ADMIN);
        const socket = makeSocket();
        const callback = jest.fn();

        await handleSupportJoin(socket, callback);

        expect(socket.join).toHaveBeenCalledWith(ADMIN_ROOM);
        expect(callback).toHaveBeenCalledWith({ ok: true, admin: true });
    });

    test('guests cannot join', async () => {
        mockGetSession.mockResolvedValue(null);
        const socket = makeSocket(undefined);
        socket.handshake = undefined;
        const callback = jest.fn();

        await handleSupportJoin(socket, callback);

        expect(socket.join).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalledWith({ ok: false, error: MEMBERS_ONLY });
    });

    test('works without a callback', async () => {
        loggedInAs(PLAYER);
        await expect(handleSupportJoin(makeSocket())).resolves.toBeUndefined();
        mockGetSession.mockResolvedValue(null);
        await expect(handleSupportJoin(makeSocket())).resolves.toBeUndefined();
    });

    test('a login error is reported back', async () => {
        mockGetSession.mockRejectedValue(new Error('auth down'));
        const callback = jest.fn();
        await handleSupportJoin(makeSocket(), callback);
        expect(callback).toHaveBeenCalledWith({ ok: false, error: 'Could not connect to support chat' });
    });

    test('registerSupportHandlers listens for support:join', async () => {
        loggedInAs(PLAYER);
        const socket = makeSocket();
        registerSupportHandlers({}, socket);
        expect(socket.on).toHaveBeenCalledWith('support:join', expect.any(Function));

        const callback = jest.fn();
        await socket.on.mock.calls[0][1](callback);
        expect(callback).toHaveBeenCalledWith({ ok: true, admin: false });
    });
});
