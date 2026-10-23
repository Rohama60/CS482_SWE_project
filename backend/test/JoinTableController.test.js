import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// ---- Fakes for everything the controller talks to, so no database or real login is used
const mockGetSession = jest.fn();
const mockAccountFindOne = jest.fn();
const mockFindTableById = jest.fn();
const mockFindTableByInviteCode = jest.fn();
const mockAddSeatIfOpen = jest.fn();
const mockUpdateTable = jest.fn();
const mockFindGuestById = jest.fn();

jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { getSession: mockGetSession } }
}));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
    default: { findOne: mockAccountFindOne }
}));
jest.unstable_mockModule('../src/dao/TableDAO.js', () => ({
    findTableById: mockFindTableById,
    findTableByInviteCode: mockFindTableByInviteCode,
    addSeatIfOpen: mockAddSeatIfOpen,
    updateTable: mockUpdateTable
}));
jest.unstable_mockModule('../src/dao/GuestDAO.js', () => ({
    findGuestById: mockFindGuestById
}));

const { JoinTableController, JoinByCodeController, getJoiningPlayer } =
    await import('../src/controllers/JoinTableController.js');
const { generateInviteCode, normalizeInviteCode } = await import('../src/utils/inviteCode.js');

// ---- Test data
const TABLE_ID = '507f1f77bcf86cd799439011';
const GUEST_ID = '507f1f77bcf86cd799439022';
const ACCOUNT_ID = '507f1f77bcf86cd799439033';

function makeTable(overrides = {}) {
    return {
        id: TABLE_ID,
        name: 'Velvet Room',
        players: 1,
        max: 4,
        status: 'waiting',
        isPrivate: false,
        inviteCode: null,
        seats: [{ kind: 'user', refId: 'host-account', displayName: 'Host' }],
        ...overrides
    };
}

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function asGuest() {
    mockGetSession.mockResolvedValue(null);
    mockFindGuestById.mockResolvedValue({ id: GUEST_ID, displayName: 'Guest-1234' });
}

function asUser() {
    mockGetSession.mockResolvedValue({ user: { id: 'auth-user-1' } });
    mockAccountFindOne.mockResolvedValue({ _id: ACCOUNT_ID, username: 'preston', displayName: 'Preston' });
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Invite codes', () => {
    test('are 6 characters with no easy-to-confuse letters', () => {
        const code = generateInviteCode();
        expect(code).toMatch(/^[A-Z2-9]{6}$/);
        expect(code).not.toMatch(/[01OIL]/);
    });

    test('typed codes are cleaned up before comparing', () => {
        expect(normalizeInviteCode('  k7q2mx ')).toBe('K7Q2MX');
        expect(normalizeInviteCode(undefined)).toBe('');
    });
});

describe('Who is joining', () => {
    test('a logged-in user', async () => {
        asUser();
        const player = await getJoiningPlayer({ headers: {}, body: {} });
        expect(player).toEqual({ kind: 'user', refId: ACCOUNT_ID, displayName: 'Preston' });
    });

    test('a guest from G1', async () => {
        asGuest();
        const player = await getJoiningPlayer({ headers: {}, body: { guestId: GUEST_ID } });
        expect(player).toEqual({ kind: 'guest', refId: GUEST_ID, displayName: 'Guest-1234' });
    });

    test('nobody, when there is no session and no guest', async () => {
        mockGetSession.mockResolvedValue(null);
        expect(await getJoiningPlayer({ headers: {}, body: {} })).toBeNull();
    });

    test('nobody, when the guest expired', async () => {
        mockGetSession.mockResolvedValue(null);
        mockFindGuestById.mockResolvedValue(null);
        expect(await getJoiningPlayer({ headers: {}, body: { guestId: GUEST_ID } })).toBeNull();
    });

    test('nobody, when the session has no matching account', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'auth-user-1' } });
        mockAccountFindOne.mockResolvedValue(null);
        expect(await getJoiningPlayer({ headers: {}, body: {} })).toBeNull();
    });

    test('uses the username when there is no display name', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'auth-user-1' } });
        mockAccountFindOne.mockResolvedValue({ _id: ACCOUNT_ID, username: 'preston' });
        const player = await getJoiningPlayer({ headers: {}, body: {} });
        expect(player.displayName).toBe('preston');
    });
});

