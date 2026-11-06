import Account from '../models/AccountModel.js';
import Guest from '../models/GuestModel.js';

// Deduct chips only if the player has enough
export async function deductChips(player, amount, session) {
    const Model = player.kind === 'user' ? Account : Guest;

    return Model.findOneAndUpdate(
        {
            _id: player.refId,
            chipamount: { $gte: amount }
        },
        {
            $inc: { chipamount: -amount }
        },
        {
            new: true,
            session
        }
    );
}
export async function getPlayerChips(player) {
    const Model = player.kind === 'user' ? Account : Guest;

    const account = await Model.findById(player.refId)
        .select('chipamount');

    return account;
}