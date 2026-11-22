import Account from '../models/AccountModel.js';
import Guest from '../models/GuestModel.js';
import AdClickStat from '../models/AdClickStat.js';
import { getJoiningPlayer } from './JoinTableController.js';

const AD_REWARDS = {
    quick: { amount: 500, cooldownMs: 60 * 60 * 1000 },
    feature: { amount: 1500 },
    premium: { amount: 5000 },
};

const AD_NAMES = {
    quick: 'Quick Ad',
    feature: 'Feature Ad',
    premium: 'Premium Ad',
};

export async function GetAdminAdClickStatsController(req, res) {
    try {
        const stats = await AdClickStat.find({}).lean();
        const statsByType = new Map(stats.map(stat => [stat.adType, stat]));
        const docs = Object.entries(AD_REWARDS).map(([adType, reward]) => {
            const stat = statsByType.get(adType);
            return {
                id: adType,
                adType,
                name: AD_NAMES[adType],
                placement: 'Lobby',
                rewardChips: reward.amount,
                clicks: stat?.clicks ?? 0,
                lastClickedAt: stat?.lastClickedAt ?? null,
            };
        }).sort((left, right) => right.clicks - left.clicks);

        return res.status(200).json({
            docs,
            totalDocs: docs.length,
            totalClicks: docs.reduce((total, ad) => total + ad.clicks, 0),
        });
    } catch (error) {
        console.error('Error fetching ad click statistics:', error);
        return res.status(500).json({ error: 'Unable to load ad click statistics' });
    }
}

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

        await AdClickStat.findOneAndUpdate(
            { adType: req.body.adType },
            { $inc: { clicks: 1 }, $set: { lastClickedAt: new Date() } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );

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