describe('Join Table Controller (P7)', () => {
    test('a guest joins a public table', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable());
        mockAddSeatIfOpen.mockResolvedValue(makeTable({ players: 2, status: 'waiting' }));
        mockUpdateTable.mockResolvedValue(makeTable({ players: 2, status: 'active' }));
        const res = makeRes();

        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID } }, res);

        expect(mockAddSeatIfOpen).toHaveBeenCalledWith(TABLE_ID, {
            kind: 'guest', refId: GUEST_ID, displayName: 'Guest-1234'
        });
        expect(mockUpdateTable).toHaveBeenCalledWith(TABLE_ID, { status: 'active' });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Joined table',
            table: expect.objectContaining({ players: 2, status: 'active' })
        });
    });

    test('a logged-in user joins a public table', async () => {
        asUser();
        mockFindTableById.mockResolvedValue(makeTable());
        mockAddSeatIfOpen.mockResolvedValue(makeTable({ players: 2, status: 'active' }));
        const res = makeRes();

        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: {} }, res);

        expect(mockAddSeatIfOpen).toHaveBeenCalledWith(TABLE_ID, expect.objectContaining({ kind: 'user', refId: ACCOUNT_ID }));
        expect(mockUpdateTable).not.toHaveBeenCalled(); // status was already right
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('taking the last seat marks the table full', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable({ players: 3, max: 4, status: 'active' }));
        mockAddSeatIfOpen.mockResolvedValue(makeTable({ players: 4, max: 4, status: 'active' }));
        mockUpdateTable.mockResolvedValue(makeTable({ players: 4, max: 4, status: 'full' }));
        const res = makeRes();

        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID } }, res);

        expect(mockUpdateTable).toHaveBeenCalledWith(TABLE_ID, { status: 'full' });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('a full table is rejected', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable({ players: 4, max: 4, status: 'full' }));
        const res = makeRes();

        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID } }, res);

        expect(mockAddSeatIfOpen).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(409);
    });

    test('losing the race for the last seat is rejected', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable({ players: 3, max: 4 }));
        mockAddSeatIfOpen.mockResolvedValue(null);
        const res = makeRes();

        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID } }, res);

        expect(res.status).toHaveBeenCalledWith(409);
    });

    test('joining twice does not take a second seat', async () => {
        asGuest();
        const table = makeTable({
            players: 2,
            seats: [
                { kind: 'user', refId: 'host-account', displayName: 'Host' },
                { kind: 'guest', refId: GUEST_ID, displayName: 'Guest-1234' }
            ]
        });
        mockFindTableById.mockResolvedValue(table);
        const res = makeRes();

        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID } }, res);

        expect(mockAddSeatIfOpen).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Already seated', table });
    });

    test('a private table needs the right code', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable({ isPrivate: true, inviteCode: 'K7Q2MX' }));
        const res = makeRes();

        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID, inviteCode: 'WRONG1' } }, res);

        expect(mockAddSeatIfOpen).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('a private table with the right code (any case) lets you in', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable({ isPrivate: true, inviteCode: 'K7Q2MX' }));
        mockAddSeatIfOpen.mockResolvedValue(makeTable({ players: 2, status: 'active', isPrivate: true }));
        const res = makeRes();

        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID, inviteCode: 'k7q2mx' } }, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('a bad table id is rejected', async () => {
        const res = makeRes();
        await JoinTableController({ params: { id: 'nope' }, headers: {}, body: {} }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('someone not logged in and not a guest is rejected', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();
        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: {} }, res);
        expect(mockFindTableById).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a table that does not exist returns 404', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(null);
        const res = makeRes();
        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID } }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('a database error returns 500', async () => {
        asGuest();
        mockFindTableById.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await JoinTableController({ params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID } }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Join By Code Controller (P7)', () => {
    test('a guest joins a private table with its code', async () => {
        asGuest();
        mockFindTableByInviteCode.mockResolvedValue(makeTable({ isPrivate: true, inviteCode: 'K7Q2MX' }));
        mockAddSeatIfOpen.mockResolvedValue(makeTable({ players: 2, status: 'active', isPrivate: true }));
        const res = makeRes();

        await JoinByCodeController({ headers: {}, body: { guestId: GUEST_ID, inviteCode: ' k7q2mx ' } }, res);

        expect(mockFindTableByInviteCode).toHaveBeenCalledWith('K7Q2MX');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('an empty code is rejected', async () => {
        const res = makeRes();
        await JoinByCodeController({ headers: {}, body: { inviteCode: '   ' } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('someone not logged in and not a guest is rejected', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();
        await JoinByCodeController({ headers: {}, body: { inviteCode: 'K7Q2MX' } }, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a code that matches no table returns 404', async () => {
        asGuest();
        mockFindTableByInviteCode.mockResolvedValue(null);
        const res = makeRes();
        await JoinByCodeController({ headers: {}, body: { guestId: GUEST_ID, inviteCode: 'ZZZZZZ' } }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('a database error returns 500', async () => {
        asGuest();
        mockFindTableByInviteCode.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await JoinByCodeController({ headers: {}, body: { guestId: GUEST_ID, inviteCode: 'K7Q2MX' } }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
