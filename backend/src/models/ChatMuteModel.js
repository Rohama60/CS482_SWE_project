import mongoose from 'mongoose';

// Mute Others: one member (muter) has muted another member (muted) in table chat.
// The muted player's messages are hidden from the muter at every table.
const chatMuteSchema = new mongoose.Schema({
    muter: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    muted: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
}, { timestamps: true });

// You can only mute the same person once
chatMuteSchema.index({ muter: 1, muted: 1 }, { unique: true });

const ChatMute = mongoose.model('ChatMute', chatMuteSchema);

export default ChatMute;
