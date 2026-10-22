import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// ---- Fakes so no database or real login is used
const mockGetSession = jest.fn();
const mockAccountFindOne = jest.fn();
const mockFindTableById = jest.fn();
const mockAddSpectator = jest.fn();
const mockRemoveSpectator = jest.fn();
const mockFindGuestById = jest.fn();

jest.unstable_mockModule('../src/Auth.js', () => ({
    auth: { api: { getSession: mockGetSession } }
}));
jest.unstable_mockModule('../src/models/AccountModel.js', () => ({
    default: { findOne: mockAccountFindOne }
}));
jest.unstable_mockModule('../src/dao/TableDAO.js', () => ({
    findTableById: mockFindTableById,
    addSpectator: mockAddSpectator,
    removeSpectator: mockRemoveSpectator,
    // used by JoinTableController, which spectating borrows getJoiningPlayer from
    findTableByInviteCode: jest.fn(),
    addSeatIfOpen: jest.fn(),
    updateTable: jest.fn()
}));
jest.unstable_mockModule('../src/dao/GuestDAO.js', () => ({
    findGuestById: mockFindGuestById
}));

const { SpectateTableController, StopSpectatingController } =
    await import('../src/controllers/SpectateController.js');

const TABLE_ID = '507f1f77bcf86cd799439011';
const GUEST_ID = '507f1f77bcf86cd799439022';
const GUEST_SEAT = { kind: 'guest', refId: GUEST_ID, displayName: 'Guest-1234' };

function makeTable(overrides = {}) {
    return {
        id: TABLE_ID,
        name: 'Velvet Room',
        players: 4,
        max: 4,
        status: 'full',
        isPrivate: false,
        inviteCode: null,
        seats: [{ kind: 'user', refId: 'host-account', displayName: 'Host' }],
        spectators: [],
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

function spectateReq(body = {}) {
    return { params: { id: TABLE_ID }, headers: {}, body: { guestId: GUEST_ID, ...body } };
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Spectate Table Controller (P3)', () => {
    test('a guest can watch a full table', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable());
        mockAddSpectator.mockResolvedValue(makeTable({ spectators: [GUEST_SEAT] }));
        const res = makeRes();

        await SpectateTableController(spectateReq(), res);

        expect(mockAddSpectator).toHaveBeenCalledWith(TABLE_ID, GUEST_SEAT);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Now watching',
            role: 'spectator',
            table: expect.objectContaining({ spectators: [GUEST_SEAT] })
        });
    });

    test('a logged-in user can watch', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'auth-1' } });
        mockAccountFindOne.mockResolvedValue({ _id: 'acct-1', username: 'preston' });
        mockFindTableById.mockResolvedValue(makeTable());
        mockAddSpectator.mockResolvedValue(makeTable());
        const res = makeRes();

        await SpectateTableController({ params: { id: TABLE_ID }, headers: {}, body: {} }, res);

        expect(mockAddSpectator).toHaveBeenCalledWith(TABLE_ID, expect.objectContaining({ kind: 'user', refId: 'acct-1' }));
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('watching twice does not list you twice', async () => {
        asGuest();
        const table = makeTable({ spectators: [GUEST_SEAT] });
        mockFindTableById.mockResolvedValue(table);
        const res = makeRes();

        await SpectateTableController(spectateReq(), res);

        expect(mockAddSpectator).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ message: 'Already watching', role: 'spectator', table });
    });

    test('someone already seated is told they are playing', async () => {
        asGuest();
        const table = makeTable({ seats: [GUEST_SEAT] });
        mockFindTableById.mockResolvedValue(table);
        const res = makeRes();

        await SpectateTableController(spectateReq(), res);

        expect(mockAddSpectator).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ message: 'Already seated', role: 'player', table });
    });

    test('a double click at the same moment still succeeds', async () => {
        asGuest();
        const after = makeTable({ spectators: [GUEST_SEAT] });
        mockFindTableById.mockResolvedValueOnce(makeTable()).mockResolvedValueOnce(after);
        mockAddSpectator.mockResolvedValue(null);
        const res = makeRes();

        await SpectateTableController(spectateReq(), res);

        expect(mockFindTableById).toHaveBeenCalledTimes(2);
        expect(res.json).toHaveBeenCalledWith({ message: 'Now watching', role: 'spectator', table: after });
    });

    test('a private table needs the code to watch', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable({ isPrivate: true, inviteCode: 'K7Q2MX' }));
        const res = makeRes();

        await SpectateTableController(spectateReq({ inviteCode: 'NOPE22' }), res);

        expect(mockAddSpectator).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('a private table with the right code can be watched', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable({ isPrivate: true, inviteCode: 'K7Q2MX' }));
        mockAddSpectator.mockResolvedValue(makeTable({ isPrivate: true }));
        const res = makeRes();

        await SpectateTableController(spectateReq({ inviteCode: 'k7q2mx' }), res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('a table with no spectators list yet still works', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(makeTable({ seats: undefined, spectators: undefined }));
        mockAddSpectator.mockResolvedValue(makeTable({ spectators: [GUEST_SEAT] }));
        const res = makeRes();

        await SpectateTableController(spectateReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('a bad table id is rejected', async () => {
        const res = makeRes();
        await SpectateTableController({ params: { id: 'nope' }, headers: {}, body: {} }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('someone not logged in and not a guest is rejected', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();
        await SpectateTableController({ params: { id: TABLE_ID }, headers: {}, body: {} }, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a table that does not exist returns 404', async () => {
        asGuest();
        mockFindTableById.mockResolvedValue(null);
        const res = makeRes();
        await SpectateTableController(spectateReq(), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('a database error returns 500', async () => {
        asGuest();
        mockFindTableById.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await SpectateTableController(spectateReq(), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Stop Spectating Controller (P3)', () => {
    test('removes the viewer from the spectators list', async () => {
        asGuest();
        mockRemoveSpectator.mockResolvedValue(makeTable({ spectators: [] }));
        const res = makeRes();

        await StopSpectatingController(spectateReq(), res);

        expect(mockRemoveSpectator).toHaveBeenCalledWith(TABLE_ID, GUEST_ID);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('a bad table id is rejected', async () => {
        const res = makeRes();
        await StopSpectatingController({ params: { id: 'nope' }, headers: {}, body: {} }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('someone not logged in and not a guest is rejected', async () => {
        mockGetSession.mockResolvedValue(null);
        const res = makeRes();
        await StopSpectatingController({ params: { id: TABLE_ID }, headers: {}, body: {} }, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('a table that does not exist returns 404', async () => {
        asGuest();
        mockRemoveSpectator.mockResolvedValue(null);
        const res = makeRes();
        await StopSpectatingController(spectateReq(), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('a database error returns 500', async () => {
        asGuest();
        mockRemoveSpectator.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        await StopSpectatingController(spectateReq(), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
