import { describe, test, expect } from '@jest/globals';
import mongoose from 'mongoose';
import SupportMessage, { MAX_SUPPORT_LENGTH } from '../src/models/SupportMessageModel.js';

// P18 Chat with Admin: these only build messages in memory and call validateSync(), so no database is needed.

const player = new mongoose.Types.ObjectId();
const valid = (changes = {}) => new SupportMessage({ playerId: player, from: 'player', senderId: player, senderName: 'Preston', message: 'I lost my chips', ...changes });

describe('SupportMessage model', () => {
    test('a player message is valid', () => {
        expect(valid().validateSync()).toBeUndefined();
    });

    test('an admin reply is valid', () => {
        expect(valid({ from: 'admin', senderId: new mongoose.Types.ObjectId(), senderName: 'Ayana' }).validateSync()).toBeUndefined();
    });

    test('player, sender, name, message and who it is from are all required', () => {
        const error = new SupportMessage({}).validateSync();
        for (const field of ['playerId', 'from', 'senderId', 'senderName', 'message']) {
            expect(error.errors[field]).toBeDefined();
        }
    });

    test('it can only be from a player or an admin', () => {
        expect(valid({ from: 'bot' }).validateSync().errors.from).toBeDefined();
    });

    test(`messages can be up to ${MAX_SUPPORT_LENGTH} characters`, () => {
        expect(valid({ message: 'a'.repeat(MAX_SUPPORT_LENGTH) }).validateSync()).toBeUndefined();
        expect(valid({ message: 'a'.repeat(MAX_SUPPORT_LENGTH + 1) }).validateSync().errors.message).toBeDefined();
    });

    test('extra spaces are trimmed', () => {
        expect(valid({ message: '  help  ' }).message).toBe('help');
    });

    test('new messages start unread on both sides', () => {
        const message = valid();
        expect(message.readByAdmin).toBe(false);
        expect(message.readByPlayer).toBe(false);
    });

    test('conversations are looked up by player and time', () => {
        const index = SupportMessage.schema.indexes().find(([fields]) => fields.playerId === 1 && fields.createdAt === 1);
        expect(index).toBeDefined();
    });

    test('messages are saved with created and updated times', () => {
        expect(SupportMessage.schema.options.timestamps).toBe(true);
    });
});
