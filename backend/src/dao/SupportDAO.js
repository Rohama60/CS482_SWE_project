import SupportMessage from '../models/SupportMessageModel.js';

// P18 Chat with Admin: the database functions for player and admin support messages.

export async function saveSupportMessage(data) {
    return await SupportMessage.create(data);
}

// The newest messages in one player's conversation, oldest first so they read top to bottom
export async function findConversation(playerId, limit = 100) {
    const newest = await SupportMessage.find({ playerId }).sort({ createdAt: -1 }).limit(limit);
    return newest.reverse();
}

// Every conversation for the admin inbox: the player, their last message, and how many the admins haven't read.
// Newest conversations first.
export async function findConversationsForAdmin() {
    return await SupportMessage.aggregate([
        { $sort: { createdAt: 1 } },
        {
            $group: {
                _id: '$playerId',
                lastMessage: { $last: '$message' },
                lastFrom: { $last: '$from' },
                lastAt: { $last: '$createdAt' },
                unread: { $sum: { $cond: [{ $and: [{ $eq: ['$from', 'player'] }, { $eq: ['$readByAdmin', false] }] }, 1, 0] } },
            },
        },
        { $sort: { lastAt: -1 } },
        { $lookup: { from: 'accounts', localField: '_id', foreignField: '_id', as: 'player' } },
        { $project: { lastMessage: 1, lastFrom: 1, lastAt: 1, unread: 1, player: { $arrayElemAt: ['$player', 0] } } },
    ]);
}

// An admin opened this conversation
export async function markReadByAdmin(playerId) {
    return await SupportMessage.updateMany({ playerId, from: 'player', readByAdmin: false }, { $set: { readByAdmin: true } });
}

// The player opened their chat
export async function markReadByPlayer(playerId) {
    return await SupportMessage.updateMany({ playerId, from: 'admin', readByPlayer: false }, { $set: { readByPlayer: true } });
}

// Admin replies this player hasn't seen yet, for the badge on their button
export async function countUnreadForPlayer(playerId) {
    return await SupportMessage.countDocuments({ playerId, from: 'admin', readByPlayer: false });
}
