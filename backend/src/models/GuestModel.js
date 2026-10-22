import mongoose from 'mongoose';

// G1: a guest can play without an account. Nothing is tied to an email or password,
// and MongoDB deletes the guest automatically 24 hours after it was created.
const guestSchema = new mongoose.Schema({
    displayName: { type: String, required: true },
    chipamount: { type: Number, default: 500, min: 0 },
    role: { type: String, default: 'guest' },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});

guestSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

const Guest = mongoose.model('Guest', guestSchema);

export default Guest;
