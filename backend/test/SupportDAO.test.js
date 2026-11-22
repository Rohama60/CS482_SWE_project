import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// P18 Chat with Admin: the database functions behind support messages.
// The model is faked, so these check what each function asks the database for.

const mockLimit = jest.fn();
const mockSort = jest.fn(() => ({ limit: mockLimit }));
const SupportMessage = {
    create: jest.fn(),
    find: jest.fn(() => ({ sort: mockSort })),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
    countDocuments: jest.fn(),
};

jest.unstable_mockModule('../src/models/SupportMessageModel.js', () => ({ default: SupportMessage, MAX_SUPPORT_LENGTH: 500 }));

const {
    saveSupportMessage,
    findConversation,
    findConversationsForAdmin,
    markReadByAdmin,
    markReadByPlayer,
    countUnreadForPlayer,
} = await import('../src/dao/SupportDAO.js');

const PLAYER = 'acct-player';

beforeEach(() => {
    jest.clearAllMocks();
});

test('saveSupportMessage saves the message', async () => {
    const data = { playerId: PLAYER, from: 'player', message: 'help' };
    SupportMessage.create.mockResolvedValue({ _id: 'm1', ...data });
    await expect(saveSupportMessage(data)).resolves.toEqual({ _id: 'm1', ...data });
    expect(SupportMessage.create).toHaveBeenCalledWith(data);
});

describe('findConversation', () => {
    test('gets the newest messages and returns them oldest first', async () => {
        mockLimit.mockResolvedValue([{ _id: 'm3' }, { _id: 'm2' }, { _id: 'm1' }]);
        await expect(findConversation(PLAYER, 3)).resolves.toEqual([{ _id: 'm1' }, { _id: 'm2' }, { _id: 'm3' }]);
        expect(SupportMessage.find).toHaveBeenCalledWith({ playerId: PLAYER });
        expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(mockLimit).toHaveBeenCalledWith(3);
    });

    test('gets up to 100 messages by default', async () => {
        mockLimit.mockResolvedValue([]);
        await findConversation(PLAYER);
        expect(mockLimit).toHaveBeenCalledWith(100);
    });
});

describe('findConversationsForAdmin', () => {
    test('groups messages by player with the last message and unread count, newest first', async () => {
        const rows = [{ _id: PLAYER, lastMessage: 'help', unread: 1 }];
        SupportMessage.aggregate.mockResolvedValue(rows);

        await expect(findConversationsForAdmin()).resolves.toBe(rows);

        const pipeline = SupportMessage.aggregate.mock.calls[0][0];
        expect(pipeline[0]).toEqual({ $sort: { createdAt: 1 } });
        const group = pipeline[1].$group;
        expect(group._id).toBe('$playerId');
        expect(group.lastMessage).toEqual({ $last: '$message' });
        expect(group.unread.$sum.$cond[0]).toEqual({ $and: [{ $eq: ['$from', 'player'] }, { $eq: ['$readByAdmin', false] }] });
        expect(pipeline[2]).toEqual({ $sort: { lastAt: -1 } });
        expect(pipeline[3].$lookup).toEqual({ from: 'accounts', localField: '_id', foreignField: '_id', as: 'player' });
    });
});

test('markReadByAdmin marks the player messages in that conversation as read', async () => {
    await markReadByAdmin(PLAYER);
    expect(SupportMessage.updateMany).toHaveBeenCalledWith(
        { playerId: PLAYER, from: 'player', readByAdmin: false },
        { $set: { readByAdmin: true } }
    );
});

test('markReadByPlayer marks the admin replies in that conversation as read', async () => {
    await markReadByPlayer(PLAYER);
    expect(SupportMessage.updateMany).toHaveBeenCalledWith(
        { playerId: PLAYER, from: 'admin', readByPlayer: false },
        { $set: { readByPlayer: true } }
    );
});

test('countUnreadForPlayer counts admin replies the player has not seen', async () => {
    SupportMessage.countDocuments.mockResolvedValue(2);
    await expect(countUnreadForPlayer(PLAYER)).resolves.toBe(2);
    expect(SupportMessage.countDocuments).toHaveBeenCalledWith({ playerId: PLAYER, from: 'admin', readByPlayer: false });
});
