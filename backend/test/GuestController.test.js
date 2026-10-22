import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockCreateGuest = jest.fn();
const mockFindGuestById = jest.fn();

// Replace the real DAO BEFORE importing the controller, so no database is touched
jest.unstable_mockModule('../src/dao/GuestDAO.js', () => ({
    createGuest: mockCreateGuest,
    findGuestById: mockFindGuestById
}));

const { CreateGuestController, GetGuestByIdController, makeGuestName, GUEST_STARTING_CHIPS } =
    await import('../src/controllers/GuestController.js');

function makeRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };
}

describe('Guest name', () => {
    test('looks like Guest-1234', () => {
        expect(makeGuestName()).toMatch(/^Guest-\d{4}$/);
    });
});

describe('Create Guest Controller (G1)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('creates a guest with 500 chips and the guest role', async () => {
        mockCreateGuest.mockImplementation(async (data) => ({ id: 'abc123', ...data }));
        const res = makeRes();

        await CreateGuestController({ body: {} }, res);

        expect(mockCreateGuest).toHaveBeenCalledTimes(1);
        const saved = mockCreateGuest.mock.calls[0][0];
        expect(saved.chipamount).toBe(GUEST_STARTING_CHIPS);
        expect(saved.role).toBe('guest');
        expect(saved.displayName).toMatch(/^Guest-\d{4}$/);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Guest created',
            guest: expect.objectContaining({ id: 'abc123', chipamount: 500, role: 'guest' })
        });
    });

    test('does not need a logged-in session', async () => {
        mockCreateGuest.mockResolvedValue({ id: 'abc123' });
        const res = makeRes();

        // No headers or cookies at all
        await CreateGuestController({ body: {}, headers: {} }, res);

        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('returns 500 if the database fails', async () => {
        mockCreateGuest.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        jest.spyOn(console, 'error').mockImplementation(() => {});

        await CreateGuestController({ body: {} }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create guest' });
    });
});

describe('Get Guest By Id Controller (G1)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns the guest when it exists', async () => {
        const guest = { id: '507f1f77bcf86cd799439011', displayName: 'Guest-1234', chipamount: 500 };
        mockFindGuestById.mockResolvedValue(guest);
        const res = makeRes();

        await GetGuestByIdController({ params: { id: guest.id } }, res);

        expect(mockFindGuestById).toHaveBeenCalledWith(guest.id);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ guest });
    });

    test('returns 400 for a badly formatted id', async () => {
        const res = makeRes();

        await GetGuestByIdController({ params: { id: 'not-an-id' } }, res);

        expect(mockFindGuestById).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 404 when the guest expired or never existed', async () => {
        mockFindGuestById.mockResolvedValue(null);
        const res = makeRes();

        await GetGuestByIdController({ params: { id: '507f1f77bcf86cd799439011' } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 500 if the database fails', async () => {
        mockFindGuestById.mockRejectedValue(new Error('DB down'));
        const res = makeRes();
        jest.spyOn(console, 'error').mockImplementation(() => {});

        await GetGuestByIdController({ params: { id: '507f1f77bcf86cd799439011' } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
