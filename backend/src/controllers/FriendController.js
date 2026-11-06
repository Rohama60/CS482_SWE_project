import mongoose from 'mongoose';
import { auth } from '../Auth.js';
import Account from '../models/AccountModel.js';
import {
    findAccountByPlayer,
    findFriendshipBetween,
    createFriendRequest,
    findFriendsOf,
    findIncomingRequests,
    acceptFriendRequest,
    deleteFriendRequest,
    deleteFriendship,
    findTablesWithPlayers,
} from '../dao/FriendDAO.js';

// P11: As a Player, I want to be able to add friends to my friends list,
// so that I can play games with my friends.

// Friends are for members only, so every route starts by finding the logged-in account
export async function getMyAccount(req) {
    const session = await auth.api.getSession({ headers: new Headers(req.headers || {}) });
    if (!session?.user) return null;
    return await Account.findOne({ userId: session.user.id });
}

// The small set of info we show about another player
export function toPlayer(account) {
    return {
        id: String(account._id),
        username: account.username,
        displayName: account.displayName || account.username,
        chips: account.chipamount ?? 0,
    };
}

// GET /api/friends
// Your friends, and whether each one is sitting at a table right now
export async function GetFriendsController(req, res) {
    try {
        const me = await getMyAccount(req);
        if (!me) return res.status(401).json({ error: 'Log in to see your friends' });

        const friendships = await findFriendsOf(me._id);
        const friends = friendships
            .map(f => (String(f.requester._id) === String(me._id) ? f.recipient : f.requester))
            .filter(Boolean)
            .map(toPlayer);

        const tables = friends.length ? await findTablesWithPlayers(friends.map(f => f.id)) : [];
        const tableFor = id => tables.find(table => (table.seats || []).some(seat => seat.refId === id));

        const withStatus = friends.map(friend => {
            const table = tableFor(friend.id);
            return table
                ? { ...friend, status: 'playing', activity: `At the ${table.name}`, tableId: String(table._id) }
                : { ...friend, status: 'idle', activity: 'Not at a table' };
        });

        return res.status(200).json({ friends: withStatus });
    } catch (error) {
        console.error('Error getting friends:', error);
        return res.status(500).json({ error: 'Failed to load friends' });
    }
}

// GET /api/friends/requests
// Friend requests other players sent you
export async function GetFriendRequestsController(req, res) {
    try {
        const me = await getMyAccount(req);
        if (!me) return res.status(401).json({ error: 'Log in to see friend requests' });

        const pending = await findIncomingRequests(me._id);
        const requests = pending
            .filter(request => request.requester)
            .map(request => ({ id: String(request._id), from: toPlayer(request.requester) }));

        return res.status(200).json({ requests });
    } catch (error) {
        console.error('Error getting friend requests:', error);
        return res.status(500).json({ error: 'Failed to load friend requests' });
    }
}

// POST /api/friends/requests   body: { player }  (a username or an email)
export async function SendFriendRequestController(req, res) {
    try {
        const me = await getMyAccount(req);
        if (!me) return res.status(401).json({ error: 'Log in to add friends' });

        const player = typeof req.body?.player === 'string' ? req.body.player.trim() : '';
        if (!player) return res.status(400).json({ error: 'Enter a player name or email' });

        const them = await findAccountByPlayer(player);
        if (!them) return res.status(404).json({ error: 'No player with that name or email' });
        if (String(them._id) === String(me._id)) {
            return res.status(400).json({ error: "You can't add yourself" });
        }

        const existing = await findFriendshipBetween(me._id, them._id);
        if (existing?.status === 'accepted') {
            return res.status(409).json({ error: `You're already friends with ${them.username}` });
        }
        if (existing && String(existing.requester) === String(me._id)) {
            return res.status(409).json({ error: `You already sent ${them.username} a request` });
        }
        if (existing) {
            // They already asked you, so sending one back just makes you friends
            await acceptFriendRequest(existing._id, me._id);
            return res.status(200).json({ message: `You and ${them.username} are now friends`, friend: toPlayer(them) });
        }

        await createFriendRequest(me._id, them._id);
        return res.status(201).json({ message: `Friend request sent to ${them.username}`, to: toPlayer(them) });
    } catch (error) {
        console.error('Error sending friend request:', error);
        return res.status(500).json({ error: 'Failed to send friend request' });
    }
}

// POST /api/friends/requests/:id/accept
export async function AcceptFriendRequestController(req, res) {
    try {
        const me = await getMyAccount(req);
        if (!me) return res.status(401).json({ error: 'Log in to accept friend requests' });

        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid request ID' });

        const accepted = await acceptFriendRequest(id, me._id);
        if (!accepted) return res.status(404).json({ error: 'Friend request not found' });

        return res.status(200).json({ message: 'Friend request accepted' });
    } catch (error) {
        console.error('Error accepting friend request:', error);
        return res.status(500).json({ error: 'Failed to accept friend request' });
    }
}

// POST /api/friends/requests/:id/decline   (the "Ignore" button)
export async function DeclineFriendRequestController(req, res) {
    try {
        const me = await getMyAccount(req);
        if (!me) return res.status(401).json({ error: 'Log in to answer friend requests' });

        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid request ID' });

        const removed = await deleteFriendRequest(id, me._id);
        if (!removed) return res.status(404).json({ error: 'Friend request not found' });

        return res.status(200).json({ message: 'Friend request ignored' });
    } catch (error) {
        console.error('Error declining friend request:', error);
        return res.status(500).json({ error: 'Failed to ignore friend request' });
    }
}

// DELETE /api/friends/:friendId
export async function RemoveFriendController(req, res) {
    try {
        const me = await getMyAccount(req);
        if (!me) return res.status(401).json({ error: 'Log in to remove friends' });

        const { friendId } = req.params;
        if (!mongoose.isValidObjectId(friendId)) return res.status(400).json({ error: 'Invalid friend ID' });

        const removed = await deleteFriendship(me._id, friendId);
        if (!removed) return res.status(404).json({ error: 'You are not friends with that player' });

        return res.status(200).json({ message: 'Friend removed' });
    } catch (error) {
        console.error('Error removing friend:', error);
        return res.status(500).json({ error: 'Failed to remove friend' });
    }
}
