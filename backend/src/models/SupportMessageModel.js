import mongoose from 'mongoose';

// P18 Chat with Admin: one message in a player's conversation with the admins.
// Every message belongs to one player's conversation (playerId), whether the player or an admin sent it.
export const MAX_SUPPORT_LENGTH = 500;

const supportMessageSchema = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    from: { type: String, enum: ['player', 'admin'], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    senderName: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: MAX_SUPPORT_LENGTH },
    // Player messages start unread for admins, admin replies start unread for the player
    readByAdmin: { type: Boolean, default: false },
    readByPlayer: { type: Boolean, default: false },
}, { timestamps: true });

// A conversation is loaded in order, so look messages up by player and time
supportMessageSchema.index({ playerId: 1, createdAt: 1 });

const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);

export default SupportMessage;
