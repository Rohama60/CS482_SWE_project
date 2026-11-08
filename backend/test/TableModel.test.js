import { describe, test, expect } from '@jest/globals';
import Table from '../src/models/TableModel.js';

// These only build documents in memory and call validateSync(), so no database is needed.

const validTable = (overrides = {}) => ({
    name: 'Midnight Draw',
    stakes: 'medium',
    blind: '$5/$10',
    max: 6,
    ...overrides
});

describe('Table model: required fields', () => {
    test('a complete table is valid', () => {
        expect(new Table(validTable()).validateSync()).toBeUndefined();
    });

    test('name, stakes, blind and max are all required', () => {
        const error = new Table({}).validateSync();

        expect(error.errors.name).toBeDefined();
        expect(error.errors.stakes).toBeDefined();
        expect(error.errors.blind).toBeDefined();
        expect(error.errors.max).toBeDefined();
    });
});

describe('Table model: limits', () => {
    test('name is trimmed', () => {
        expect(new Table(validTable({ name: '   Royal Room   ' })).name).toBe('Royal Room');
    });

    test('name can be 28 characters but not 29', () => {
        expect(new Table(validTable({ name: 'a'.repeat(28) })).validateSync()).toBeUndefined();

        const error = new Table(validTable({ name: 'a'.repeat(29) })).validateSync();
        expect(error.errors.name).toBeDefined();
    });

    test('stakes must be low, medium or high', () => {
        for (const stakes of ['low', 'medium', 'high']) {
            expect(new Table(validTable({ stakes })).validateSync()).toBeUndefined();
        }
        const error = new Table(validTable({ stakes: 'huge' })).validateSync();
        expect(error.errors.stakes).toBeDefined();
    });

    test('max players must be between 2 and 6', () => {
        expect(new Table(validTable({ max: 2 })).validateSync()).toBeUndefined();
        expect(new Table(validTable({ max: 6 })).validateSync()).toBeUndefined();
        expect(new Table(validTable({ max: 1 })).validateSync().errors.max).toBeDefined();
        expect(new Table(validTable({ max: 7 })).validateSync().errors.max).toBeDefined();
    });

    test('status must be waiting, active or full', () => {
        for (const status of ['waiting', 'active', 'full']) {
            expect(new Table(validTable({ status })).validateSync()).toBeUndefined();
        }
        expect(new Table(validTable({ status: 'closed' })).validateSync().errors.status).toBeDefined();
    });
});

describe('Table model: defaults', () => {
    test('a new table starts waiting with the host as the only player and no bots', () => {
        const table = new Table(validTable());

        expect(table.players).toBe(1);
        expect(table.bots).toBe(0);
        expect(table.status).toBe('waiting');
        expect(table.gameInProgress).toBe(false);
        expect(table.hands).toBe(0);
        expect(table.avgPot).toBe('-');
        expect(table.isPrivate).toBe(false);
        expect(table.host).toBeNull();
        expect(table.inviteCode).toBeNull();
        expect(table.seats).toHaveLength(0);
        expect(table.spectators).toHaveLength(0);
        expect(table.playerIds).toHaveLength(0);
        expect(table.guestIds).toHaveLength(0);
    });

    test('bots can be set when the table is created', () => {
        expect(new Table(validTable({ bots: 3 })).bots).toBe(3);
    });
});

describe('Table model: seats', () => {
    test('a seat needs a kind and a refId', () => {
        const error = new Table(validTable({ seats: [{}] })).validateSync();
        const keys = Object.keys(error.errors);

        expect(keys.some(k => k.includes('kind'))).toBe(true);
        expect(keys.some(k => k.includes('refId'))).toBe(true);
    });

    test('a seat kind must be user or guest (bots are not seats)', () => {
        const error = new Table(validTable({ seats: [{ kind: 'bot', refId: 'bot-1' }] })).validateSync();

        expect(Object.keys(error.errors).some(k => k.includes('kind'))).toBe(true);
    });

    test('a valid seat gets the default display name and no id of its own', () => {
        const table = new Table(validTable({ seats: [{ kind: 'guest', refId: 'g1' }] }));

        expect(table.validateSync()).toBeUndefined();
        expect(table.seats[0].displayName).toBe('Player');
        expect(table.seats[0]._id).toBeUndefined();
    });

    test('spectators use the same shape as seats', () => {
        const table = new Table(validTable({ spectators: [{ kind: 'user', refId: 'u1', displayName: 'Mara' }] }));

        expect(table.validateSync()).toBeUndefined();
        expect(table.spectators[0].displayName).toBe('Mara');
    });
});

describe('Table model: JSON output', () => {
    test('exposes id instead of _id and hides __v', () => {
        const table = new Table(validTable());

        const json = table.toJSON();

        expect(String(json.id)).toBe(String(table._id));
        expect(json._id).toBeUndefined();
        expect(json.__v).toBeUndefined();
        expect(json.name).toBe('Midnight Draw');
    });

    test('never includes the invite code', () => {
        const table = new Table(validTable({ isPrivate: true, inviteCode: 'ABC123' }));

        expect(table.inviteCode).toBe('ABC123');       // still stored on the document
        expect(table.toJSON().inviteCode).toBeUndefined();
    });
});