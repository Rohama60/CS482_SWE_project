import mongoose from 'mongoose';
import { auth } from '../Auth.js';
import Account from '../models/AccountModel.js';
import { findMutedIds, muteAccount, unmuteAccount } from '../dao/ChatMuteDAO.js';

// Mute Others: As a Member, I want to mute another player in chat,
// so that I don't see their messages.
// Mutes are saved to your account, so they stay after a refresh and at every table.

export const MEMBERS_ONLY = 'Log in to mute players';

async function getMyAccount(req) {
    const session = await auth.api.getSession({ headers: new Headers(req.headers || {}) });
    if (!session?.user) return null;
    return await Account.findOne({ userId: session.user.id });
}

// GET /api/chat/mutes
export async function GetMutesController(req, res) {
    try {
        const me = await getMyAccount(req);
        if (!me) return res.status(401).json({ error: MEMBERS_ONLY });

        const muted = await findMutedIds(me._id);
        return res.status(200).json({ muted });
    } catch (error) {
        console.error('Error loading mutes:', error);
        return res.status(500).json({ error: 'Failed to load muted players' });
    }
}

// POST /api/chat/mutes   body: { playerId }
export async function MutePlayerController(req, res) {
    try {
        const me = await getMyAccount(req);
        if (!me) return res.status(401).json({ error: MEMBERS_ONLY });

        const playerId = req.body?.playerId;
        if (!playerId || !mongoose.isValidObjectId(playerId)) {
            return res.status(400).json({ error: 'Invalid player' });
        }
        if (String(playerId) === String(me._id)) {
            return res.status(400).json({ error: "You can't mute yourself" });
        }

        const them = await Account.findById(playerId);
        if (!them) return res.status(404).json({ error: 'Player not found' });

        await muteAccount(me._id, them._id);
        const name = them.displayName || them.username;
        return res.status(201).json({ message: `${name} is muted`, playerId: String(them._id) });
    } catch (error) {
        console.error('Error muting player:', error);
        return res.status(500).json({ error: 'Failed to mute player' });
    }
}

// DELETE /api/chat/mutes/:playerId
export async function UnmutePlayerController(req, res) {
    try {
        const me = await getMyAccount(req);
        if (!me) return res.status(401).json({ error: MEMBERS_ONLY });

        const { playerId } = req.params;
        if (!mongoose.isValidObjectId(playerId)) {
            return res.status(400).json({ error: 'Invalid player' });
        }

        const removed = await unmuteAccount(me._id, playerId);
        if (!removed) return res.status(404).json({ error: 'That player is not muted' });

        return res.status(200).json({ message: 'Player unmuted', playerId: String(playerId) });
    } catch (error) {
        console.error('Error unmuting player:', error);
        return res.status(500).json({ error: 'Failed to unmute player' });
    }
}
