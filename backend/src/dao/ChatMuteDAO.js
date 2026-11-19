import ChatMute from '../models/ChatMuteModel.js';

// Mute Others: the database functions for muting players in chat.

// The ids of everyone this member has muted, as strings
export async function findMutedIds(muterId) {
    const mutes = await ChatMute.find({ muter: muterId }, 'muted');
    return mutes.map(mute => String(mute.muted));
}

// Muting someone twice is fine: the upsert just keeps the one mute
export async function muteAccount(muterId, mutedId) {
    return await ChatMute.findOneAndUpdate(
        { muter: muterId, muted: mutedId },
        { $setOnInsert: { muter: muterId, muted: mutedId } },
        { upsert: true, returnDocument: 'after' }
    );
}

// Returns the removed mute, or null if they weren't muted
export async function unmuteAccount(muterId, mutedId) {
    return await ChatMute.findOneAndDelete({ muter: muterId, muted: mutedId });
}
