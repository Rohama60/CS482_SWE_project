import { describe, test, expect } from '@jest/globals';
import mongoose from 'mongoose';
import Friendship from '../src/models/FriendshipModel.js';

// P11: these only build friendships in memory and call validateSync(), so no database is needed.

const idA = new mongoose.Types.ObjectId();
const idB = new mongoose.Types.ObjectId();

describe('Friendship model: required fields and defaults', () => {
    test('a request between two players is valid', () => {
        expect(new Friendship({ requester: idA, recipient: idB }).validateSync()).toBeUndefined();
    });

    test('requester and recipient are both required', () => {
        const error = new Friendship({}).validateSync();
        expect(error.errors.requester).toBeDefined();
        expect(error.errors.recipient).toBeDefined();
    });

    test('a new friendship starts as a pending request', () => {
        expect(new Friendship({ requester: idA, recipient: idB }).status).toBe('pending');
    });
});

describe('Friendship model: limits', () => {
    test('status can only be pending or accepted', () => {
        for (const status of ['pending', 'accepted']) {
            expect(new Friendship({ requester: idA, recipient: idB, status }).validateSync()).toBeUndefined();
        }
        const error = new Friendship({ requester: idA, recipient: idB, status: 'blocked' }).validateSync();
        expect(error.errors.status).toBeDefined();
    });

    test('requester and recipient must be real ids', () => {
        const error = new Friendship({ requester: 'not-an-id', recipient: idB }).validateSync();
        expect(error.errors.requester).toBeDefined();
    });

    test('the same two players can only have one request going each way', () => {
        const unique = Friendship.schema.indexes().find(([fields]) => fields.requester === 1 && fields.recipient === 1);
        expect(unique).toBeDefined();
        expect(unique[1].unique).toBe(true);
    });

    test('keeps track of when the request was made', () => {
        expect(Friendship.schema.path('createdAt')).toBeDefined();
        expect(Friendship.schema.path('updatedAt')).toBeDefined();
    });
});
