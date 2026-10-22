import mongoose from 'mongoose';
import { findTableById, addSpectator, removeSpectator } from '../dao/TableDAO.js';
import { getJoiningPlayer } from './JoinTableController.js';
import { normalizeInviteCode } from '../utils/inviteCode.js';

// P3: As a Player, I want to be able to spectate games, so that I can view others play
// and possibly join if available.

// POST /api/tables/:id/spectate   body: { guestId?, inviteCode? }
// Spectating works even when the table is full. That's the point of it.
export async function SpectateTableController(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid table ID' });
        }

        const viewer = await getJoiningPlayer(req);
        if (!viewer) {
            return res.status(401).json({ error: 'Log in or play as a guest to watch a table' });
        }

        const table = await findTableById(id);
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Private tables stay private for watchers too
        if (table.isPrivate && normalizeInviteCode(req.body?.inviteCode) !== table.inviteCode) {
            return res.status(403).json({ error: 'This table is private. Enter the invite code to watch.' });
        }

        // Someone already playing here doesn't need to spectate
        if ((table.seats || []).some(seat => seat.refId === viewer.refId)) {
            return res.status(200).json({ message: 'Already seated', role: 'player', table });
        }

        if ((table.spectators || []).some(s => s.refId === viewer.refId)) {
            return res.status(200).json({ message: 'Already watching', role: 'spectator', table });
        }

        // null means they were added by another request at the same moment, so just re-read
        const updated = (await addSpectator(id, viewer)) ?? (await findTableById(id));

        return res.status(200).json({ message: 'Now watching', role: 'spectator', table: updated });
    } catch (error) {
        console.error('Error spectating table:', error);
        return res.status(500).json({ error: 'Failed to watch table' });
    }
}

// POST /api/tables/:id/stop-spectating   body: { guestId? }
export async function StopSpectatingController(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid table ID' });
        }

        const viewer = await getJoiningPlayer(req);
        if (!viewer) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        const updated = await removeSpectator(id, viewer.refId);
        if (!updated) {
            return res.status(404).json({ error: 'Table not found' });
        }

        return res.status(200).json({ message: 'Stopped watching', table: updated });
    } catch (error) {
        console.error('Error leaving spectator mode:', error);
        return res.status(500).json({ error: 'Failed to stop watching' });
    }
}
