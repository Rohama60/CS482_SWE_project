import mongoose from 'mongoose';
import { auth } from '../Auth.js';
import Account from '../models/AccountModel.js';
import { MAX_SUPPORT_LENGTH } from '../models/SupportMessageModel.js';
import {
    saveSupportMessage,
    findConversation,
    findConversationsForAdmin,
    markReadByAdmin,
    markReadByPlayer,
    countUnreadForPlayer,
} from '../dao/SupportDAO.js';

// P18: As a Player, I want to chat with an admin, so that I can get help with a problem.
// Players have one conversation with the admins. Any admin can read it and reply.
// New messages are also sent live over Socket.IO, to the player's room and to the admins' room.

export const MEMBERS_ONLY = 'Log in to chat with an admin';
export const ADMIN_ROOM = 'support-admins';
export const playerRoom = playerId => `support-${playerId}`;

async function getMyAccount(headers) {
    const session = await auth.api.getSession({ headers: new Headers(headers || {}) });
    if (!session?.user) return null;
    return await Account.findOne({ userId: session.user.id });
}

const nameOf = account => account.displayName || account.username || 'Player';

// What the browser gets for each message
export function toSupportMessage(doc) {
    return {
        id: String(doc._id),
        playerId: String(doc.playerId),
        from: doc.from,
        senderName: doc.senderName,
        message: doc.message,
        createdAt: doc.createdAt,
    };
}

// The message text, or an error to send back
export function checkMessage(body) {
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return { error: 'Type a message first' };
    if (message.length > MAX_SUPPORT_LENGTH) return { error: `Messages can be up to ${MAX_SUPPORT_LENGTH} characters` };
    return { message };
}

// Sends a new message live to the player and to every admin who has the inbox open
function broadcast(req, saved) {
    const io = req.app?.get?.('io');
    if (!io) return;
    io.to(playerRoom(saved.playerId)).to(ADMIN_ROOM).emit('support:message', saved);
}

// ---- Player side --------------------------------------------------

// GET /api/support   your conversation. Opening it marks admin replies as read.
export async function GetMySupportController(req, res) {
    try {
        const me = await getMyAccount(req.headers);
        if (!me) return res.status(401).json({ error: MEMBERS_ONLY });

        const messages = await findConversation(me._id);
        await markReadByPlayer(me._id);
        // playerId lets the browser tell its own conversation apart in live updates
        return res.status(200).json({ playerId: String(me._id), messages: messages.map(toSupportMessage) });
    } catch (error) {
        console.error('Error loading support chat:', error);
        return res.status(500).json({ error: 'Failed to load your messages' });
    }
}

// GET /api/support/unread   how many admin replies you haven't seen, for the button badge
export async function GetMyUnreadController(req, res) {
    try {
        const me = await getMyAccount(req.headers);
        if (!me) return res.status(401).json({ error: MEMBERS_ONLY });

        return res.status(200).json({ unread: await countUnreadForPlayer(me._id) });
    } catch (error) {
        console.error('Error counting support replies:', error);
        return res.status(500).json({ error: 'Failed to check for replies' });
    }
}

// POST /api/support   body: { message }
export async function SendSupportMessageController(req, res) {
    try {
        const me = await getMyAccount(req.headers);
        if (!me) return res.status(401).json({ error: MEMBERS_ONLY });

        const { message, error } = checkMessage(req.body);
        if (error) return res.status(400).json({ error });

        const saved = toSupportMessage(await saveSupportMessage({
            playerId: me._id, from: 'player', senderId: me._id, senderName: nameOf(me), message,
        }));
        broadcast(req, saved);
        return res.status(201).json({ message: saved });
    } catch (error) {
        console.error('Error sending support message:', error);
        return res.status(500).json({ error: 'Message could not be sent' });
    }
}

// ---- Admin side (these routes use Ayana's verifyAdmin first, so req.adminAccount is the admin) ----

// GET /api/admin/support   every conversation, newest first
export async function GetSupportInboxController(req, res) {
    try {
        const rows = await findConversationsForAdmin();
        const conversations = rows.map(row => ({
            playerId: String(row._id),
            playerName: row.player ? nameOf(row.player) : 'Deleted player',
            lastMessage: row.lastMessage,
            lastFrom: row.lastFrom,
            lastAt: row.lastAt,
            unread: row.unread,
        }));
        return res.status(200).json({ conversations });
    } catch (error) {
        console.error('Error loading support inbox:', error);
        return res.status(500).json({ error: 'Failed to load support inbox' });
    }
}

// GET /api/admin/support/:playerId   one player's conversation. Opening it marks their messages as read.
export async function GetSupportConversationController(req, res) {
    try {
        const { playerId } = req.params;
        if (!mongoose.isValidObjectId(playerId)) return res.status(400).json({ error: 'Invalid player' });

        const player = await Account.findById(playerId);
        const messages = await findConversation(playerId);
        await markReadByAdmin(playerId);
        return res.status(200).json({
            player: { id: String(playerId), name: player ? nameOf(player) : 'Deleted player' },
            messages: messages.map(toSupportMessage),
        });
    } catch (error) {
        console.error('Error loading support conversation:', error);
        return res.status(500).json({ error: 'Failed to load conversation' });
    }
}

// POST /api/admin/support/:playerId   body: { message }   an admin replies
export async function ReplySupportController(req, res) {
    try {
        const { playerId } = req.params;
        if (!mongoose.isValidObjectId(playerId)) return res.status(400).json({ error: 'Invalid player' });

        const { message, error } = checkMessage(req.body);
        if (error) return res.status(400).json({ error });

        const player = await Account.findById(playerId);
        if (!player) return res.status(404).json({ error: 'Player not found' });

        const admin = req.adminAccount;
        const saved = toSupportMessage(await saveSupportMessage({
            playerId: player._id, from: 'admin', senderId: admin._id, senderName: nameOf(admin), message,
        }));
        // The admin just answered, so the player's earlier messages count as read
        await markReadByAdmin(player._id);
        broadcast(req, saved);
        return res.status(201).json({ message: saved });
    } catch (error) {
        console.error('Error replying to support message:', error);
        return res.status(500).json({ error: 'Reply could not be sent' });
    }
}

// ---- Live updates -------------------------------------------------

// When the support chat or the admin inbox opens, the browser asks to join its room.
// The login cookie comes along with the socket connection.
export async function handleSupportJoin(socket, callback) {
    try {
        const me = await getMyAccount(socket.handshake?.headers);
        if (!me) return callback?.({ ok: false, error: MEMBERS_ONLY });

        socket.join(playerRoom(me._id));
        const admin = me.role === 'admin';
        if (admin) socket.join(ADMIN_ROOM);
        return callback?.({ ok: true, admin });
    } catch (error) {
        console.error('Error joining support chat:', error);
        return callback?.({ ok: false, error: 'Could not connect to support chat' });
    }
}

export function registerSupportHandlers(io, socket) {
    socket.on('support:join', callback => handleSupportJoin(socket, callback));
}
