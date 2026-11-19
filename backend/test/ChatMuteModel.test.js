import { describe, test, expect } from '@jest/globals';
import mongoose from 'mongoose';
import ChatMute from '../src/models/ChatMuteModel.js';

// Mute Others: these only build mutes in memory and call validateSync(), so no database is needed.

const idA = new mongoose.Types.ObjectId();
const idB = new mongoose.Types.ObjectId();

describe('ChatMute model', () => {
    test('a member muting another member is valid', () => {
        expect(new ChatMute({ muter: idA, muted: idB }).validateSync()).toBeUndefined();
    });

    test('muter and muted are both required', () => {
        const error = new ChatMute({}).validateSync();
        expect(error.errors.muter).toBeDefined();
        expect(error.errors.muted).toBeDefined();
    });

    test('ids that are not real ids are rejected', () => {
        const error = new ChatMute({ muter: 'nope', muted: idB }).validateSync();
        expect(error.errors.muter).toBeDefined();
    });

    test('the same person can only be muted once by the same member', () => {
        const unique = ChatMute.schema.indexes().find(([fields]) => fields.muter === 1 && fields.muted === 1);
        expect(unique).toBeDefined();
        expect(unique[1].unique).toBe(true);
    });

    test('looking up your mutes is fast (muter is indexed)', () => {
        expect(ChatMute.schema.path('muter').options.index).toBe(true);
    });

    test('mutes are saved with created and updated times', () => {
        expect(ChatMute.schema.options.timestamps).toBe(true);
    });
});
