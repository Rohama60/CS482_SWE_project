import { auth } from '../Auth.js';
import Account from '../models/AccountModel.js';
import { findFinishedHandsFor } from '../dao/GameHistoryDAO.js';

// P13: As a Player, I want to be able to see the games that I have played,
// so that I can see how I've been doing.

export const MEMBERS_ONLY = 'Log in to see your game history';
// How many hands the Recent games list shows
export const RECENT_LIMIT = 20;

// One finished hand from this player's point of view
export function toHistoryEntry(hand, refId) {
    const me = String(refId);
    const participants = hand.engine?.participants ?? [];
    const winners = hand.engine?.winners ?? [];
    const mine = participants.find(player => String(player.refId) === me);
    const myWin = winners.find(winner => String(winner.refId) === me);

    const startChips = Number(hand.startChips?.[me] ?? 0);
    const endChips = Number(mine?.chips ?? startChips);

    return {
        id: String(hand._id),
        tableName: hand.tableId?.name ?? 'Table',
        playedAt: hand.updatedAt ?? hand.createdAt,
        result: myWin ? 'won' : 'lost',
        folded: Boolean(mine?.folded),
        chipsChange: endChips - startChips,
        handName: myWin?.handName ?? null,
        summary: hand.engine?.resultText ?? '',
        players: participants.length,
        opponents: participants.filter(player => String(player.refId) !== me).map(player => player.displayName),
    };
}

// Wins, losses and so on from every finished hand
export function toStats(entries) {
    const hands = entries.length;
    const wins = entries.filter(entry => entry.result === 'won').length;
    return {
        hands,
        wins,
        losses: hands - wins,
        winRate: hands ? Math.round((wins / hands) * 100) : 0,
        netChips: entries.reduce((total, entry) => total + entry.chipsChange, 0),
    };
}

// GET /api/history
export async function GetGameHistoryController(req, res) {
    try {
        const session = await auth.api.getSession({ headers: new Headers(req.headers || {}) });
        if (!session?.user) return res.status(401).json({ error: MEMBERS_ONLY });

        const account = await Account.findOne({ userId: session.user.id });
        if (!account) return res.status(401).json({ error: MEMBERS_ONLY });

        const hands = await findFinishedHandsFor(account._id);
        const entries = hands.map(hand => toHistoryEntry(hand, account._id));

        return res.status(200).json({ stats: toStats(entries), games: entries.slice(0, RECENT_LIMIT) });
    } catch (error) {
        console.error('Error loading game history:', error);
        return res.status(500).json({ error: 'Failed to load game history' });
    }
}
