import mongoose from 'mongoose';
import { auth } from '../Auth.js';
import Account from '../models/AccountModel.js';
import { findTableById } from '../dao/TableDAO.js';
import { saveChatMessage, findRecentMessages } from '../dao/ChatDAO.js';
import { filterMessage, MAX_MESSAGE_LENGTH } from '../utils/chatFilter.js';

// M3: As a Member, I want to chat with my opponents,
// so that I can communicate with other members during the game.
// Anyone at the table can read the chat. Only members sitting at the table can send.

export const MEMBERS_ONLY = 'Members Only! Sign up to chat';
export const SEATED_ONLY = 'Take a seat at the table to chat';

// What the browser gets for each message
export function toChatMessage(doc) {
    return {
        id: String(doc._id),
        name: doc.name,
        message: doc.message,
        createdAt: doc.createdAt,
    };
}

const roomFor = tableId => `table-${tableId}`;

// GET /api/tables/:id/chat
// The last 50 messages, so you see the conversation when you open a table
export async function GetChatController(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid table ID' });
        }

        const messages = await findRecentMessages(id);
        return res.status(200).json({ messages: messages.map(toChatMessage) });
    } catch (error) {
        console.error('Error loading chat:', error);
        return res.status(500).json({ error: 'Failed to load chat' });
    }
}

// Handles 'chat:send' from one player's socket.
// Problems go back only to the sender as 'chat:error'. Good messages go to the whole table as 'chat:message'.
export async function handleChatSend({ io, socket, payload }) {
    const sendError = error => socket.emit('chat:error', { error });

    try {
        const tableId = payload?.tableId;
        const text = typeof payload?.message === 'string' ? payload.message.trim() : '';

        if (!tableId || !mongoose.isValidObjectId(tableId)) return sendError('Invalid table');
        if (!text) return sendError('Type a message first');
        if (text.length > MAX_MESSAGE_LENGTH) {
            return sendError(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters`);
        }

        // The login cookie comes along with the socket connection
        const session = await auth.api.getSession({ headers: new Headers(socket.handshake?.headers || {}) });
        if (!session?.user) return sendError(MEMBERS_ONLY);

        const account = await Account.findOne({ userId: session.user.id });
        if (!account) return sendError(MEMBERS_ONLY);

        const table = await findTableById(tableId);
        if (!table) return sendError('Table not found');

        const seated = (table.seats || []).some(seat => seat.refId === String(account._id));
        if (!seated) return sendError(SEATED_ONLY);

        const { message, filtered } = filterMessage(text);
        const saved = await saveChatMessage({
            tableId,
            accountId: account._id,
            name: account.displayName || account.username,
            message,
            filtered,
        });

        io.to(roomFor(tableId)).emit('chat:message', toChatMessage(saved));
    } catch (error) {
        console.error('Error sending chat message:', error);
        sendError('Message could not be sent');
    }
}

// How many people have the table open right now
export function countInRoom(io, tableId) {
    return io.sockets?.adapter?.rooms?.get(roomFor(tableId))?.size ?? 0;
}

// Tells everyone at a table how many people are there, for the "online" count in the chat box
export function broadcastOnline(io, tableId, adjust = 0) {
    const online = Math.max(0, countInRoom(io, tableId) + adjust);
    io.to(roomFor(tableId)).emit('chat:online', { tableId, online });
}

// Hooks chat onto a new socket connection. Josue's handlers for joining and leaving
// the table room run first (they were added first), so the counts here are up to date.
export function registerChatHandlers(io, socket) {
    socket.on('chat:send', payload => handleChatSend({ io, socket, payload }));
    socket.on('join-table-room', tableId => broadcastOnline(io, tableId));
    socket.on('leave-table-room', tableId => broadcastOnline(io, tableId));

    // Right before a socket closes it's still in its rooms, so count it as already gone
    socket.on('disconnecting', () => {
        for (const room of socket.rooms || []) {
            if (room.startsWith('table-')) broadcastOnline(io, room.slice('table-'.length), -1);
        }
    });
}
