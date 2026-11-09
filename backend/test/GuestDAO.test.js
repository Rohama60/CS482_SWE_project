import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockSave = jest.fn();
const Guest = jest.fn(function (data) {
    this.data = data;
    this.save = mockSave;
});

Guest.findById = jest.fn();
Guest.findByIdAndDelete = jest.fn();

jest.unstable_mockModule('../src/models/GuestModel.js', () => ({ default: Guest }));

const {
    createGuest,
    findGuestById,
    deleteGuest
} = await import('../src/dao/GuestDAO.js');

beforeEach(() => {
    for (const fn of [mockSave, Guest, Guest.findById, Guest.findByIdAndDelete]) {
        fn.mockReset();
    }

    Guest.mockImplementation(function (data) {
        this.data = data;
        this.save = mockSave;
    });
});

describe('createGuest (G1)', () => {
    test('constructs and saves a guest with the supplied data', async () => {
        const guestData = { displayName: 'Guest-1234', chipamount: 500, role: 'guest' };
        const savedGuest = { _id: 'guest-1', ...guestData };
        mockSave.mockResolvedValue(savedGuest);

        const result = await createGuest(guestData);

        expect(Guest).toHaveBeenCalledWith(guestData);
        expect(mockSave).toHaveBeenCalledTimes(1);
        expect(result).toBe(savedGuest);
    });

    test('passes along a save error', async () => {
        mockSave.mockRejectedValue(new Error('DB down'));
        await expect(createGuest({ displayName: 'Guest-1234' })).rejects.toThrow('DB down');
    });
});

describe('findGuestById (G1)', () => {
    test('looks up the guest by id', async () => {
        const guest = { _id: 'guest-1', displayName: 'Guest-1234' };
        Guest.findById.mockResolvedValue(guest);

        const result = await findGuestById('guest-1');

        expect(Guest.findById).toHaveBeenCalledWith('guest-1');
        expect(result).toBe(guest);
    });

    test('returns null when the guest expired or never existed', async () => {
        Guest.findById.mockResolvedValue(null);
        expect(await findGuestById('missing')).toBeNull();
    });
});

describe('deleteGuest (G2)', () => {
    test('deletes the guest by id and returns what was deleted', async () => {
        const guest = { _id: 'guest-1', displayName: 'Guest-1234' };
        Guest.findByIdAndDelete.mockResolvedValue(guest);

        const result = await deleteGuest('guest-1');

        expect(Guest.findByIdAndDelete).toHaveBeenCalledWith('guest-1');
        expect(result).toBe(guest);
    });

    test('returns null when there was nothing to delete', async () => {
        Guest.findByIdAndDelete.mockResolvedValue(null);
        expect(await deleteGuest('missing')).toBeNull();
    });
});
