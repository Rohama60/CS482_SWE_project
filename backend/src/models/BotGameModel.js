import mongoose from 'mongoose';

// One hand of 5-card draw played with the game engine (bots, betting, real draw).
// Kept separate from PokerGameModel so the existing game code is untouched.
// The whole hand lives in `engine` (see game/PokerEngine.js).
const botGameSchema = new mongoose.Schema({
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    engine: { type: mongoose.Schema.Types.Mixed, default: null },
    startChips: { type: mongoose.Schema.Types.Mixed, default: {} },
    settled: { type: Boolean, default: false },
    handNumber: { type: Number, default: 0 },
}, { timestamps: true, minimize: false, strict: false });

export default mongoose.model('BotGame', botGameSchema);