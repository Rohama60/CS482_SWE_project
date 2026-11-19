import BotGame from '../models/BotGameModel.js';

// P13 Game History: reads finished hands. Nothing here changes a game.
// Every hand (with or without bots) is saved as a BotGame, and a finished one has settled: true.

// The most hands we read to add up your stats
export const MAX_HANDS = 500;

// Finished hands this player was dealt into, newest first
export async function findFinishedHandsFor(refId, limit = MAX_HANDS) {
    return await BotGame.find(
        { settled: true, 'engine.participants.refId': String(refId) },
        'tableId engine.participants engine.winners engine.resultText startChips handNumber bigBlind createdAt updatedAt'
    )
        .sort({ updatedAt: -1 })
        .limit(limit)
        .populate('tableId', 'name')
        .lean();
}
