import Friendship from '../models/FriendshipModel.js';
import Account from '../models/AccountModel.js';
import Table from '../models/TableModel.js';

const PUBLIC_FIELDS = 'username displayName chipamount';

// Escapes characters like . or * so a username is matched exactly, not as a pattern
function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Finds a player by username (any capitalization) or by email
export async function findAccountByPlayer(player) {
    const value = player.trim();
    if (value.includes('@')) {
        return await Account.findOne({ email: value.toLowerCase() });
    }
    return await Account.findOne({ username: new RegExp(`^${escapeRegex(value)}$`, 'i') });
}

// Any friendship or request between two accounts, in either direction
export async function findFriendshipBetween(accountA, accountB) {
    return await Friendship.findOne({
        $or: [
            { requester: accountA, recipient: accountB },
            { requester: accountB, recipient: accountA },
        ],
    });
}

export async function createFriendRequest(requester, recipient) {
    return await Friendship.create({ requester, recipient, status: 'pending' });
}

// All accepted friendships for an account, with both people's public info filled in
export async function findFriendsOf(accountId) {
    return await Friendship.find({
        status: 'accepted',
        $or: [{ requester: accountId }, { recipient: accountId }],
    })
        .populate('requester', PUBLIC_FIELDS)
        .populate('recipient', PUBLIC_FIELDS);
}

// Requests other players sent to this account that haven't been answered yet
export async function findIncomingRequests(accountId) {
    return await Friendship.find({ recipient: accountId, status: 'pending' })
        .populate('requester', PUBLIC_FIELDS)
        .sort({ createdAt: -1 });
}

// Only the person who received the request can accept it
export async function acceptFriendRequest(requestId, recipientId) {
    return await Friendship.findOneAndUpdate(
        { _id: requestId, recipient: recipientId, status: 'pending' },
        { $set: { status: 'accepted' } },
        { returnDocument: 'after' }
    );
}

// Only the person who received the request can ignore it
export async function deleteFriendRequest(requestId, recipientId) {
    return await Friendship.findOneAndDelete({ _id: requestId, recipient: recipientId, status: 'pending' });
}

export async function deleteFriendship(accountId, friendId) {
    return await Friendship.findOneAndDelete({
        status: 'accepted',
        $or: [
            { requester: accountId, recipient: friendId },
            { requester: friendId, recipient: accountId },
        ],
    });
}

// Tables where any of these accounts has a seat, so we can show who is playing
export async function findTablesWithPlayers(accountIds) {
    return await Table.find({ 'seats.refId': { $in: accountIds.map(String) } }, 'name seats');
}
