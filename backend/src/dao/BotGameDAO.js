import mongoose from 'mongoose';
import BotGame from '../models/BotGameModel.js';
import Table from '../models/TableModel.js';
import Account from '../models/AccountModel.js';
import Guest from '../models/GuestModel.js';

// Database helpers for bot games. New file so the existing DAOs stay as they are.

export async function createPokerGame(data, session = null) {
    return await new BotGame(data).save({ session });
}

export async function findPokerGameById(id) {
    return await BotGame.findById(id);
}

export async function updatePokerGame(id, changes, session = null) {
    return await BotGame.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after', session });
}

export async function findLatestGameByTableId(tableId) {
    return await BotGame.findOne({ tableId }).sort({ createdAt: -1 });
}

// Runs fn(session) as one all-or-nothing database transaction
export async function runInTransaction(fn) {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => { result = await fn(session); });
        return result;
    } finally {
        await session.endSession();
    }
}

// Adds (or with a negative number, removes) chips. Used to settle a hand.
export async function addChips(player, amount, session) {
    const Model = player.kind === 'user' ? Account : Guest;
    return Model.findOneAndUpdate({ _id: player.refId }, { $inc: { chipamount: amount } }, { new: true, session });
}

export async function getChipBalance(player) {
    const Model = player.kind === 'user' ? Account : Guest;
    const doc = await Model.findById(player.refId).select('chipamount');
    return doc ? doc.chipamount : null;
}

// The hand is over: let people join/leave again and count the hand
export async function finishTableGame(id, session) {
    return await Table.findByIdAndUpdate(
        id, { $set: { gameInProgress: false }, $inc: { hands: 1 } }, { returnDocument: 'after', session }
    );
}