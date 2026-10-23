import mongoose from 'mongoose';
import { auth } from '../Auth.js';
import Account from '../models/AccountModel.js';
import { findTableById, findTableByInviteCode, addSeatIfOpen, updateTable } from '../dao/TableDAO.js';
import { findGuestById } from '../dao/GuestDAO.js';
import { normalizeInviteCode } from '../utils/inviteCode.js';

// P7: As a Player, I want to join a public/private game, so that I can play poker
// (if a code is given for private).

// Works out who is joining: a logged-in user first, otherwise a guest from G1.
// Returns a seat like { kind, refId, displayName }, or null if we can't tell.
export async function getJoiningPlayer(req) {
    const session = await auth.api.getSession({ headers: new Headers(req.headers || {}) });

    if (session?.user) {
        const account = await Account.findOne({ userId: session.user.id });
        if (!account) return null;
        return {
            kind: 'user',
            refId: String(account._id),
            displayName: account.displayName || account.username
        };
    }

    const guestId = req.body?.guestId;
    if (guestId && mongoose.isValidObjectId(guestId)) {
        const guest = await findGuestById(guestId);
        if (!guest) return null;
        return {
            kind: 'guest',
            refId: String(guest._id ?? guest.id),
            displayName: guest.displayName
        };
    }

    return null;
}

// Shared by both join routes once we know which table and who is joining
async function seatPlayer(table, player, res) {
    const alreadySeated = (table.seats || []).some(seat => seat.refId === player.refId);
    if (alreadySeated) {
        return res.status(200).json({ message: 'Already seated', table });
    }

    if (table.players >= table.max) {
        return res.status(409).json({ error: 'Table is full' });
    }

    const updated = await addSeatIfOpen(table.id ?? table._id, player);
    if (!updated) {
        // Someone else took the last seat between our check and the update
        return res.status(409).json({ error: 'Table is full' });
    }

    const status = updated.players >= updated.max ? 'full' : 'active';
    const finalTable = updated.status === status
        ? updated
        : await updateTable(updated.id ?? updated._id, { status });

    return res.status(200).json({ message: 'Joined table', table: finalTable });
}

// POST /api/tables/:id/join   body: { guestId?, inviteCode? }
// Used when a player clicks "Take a Seat" on a table in the lobby.
export async function JoinTableController(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid table ID' });
        }

        const player = await getJoiningPlayer(req);
        if (!player) {
            return res.status(401).json({ error: 'Log in or play as a guest to join a table' });
        }

        const table = await findTableById(id);
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        if (table.isPrivate && normalizeInviteCode(req.body?.inviteCode) !== table.inviteCode) {
            return res.status(403).json({ error: 'This table is private. Enter the invite code to join.' });
        }

        return await seatPlayer(table, player, res);
    } catch (error) {
        console.error('Error joining table:', error);
        return res.status(500).json({ error: 'Failed to join table' });
    }
}

// POST /api/tables/join-code   body: { inviteCode, guestId? }
// Private tables don't show in the lobby, so players join them by typing the code.
export async function JoinByCodeController(req, res) {
    try {
        const code = normalizeInviteCode(req.body?.inviteCode);
        if (!code) {
            return res.status(400).json({ error: 'Enter an invite code' });
        }

        const player = await getJoiningPlayer(req);
        if (!player) {
            return res.status(401).json({ error: 'Log in or play as a guest to join a table' });
        }

        const table = await findTableByInviteCode(code);
        if (!table) {
            return res.status(404).json({ error: 'No table with that code' });
        }

        return await seatPlayer(table, player, res);
    } catch (error) {
        console.error('Error joining table by code:', error);
        return res.status(500).json({ error: 'Failed to join table' });
    }
}
