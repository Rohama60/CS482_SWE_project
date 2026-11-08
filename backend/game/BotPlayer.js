import { evaluateHand, rankValue } from './HandEvaluator.js';
import { getLegalActions } from './PokerEngine.js';

// Bot decisions. Pure functions: give them the engine state and an rng (defaults to Math.random)
// and they return an action the engine accepts. Each bot has a style that changes how it plays.

export const BOT_STYLES = {
    tight:      { callBias: -0.10, raiseBias: -0.05, bluff: 0.02 },
    balanced:   { callBias: 0,     raiseBias: 0,     bluff: 0.06 },
    loose:      { callBias: 0.12,  raiseBias: 0.03,  bluff: 0.10 },
    aggressive: { callBias: 0.05,  raiseBias: 0.15,  bluff: 0.18 },
};
export const BOT_NAMES = ['Ace', 'Duke', 'Maverick', 'Queenie', 'Lucky', 'Viper', 'Rook', 'Sage'];

export function botStyleFor(index) {
    const styles = Object.keys(BOT_STYLES);
    return styles[index % styles.length];
}

// 0..1 rough strength of a five-card hand
function strength(cards) {
    const { category, tiebreak } = evaluateHand(cards);
    const high = (tiebreak[0] ?? 2) / 14;
    return Math.min(1, category / 6 + (category === 0 ? high * 0.15 : category === 1 ? 0.18 + high * 0.1 : high * 0.05));
}

export function decideBet(state, refId, rng = Math.random) {
    const legal = getLegalActions(state, refId);
    if (!legal.canAct) return null;
    const player = state.participants.find(p => p.refId === refId);
    const style = BOT_STYLES[player.style] ?? BOT_STYLES.balanced;
    const s = strength(state.hands[refId]);
    const roll = rng();

    // Before the draw hands are unfinished, so play a little looser than the raw strength
    const score = s + style.callBias + (state.round === 'betting1' ? 0.1 : 0);
    const wantsRaise = legal.canRaise && (score + style.raiseBias > 0.62 || roll < style.bluff * (legal.canCheck ? 1 : 0.4));

    if (wantsRaise) {
        const size = Math.min(legal.maxRaise, state.bigBlind * (1 + Math.floor(rng() * 3)));
        const amount = Math.max(legal.minRaise, size);
        if (amount <= legal.maxRaise) return { type: 'raise', amount };
    }
    if (legal.canCheck) return { type: 'check' };

    // Facing a bet: compare the price with the pot and how good the hand is
    const potOdds = legal.toCall / (state.potSize + legal.toCall);
    if (score + 0.15 > potOdds * 1.6 + 0.12 || roll < style.bluff * 0.5) return { type: 'call' };
    return { type: 'fold' };
}

export function decideDraw(state, refId) {
    const cards = state.hands[refId];
    const values = cards.map(rankValue);
    const { category } = evaluateHand(cards);
    if (category >= 4) return []; // straight or better: stand pat

    const byRank = {};
    cards.forEach((c, i) => { (byRank[rankValue(c)] ??= []).push(i); });
    const groups = Object.values(byRank).filter(g => g.length > 1);
    if (groups.length > 0) {
        const keep = new Set(groups.flat());
        return cards.map((_, i) => i).filter(i => !keep.has(i));
    }

    // Four to a flush: keep the four suited cards
    const bySuit = {};
    cards.forEach((c, i) => { (bySuit[c.suit] ??= []).push(i); });
    const flush = Object.values(bySuit).find(g => g.length === 4);
    if (flush) return cards.map((_, i) => i).filter(i => !flush.includes(i));

    // Otherwise keep the two highest cards
    const order = values.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const keep = new Set(order.slice(0, 2).map(x => x[1]));
    return cards.map((_, i) => i).filter(i => !keep.has(i));
}