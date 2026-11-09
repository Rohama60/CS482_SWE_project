import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockLimit = jest.fn();
const mockSort = jest.fn(() => ({ limit: mockLimit }));
const ChatMessage = {
    create: jest.fn(),
    find: jest.fn(() => ({ sort: mockSort }))
};

jest.unstable_mockModule('../src/models/ChatMessageModel.js', () => ({ default: ChatMessage }));

const { saveChatMessage, findRecentMessages } = await import('../src/dao/ChatDAO.js');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('saveChatMessage (M3)', () => {
    test('creates the message with the supplied data', async () => {
        const data = { tableId: 'table-1', accountId: 'account-1', name: 'Preston', message: 'gl', filtered: false };
        const saved = { _id: 'msg-1', ...data };
        ChatMessage.create.mockResolvedValue(saved);

        const result = await saveChatMessage(data);

        expect(ChatMessage.create).toHaveBeenCalledWith(data);
        expect(result).toBe(saved);
    });
});

describe('findRecentMessages (M3)', () => {
    test('gets the newest 50 messages for the table and returns them oldest first', async () => {
        mockLimit.mockResolvedValue([{ id: 'm3' }, { id: 'm2' }, { id: 'm1' }]);

        const result = await findRecentMessages('table-1');

        expect(ChatMessage.find).toHaveBeenCalledWith({ tableId: 'table-1' });
        expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(mockLimit).toHaveBeenCalledWith(50);
        expect(result.map(m => m.id)).toEqual(['m1', 'm2', 'm3']);
    });

    test('a different limit can be passed in', async () => {
        mockLimit.mockResolvedValue([]);
        await findRecentMessages('table-1', 10);
        expect(mockLimit).toHaveBeenCalledWith(10);
    });

    test('a table with no messages returns an empty list', async () => {
        mockLimit.mockResolvedValue([]);
        expect(await findRecentMessages('table-1')).toEqual([]);
    });
});
