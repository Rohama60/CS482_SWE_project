import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// P13 Game History: the database function that reads your finished hands.
// The model is faked, so this checks what it asks the database for.

const mockLean = jest.fn();
const mockPopulate = jest.fn(() => ({ lean: mockLean }));
const mockLimit = jest.fn(() => ({ populate: mockPopulate }));
const mockSort = jest.fn(() => ({ limit: mockLimit }));
const BotGame = { find: jest.fn(() => ({ sort: mockSort })) };

jest.unstable_mockModule('../src/models/BotGameModel.js', () => ({ default: BotGame }));

const { findFinishedHandsFor, MAX_HANDS } = await import('../src/dao/GameHistoryDAO.js');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('findFinishedHandsFor', () => {
    test('asks for finished hands you were dealt into, newest first, with the table name', async () => {
        const hands = [{ _id: 'g1' }];
        mockLean.mockResolvedValue(hands);

        await expect(findFinishedHandsFor('account-me', 5)).resolves.toBe(hands);

        const [filter, fields] = BotGame.find.mock.calls[0];
        expect(filter).toEqual({ settled: true, 'engine.participants.refId': 'account-me' });
        expect(fields).toContain('engine.participants');
        expect(fields).toContain('engine.winners');
        expect(fields).toContain('startChips');
        expect(mockSort).toHaveBeenCalledWith({ updatedAt: -1 });
        expect(mockLimit).toHaveBeenCalledWith(5);
        expect(mockPopulate).toHaveBeenCalledWith('tableId', 'name');
    });

    test('ids are compared as text, like they are saved in the hand', async () => {
        mockLean.mockResolvedValue([]);
        await findFinishedHandsFor({ toString: () => 'account-me' });
        expect(BotGame.find.mock.calls[0][0]['engine.participants.refId']).toBe('account-me');
    });

    test('reads up to MAX_HANDS hands by default', async () => {
        mockLean.mockResolvedValue([]);
        await findFinishedHandsFor('account-me');
        expect(mockLimit).toHaveBeenCalledWith(MAX_HANDS);
    });
});
