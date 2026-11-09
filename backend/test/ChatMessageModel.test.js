import { describe, test, expect } from '@jest/globals';
import mongoose from 'mongoose';
import ChatMessage from '../src/models/ChatMessageModel.js';

// M3: these only build messages in memory and call validateSync(), so no database is needed.

const validMessage = (overrides = {}) => ({
    tableId: new mongoose.Types.ObjectId(),
    accountId: new mongoose.Types.ObjectId(),
    name: 'Preston',
    message: 'good luck',
    ...overrides
});

describe('ChatMessage model: required fields and defaults', () => {
    test('a complete message is valid', () => {
        expect(new ChatMessage(validMessage()).validateSync()).toBeUndefined();
    });

    test('table, account, name and message are all required', () => {
        const error = new ChatMessage({}).validateSync();
        expect(error.errors.tableId).toBeDefined();
        expect(error.errors.accountId).toBeDefined();
        expect(error.errors.name).toBeDefined();
        expect(error.errors.message).toBeDefined();
    });

    test('messages are marked as not filtered unless bad words were replaced', () => {
        expect(new ChatMessage(validMessage()).filtered).toBe(false);
        expect(new ChatMessage(validMessage({ filtered: true })).filtered).toBe(true);
    });
});

describe('ChatMessage model: limits', () => {
    test('a message can be 200 characters but not 201', () => {
        expect(new ChatMessage(validMessage({ message: 'a'.repeat(200) })).validateSync()).toBeUndefined();

        const error = new ChatMessage(validMessage({ message: 'a'.repeat(201) })).validateSync();
        expect(error.errors.message).toBeDefined();
    });

    test('tableId is indexed so loading a table chat is fast', () => {
        expect(ChatMessage.schema.path('tableId').options.index).toBe(true);
    });

    test('keeps track of when the message was sent', () => {
        expect(ChatMessage.schema.path('createdAt')).toBeDefined();
    });
});
