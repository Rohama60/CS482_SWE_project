import { describe, test, expect } from '@jest/globals';
import Guest from '../src/models/GuestModel.js';

// G1 and G2: these only build guests in memory and call validateSync(), so no database is needed.

describe('Guest model: required fields and defaults', () => {
    test('a guest with a display name is valid', () => {
        expect(new Guest({ displayName: 'Guest-1234' }).validateSync()).toBeUndefined();
    });

    test('display name is required', () => {
        const error = new Guest({}).validateSync();
        expect(error.errors.displayName).toBeDefined();
    });

    test('a new guest starts with 500 chips and the guest role', () => {
        const guest = new Guest({ displayName: 'Guest-1234' });
        expect(guest.chipamount).toBe(500);
        expect(guest.role).toBe('guest');
    });

    test('createdAt is set automatically', () => {
        const before = Date.now();
        const guest = new Guest({ displayName: 'Guest-1234' });
        expect(guest.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    });
});

describe('Guest model: limits', () => {
    test('chips can be 0 but not negative', () => {
        expect(new Guest({ displayName: 'Guest-1234', chipamount: 0 }).validateSync()).toBeUndefined();

        const error = new Guest({ displayName: 'Guest-1234', chipamount: -5 }).validateSync();
        expect(error.errors.chipamount).toBeDefined();
    });

    test('guests are deleted by MongoDB 24 hours after they are made', () => {
        expect(Guest.schema.path('createdAt').options.expires).toBe(60 * 60 * 24);
    });
});

describe('Guest model: what gets sent to the browser', () => {
    test('toJSON uses id instead of _id and hides __v', () => {
        const json = new Guest({ displayName: 'Guest-1234' }).toJSON();

        expect(json.id).toBeDefined();
        expect(json._id).toBeUndefined();
        expect(json.__v).toBeUndefined();
        expect(json.displayName).toBe('Guest-1234');
        expect(json.chipamount).toBe(500);
    });
});
