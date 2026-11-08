import { RANKS } from './PlayingCards.js';

// '2' -> 2 ... 'A' -> 14
const RANK_VALUE = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 2]));

export const HAND_NAMES = [
    'High card',
    'One pair',
    'Two pair',
    'Three of a kind',
    'Straight',
    'Flush',
    'Full house',
    'Four of a kind',
    'Straight flush',
];

export function rankValue(card) {
    return RANK_VALUE[card.rank];
}

// Scores exactly five cards.
// Returns { category: 0-8, name, tiebreak: number[] }. A higher category wins,
// and equal categories are settled by comparing tiebreak left to right.
export function evaluateHand(cards) {
    if (!Array.isArray(cards) || cards.length !== 5) {
        throw new Error('A poker hand needs exactly five cards');
    }

    const values = cards.map(rankValue).sort((a, b) => b - a);
    const isFlush = cards.every(card => card.suit === cards[0].suit);

    // Straight: five different values in a row. A-2-3-4-5 ("the wheel") counts, with the ace low.
    let straightHigh = 0;
    if (new Set(values).size === 5) {
        if (values[0] - values[4] === 4) straightHigh = values[0];
        else if (values[0] === 14 && values[1] === 5) straightHigh = 5;
    }

    // Group equal ranks, biggest group first, then highest rank first
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const groups = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || b.value - a.value);
    const shape = groups.map(group => group.count).join('');
    const groupValues = groups.map(group => group.value);

    let category;
    let tiebreak;

    if (straightHigh && isFlush) { category = 8; tiebreak = [straightHigh]; }
    else if (shape === '41') { category = 7; tiebreak = groupValues; }
    else if (shape === '32') { category = 6; tiebreak = groupValues; }
    else if (isFlush) { category = 5; tiebreak = values; }
    else if (straightHigh) { category = 4; tiebreak = [straightHigh]; }
    else if (shape === '311') { category = 3; tiebreak = groupValues; }
    else if (shape === '221') { category = 2; tiebreak = groupValues; }
    else if (shape === '2111') { category = 1; tiebreak = groupValues; }
    else { category = 0; tiebreak = values; }

    const name = category === 8 && straightHigh === 14 ? 'Royal flush' : HAND_NAMES[category];
    return { category, name, tiebreak };
}

// > 0 when a beats b, < 0 when b beats a, 0 for an exact tie
export function compareHands(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
        const difference = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
        if (difference !== 0) return difference;
    }
    return 0;
}