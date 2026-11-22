import Account from '../models/AccountModel.js';
import Guest from '../models/GuestModel.js';
import { getJoiningPlayer } from './JoinTableController.js';

const AD_REWARDS = {
    quick: { amount: 500, cooldownMs: 60 * 60 * 1000 },
    feature: { amount: 1500 },
    premium: { amount: 5000 },
};

export async function ClaimAdRewardController(req, res) {
    try {
        const reward = AD_REWARDS[req.body?.adType];
        if (!reward) {
            return res.status(400).json({ error: 'Invalid ad reward type' });
        }

        const player = await getJoiningPlayer(req);
        if (!player) {
            return res.status(401).json({ error: 'Log in or start a guest session to claim chips' });
        }

        const Model = player.kind === 'user' ? Account : Guest;
        const filter = { _id: player.refId };
        const update = { $inc: { chipamount: reward.amount } };
        if (reward.cooldownMs) {
            const cooldownCutoff = new Date(Date.now() - reward.cooldownMs);
            filter.$or = [
                { lastQuickAdAt: { $exists: false } },
                { lastQuickAdAt: { $lte: cooldownCutoff } },
            ];
            update.$set = { lastQuickAdAt: new Date() };
        }

        const updatedPlayer = await Model.findOneAndUpdate(filter, update, { new: true });
        if (!updatedPlayer) {
            return res.status(429).json({ error: 'Quick Ad reward is available once per hour.' });
        }

        return res.status(200).json({
            chipamount: updatedPlayer.chipamount,
            reward: reward.amount,
        });
    } catch (error) {
        console.error('Error claiming ad reward:', error);
        return res.status(500).json({ error: 'Unable to claim ad reward' });
    }
}
