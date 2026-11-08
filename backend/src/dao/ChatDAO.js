import ChatMessage from '../models/ChatMessageModel.js';

export async function saveChatMessage(data) {
    return await ChatMessage.create(data);
}

// The newest messages at a table, returned oldest first so they read top to bottom
export async function findRecentMessages(tableId, limit = 50) {
    const newestFirst = await ChatMessage.find({ tableId }).sort({ createdAt: -1 }).limit(limit);
    return newestFirst.reverse();
}
