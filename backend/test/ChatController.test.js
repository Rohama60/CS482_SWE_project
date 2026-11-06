import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// M3: As a Member, I want to chat with my opponents,
// so that I can communicate with other members during the game.

const mockGetSession = jest.fn();
const mockAccountFindOne = jest.fn();
const mockFindTableById = jest.fn();
const mockSaveChatMessage = jest.fn();
const mockFindRecentMessages = jest.fn();

// Fake login and database so no real data is touched
jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { getSession: mockGetSession } }
}));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
    default: { findOne: mockAccountFindOne }
}));
jest.unstable_mockModule('../src/dao/TableDAO.js', () => ({
    findTableById: mockFindTableById
}));
jest.unstable_mockModule('../src/dao/ChatDAO.js', () => ({
    saveChatMessage: mockSaveChatMessage,
    findRecentMessages: mockFindRecentMessages
}));

const {
    GetChatController,
    handleChatSend,
    registerChatHandlers,
    broadcastOnline,
    countInRoom,
    toChatMessage,
    MEMBERS_ONLY,
    SEATED_ONLY,
} = await import('../src/controllers/ChatController.js');
const { filterMessage, MAX_MESSAGE_LENGTH } = await import('../src/utils/chatFilter.js');

const TABLE_ID = '507f1f77bcf86cd799439011';
const ACCOUNT = { _id: '507f1f77bcf86cd799439033', username: 'PrestonA7', displayName: 'Preston' };
const TABLE = { id: TABLE_ID, seats: [{ kind: 'user', refId: ACCOUNT._id }] };
const NOW = new Date('2026-11-06T15:00:00Z');

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

// A fake Socket.IO server and one player's socket
function makeSockets(roomSizes = {}) {
    const roomEmit = jest.fn();
    const io = {
        to: jest.fn(() => ({ emit: roomEmit })),
        sockets: { adapter: { rooms: new Map(Object.entries(roomSizes).map(([room, size]) => [room, { size }])) } },
    };
    const handlers = {};
    const socket = {
        emit: jest.fn(),
        on: jest.fn((event, fn) => { handlers[event] = fn; }),
        handshake: { headers: { cookie: 'session=abc' } },
        rooms: new Set(),
    };
    return { io, socket, roomEmit, handlers };
}

function memberAtTable() {
    mockGetSession.mockResolvedValue({ user: { id: 'auth-1' } });
    mockAccountFindOne.mockResolvedValue(ACCOUNT);
    mockFindTableById.mockResolvedValue(TABLE);
    mockSaveChatMessage.mockImplementation(async data => ({ _id: 'msg1', createdAt: NOW, ...data }));
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Bad word filter', () => {
    test('replaces bad words with ***', () => {
        expect(filterMessage('what the hell, damn it')).toEqual({ message: 'what the ***, *** it', filtered: true });
    });

    test('catches any capitalization', () => {
        expect(filterMessage('SHIT happens').message).toBe('*** happens');
    });

    test('leaves normal words alone, even ones that contain a bad word', () => {
        expect(filterMessage('hello class, nice pass')).toEqual({ message: 'hello class, nice pass', filtered: false });
    });
});

