import mongoose from 'mongoose';

// P11: a friendship between two accounts.
// It starts as a 'pending' request from the requester and becomes 'accepted' when the recipient accepts.
const friendshipSchema = new mongoose.Schema({
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
}, { timestamps: true });

// The same two people can only have one request going in each direction
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

const Friendship = mongoose.model('Friendship', friendshipSchema);

export default Friendship;
