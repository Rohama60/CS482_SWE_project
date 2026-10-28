import PokerGameModel from '../models/PokerGameModel.js';

export async function createPokerGame(gameData) {
    const game = new PokerGameModel(gameData);
    return await game.save();
}

export async function findPokerGameById(id) {
    return await PokerGameModel.findById(id);
}

export async function findGamesByTableId(tableId) {
    return await PokerGameModel.find({ tableId }).sort({ createdAt: -1 });
}