describe('Loading the chat (M3)', () => {
    test('returns the recent messages for the table', async () => {
        mockFindRecentMessages.mockResolvedValue([
            { _id: 'm1', name: 'Josue', message: 'gl', createdAt: NOW, accountId: 'x', filtered: false },
        ]);
        const res = makeRes();

        await GetChatController({ params: { id: TABLE_ID } }, res);

        expect(mockFindRecentMessages).toHaveBeenCalledWith(TABLE_ID);
        expect(res.status).toHaveBeenCalledWith(200);
        // Only what the browser needs, not the account id
        expect(res.json).toHaveBeenCalledWith({ messages: [{ id: 'm1', name: 'Josue', message: 'gl', createdAt: NOW }] });
    });

    test('a bad table id is rejected', async () => {
        const res = makeRes();
        await GetChatController({ params: { id: 'nope' } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('a database error returns 500', async () => {
        mockFindRecentMessages.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await GetChatController({ params: { id: TABLE_ID } }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Sending a message (M3)', () => {
    test('a seated member\'s message is saved and sent to everyone at the table', async () => {
        memberAtTable();
        const { io, socket, roomEmit } = makeSockets();

        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: '  good luck  ' } });

        expect(mockSaveChatMessage).toHaveBeenCalledWith({
            tableId: TABLE_ID, accountId: ACCOUNT._id, name: 'Preston', message: 'good luck', filtered: false,
        });
        expect(io.to).toHaveBeenCalledWith(`table-${TABLE_ID}`);
        expect(roomEmit).toHaveBeenCalledWith('chat:message', { id: 'msg1', name: 'Preston', message: 'good luck', createdAt: NOW });
        expect(socket.emit).not.toHaveBeenCalled();
    });

    test('uses the username if there is no display name', async () => {
        memberAtTable();
        mockAccountFindOne.mockResolvedValue({ ...ACCOUNT, displayName: undefined });
        const { io, socket } = makeSockets();

        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'hi' } });

        expect(mockSaveChatMessage.mock.calls[0][0].name).toBe('PrestonA7');
    });

    test('bad words are filtered before saving', async () => {
        memberAtTable();
        const { io, socket } = makeSockets();

        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'damn that river' } });

        expect(mockSaveChatMessage).toHaveBeenCalledWith(expect.objectContaining({ message: '*** that river', filtered: true }));
    });

    test('the login cookie on the socket is used to find who is sending', async () => {
        memberAtTable();
        const { io, socket } = makeSockets();

        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'hi' } });

        const { headers } = mockGetSession.mock.calls[0][0];
        expect(headers.get('cookie')).toBe('session=abc');
    });

    test('guests get the Members Only message', async () => {
        mockGetSession.mockResolvedValue(null);
        const { io, socket, roomEmit } = makeSockets();

        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'hi' } });

        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: MEMBERS_ONLY });
        expect(MEMBERS_ONLY).toBe('Members Only! Sign up to chat');
        expect(roomEmit).not.toHaveBeenCalled();
        expect(mockSaveChatMessage).not.toHaveBeenCalled();
    });

    test('a session with no account is treated like a guest', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'auth-1' } });
        mockAccountFindOne.mockResolvedValue(null);
        const { io, socket } = makeSockets();
        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'hi' } });
        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: MEMBERS_ONLY });
    });

    test('a socket with no handshake still works out as a guest', async () => {
        mockGetSession.mockResolvedValue(null);
        const { io, socket } = makeSockets();
        delete socket.handshake;
        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'hi' } });
        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: MEMBERS_ONLY });
    });

    test('a member watching without a seat cannot send', async () => {
        memberAtTable();
        mockFindTableById.mockResolvedValue({ ...TABLE, seats: [{ refId: 'someone-else' }] });
        const { io, socket } = makeSockets();

        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'hi' } });

        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: SEATED_ONLY });
        expect(mockSaveChatMessage).not.toHaveBeenCalled();
    });

    test('a table with no seats list means nobody is seated', async () => {
        memberAtTable();
        mockFindTableById.mockResolvedValue({ id: TABLE_ID });
        const { io, socket } = makeSockets();
        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'hi' } });
        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: SEATED_ONLY });
    });

    test('a table that does not exist', async () => {
        memberAtTable();
        mockFindTableById.mockResolvedValue(null);
        const { io, socket } = makeSockets();
        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'hi' } });
        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: 'Table not found' });
    });

    test('an empty message is rejected before checking anything else', async () => {
        const { io, socket } = makeSockets();
        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: '   ' } });
        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: 'Type a message first' });
        expect(mockGetSession).not.toHaveBeenCalled();
    });

    test('a message that is not text is treated as empty', async () => {
        const { io, socket } = makeSockets();
        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 42 } });
        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: 'Type a message first' });
    });

    test('a message over 200 characters is rejected', async () => {
        const { io, socket } = makeSockets();
        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'a'.repeat(MAX_MESSAGE_LENGTH + 1) } });
        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: 'Messages can be up to 200 characters' });
    });

    test('exactly 200 characters is allowed', async () => {
        memberAtTable();
        const { io, socket, roomEmit } = makeSockets();
        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'a'.repeat(MAX_MESSAGE_LENGTH) } });
        expect(roomEmit).toHaveBeenCalled();
    });

    test('a bad or missing table id is rejected', async () => {
        const { io, socket } = makeSockets();
        await handleChatSend({ io, socket, payload: { tableId: 'nope', message: 'hi' } });
        await handleChatSend({ io, socket, payload: undefined });
        expect(socket.emit).toHaveBeenNthCalledWith(1, 'chat:error', { error: 'Invalid table' });
        expect(socket.emit).toHaveBeenNthCalledWith(2, 'chat:error', { error: 'Invalid table' });
    });

    test('a database error tells the sender it failed', async () => {
        memberAtTable();
        mockSaveChatMessage.mockRejectedValue(new Error('DB down'));
        const { io, socket, roomEmit } = makeSockets();

        await handleChatSend({ io, socket, payload: { tableId: TABLE_ID, message: 'hi' } });

        expect(socket.emit).toHaveBeenCalledWith('chat:error', { error: 'Message could not be sent' });
        expect(roomEmit).not.toHaveBeenCalled();
    });
});

