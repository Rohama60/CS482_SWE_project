import mongoose from 'mongoose';

// M3: one chat message sent at a table. These are the chat logs from our design doc,
// so admins can look back at them later (for example, when a complaint is filed).
const chatMessageSchema = new mongoose.Schema({
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    name: { type: String, required: true },
    message: { type: String, required: true, maxlength: 200 },
    // true if bad words were replaced with ***
    filtered: { type: Boolean, default: false },
}, { timestamps: true });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;
