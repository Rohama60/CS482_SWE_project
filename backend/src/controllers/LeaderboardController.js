import Account from '../models/AccountModel.js';

export async function GetLeaderboardController(_req, res) {
    try {
        const accounts = await Account.find({ role: 'player' })
            .select('userId username displayName chipamount wins losses')
            .sort({ wins: -1, chipamount: -1 })
            .limit(100)
            .lean();

        const players = accounts.map(account => ({
            id: account.userId,
            name: account.displayName || account.username,
            chips: account.chipamount ?? 0,
            wins: account.wins ?? 0,
            handsPlayed: (account.wins ?? 0) + (account.losses ?? 0),
        }));

        return res.status(200).json({ players });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return res.status(500).json({ error: 'Failed to load leaderboard' });
    }
}
