import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mute Others: the database functions behind muting players in chat.
// The model is faked, so these check what each function asks the database for.

const ChatMute = {
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
};

jest.unstable_mockModule('../src/models/ChatMuteModel.js', () => ({ default: ChatMute }));

const { findMutedIds, muteAccount, unmuteAccount } = await import('../src/dao/ChatMuteDAO.js');

const ME = 'account-me';
const THEM = 'account-them';

beforeEach(() => {
    jest.resetAllMocks();
});

describe('findMutedIds', () => {
    test('returns the ids of everyone you muted, as strings', async () => {
        ChatMute.find.mockResolvedValue([{ muted: { toString: () => 'id-1' } }, { muted: 'id-2' }]);
        await expect(findMutedIds(ME)).resolves.toEqual(['id-1', 'id-2']);
        expect(ChatMute.find).toHaveBeenCalledWith({ muter: ME }, 'muted');
    });

    test('returns an empty list when you muted no one', async () => {
        ChatMute.find.mockResolvedValue([]);
        await expect(findMutedIds(ME)).resolves.toEqual([]);
    });
});

describe('muteAccount', () => {
    test('saves the mute, and muting twice keeps just one', async () => {
        const saved = { muter: ME, muted: THEM };
        ChatMute.findOneAndUpdate.mockResolvedValue(saved);

        await expect(muteAccount(ME, THEM)).resolves.toBe(saved);
        expect(ChatMute.findOneAndUpdate).toHaveBeenCalledWith(
            { muter: ME, muted: THEM },
            { $setOnInsert: { muter: ME, muted: THEM } },
            { upsert: true, returnDocument: 'after' }
        );
    });
});

describe('unmuteAccount', () => {
    test('removes the mute and returns it', async () => {
        const removed = { muter: ME, muted: THEM };
        ChatMute.findOneAndDelete.mockResolvedValue(removed);

        await expect(unmuteAccount(ME, THEM)).resolves.toBe(removed);
        expect(ChatMute.findOneAndDelete).toHaveBeenCalledWith({ muter: ME, muted: THEM });
    });

    test('returns null when they were not muted', async () => {
        ChatMute.findOneAndDelete.mockResolvedValue(null);
        await expect(unmuteAccount(ME, THEM)).resolves.toBeNull();
    });
});
