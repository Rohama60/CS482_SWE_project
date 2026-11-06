import { describe, test, expect } from '@jest/globals';
import mongoose from 'mongoose';
import BotGame from '../src/models/BotGameModel.js';

// These only build documents in memory and call validateSync(), so no database is needed.

const validTableId = () => new mongoose.Types.ObjectId();

describe('BotGame model: setup', () => {
    test('is registered as BotGame in its own collection', () => {
        expect(BotGame.modelName).toBe('BotGame');
        expect(BotGame.collection.name).toBe('botgames');
    });

    test('tableId points at the Table model', () => {
        expect(BotGame.schema.path('tableId').options.ref).toBe('Table');
    });

    test('has createdAt and updatedAt timestamps', () => {
        expect(BotGame.schema.path('createdAt')).toBeDefined();
        expect(BotGame.schema.path('updatedAt')).toBeDefined();
    });
});

describe('BotGame model: validation', () => {
    test('a game needs a tableId', () => {
        const error = new BotGame({}).validateSync();

        expect(error.errors.tableId).toBeDefined();
    });

    test('tableId must be a valid id', () => {
        const error = new BotGame({ tableId: 'not-an-id' }).validateSync();

        expect(error.errors.tableId).toBeDefined();
    });

    test('a game with a valid tableId is valid', () => {
        const error = new BotGame({ tableId: validTableId() }).validateSync();

        expect(error).toBeUndefined();
    });

    test('handNumber and settled must be the right types', () => {
        const error = new BotGame({ tableId: validTableId(), handNumber: 'many', settled: 'maybe' }).validateSync();

        expect(error.errors.handNumber).toBeDefined();
        expect(error.errors.settled).toBeDefined();
    });
});

describe('BotGame model: defaults', () => {
    test('a new game starts unsettled with no engine state', () => {
        const game = new BotGame({ tableId: validTableId() });

        expect(game.engine).toBeNull();
        expect(game.settled).toBe(false);
        expect(game.handNumber).toBe(0);
        expect(game.startChips).toEqual({});
    });
});

describe('BotGame model: flexible fields', () => {
    test('engine can hold the whole hand as a plain object', () => {
        const engine = { round: 'betting1', hands: { h1: [{ rank: 'A', suit: 'spades' }] }, deck: [] };

        const game = new BotGame({ tableId: validTableId(), engine });

        expect(game.toObject().engine).toEqual(engine);
    });

    test('startChips keeps one entry per human player', () => {
        const game = new BotGame({ tableId: validTableId(), startChips: { h1: 1000, h2: 500 } });

        expect(game.toObject().startChips).toEqual({ h1: 1000, h2: 500 });
    });

    test('extra fields are kept (strict is off), for example the copied round and pot', () => {
        const game = new BotGame({ tableId: validTableId(), round: 'drawing', potSize: 15, resultText: 'x' });

        const plain = game.toObject();
        expect(plain.round).toBe('drawing');
        expect(plain.potSize).toBe(15);
        expect(plain.resultText).toBe('x');
    });
});