describe('Who is online at the table (M3)', () => {
    test('counts the sockets in the table room', () => {
        const { io } = makeSockets({ [`table-${TABLE_ID}`]: 3 });
        expect(countInRoom(io, TABLE_ID)).toBe(3);
    });

    test('an empty or missing room counts as 0', () => {
        expect(countInRoom(makeSockets().io, TABLE_ID)).toBe(0);
        expect(countInRoom({}, TABLE_ID)).toBe(0);
    });

    test('tells everyone at the table how many are there', () => {
        const { io, roomEmit } = makeSockets({ [`table-${TABLE_ID}`]: 2 });
        broadcastOnline(io, TABLE_ID);
        expect(io.to).toHaveBeenCalledWith(`table-${TABLE_ID}`);
        expect(roomEmit).toHaveBeenCalledWith('chat:online', { tableId: TABLE_ID, online: 2 });
    });

    test('never goes below 0', () => {
        const { io, roomEmit } = makeSockets();
        broadcastOnline(io, TABLE_ID, -1);
        expect(roomEmit).toHaveBeenCalledWith('chat:online', { tableId: TABLE_ID, online: 0 });
    });
});

describe('Hooking chat onto a connection (M3)', () => {
    test('chat:send runs the send handler', async () => {
        memberAtTable();
        const { io, socket, roomEmit, handlers } = makeSockets();
        registerChatHandlers(io, socket);

        await handlers['chat:send']({ tableId: TABLE_ID, message: 'hi' });

        expect(roomEmit).toHaveBeenCalledWith('chat:message', expect.objectContaining({ message: 'hi' }));
    });

    test('joining or leaving a table updates the online count', () => {
        const { io, socket, roomEmit, handlers } = makeSockets({ [`table-${TABLE_ID}`]: 1 });
        registerChatHandlers(io, socket);

        handlers['join-table-room'](TABLE_ID);
        handlers['leave-table-room'](TABLE_ID);

        expect(roomEmit).toHaveBeenCalledTimes(2);
        expect(roomEmit).toHaveBeenCalledWith('chat:online', { tableId: TABLE_ID, online: 1 });
    });

    test('closing the page counts you as gone from your tables only', () => {
        const { io, socket, roomEmit, handlers } = makeSockets({ [`table-${TABLE_ID}`]: 2 });
        socket.rooms = new Set(['socket-own-room', `table-${TABLE_ID}`]);
        registerChatHandlers(io, socket);

        handlers.disconnecting();

        expect(roomEmit).toHaveBeenCalledTimes(1);
        expect(roomEmit).toHaveBeenCalledWith('chat:online', { tableId: TABLE_ID, online: 1 });
    });

    test('a socket with no rooms list does nothing on close', () => {
        const { io, socket, roomEmit, handlers } = makeSockets();
        delete socket.rooms;
        registerChatHandlers(io, socket);
        handlers.disconnecting();
        expect(roomEmit).not.toHaveBeenCalled();
    });

    test('toChatMessage keeps only what the browser needs', () => {
        expect(toChatMessage({ _id: 'a', name: 'n', message: 'm', createdAt: NOW, accountId: 'secret' }))
            .toEqual({ id: 'a', name: 'n', message: 'm', createdAt: NOW });
    });
});
