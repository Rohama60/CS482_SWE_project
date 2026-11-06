import { dealCards, shuffleDeck } from './PlayingCards.js';
import { evaluateHand, compareHands } from './HandEvaluator.js';

// The rules of one hand of five-card draw, as plain functions over a plain state object.
// No database, no sockets, no randomness except the shuffle you pass in, so every rule
// can be unit tested on its own. The game service saves and loads this state.
//
// Flow of a hand:  betting1 -> drawing (everyone replaces cards once) -> betting2 -> finished

export const MAX_RAISES_PER_ROUND = 3;
export const MAX_DISCARDS = 5;

export class GameRuleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GameRuleError';
    }
}

const isLive = p => !p.folded;              // still in the hand
const canAct = p => !p.folded && p.chips > 0; // in the hand and not all-in

function indexOfPlayer(state, refId) {
    return state.participants.findIndex(p => p.refId === refId);
}

function getPlayer(state, refId) {
    const player = state.participants[indexOfPlayer(state, refId)];
    if (!player) throw new GameRuleError('You are not a player in this game');
    return player;
}

// Next player after `fromIndex` (wrapping) who satisfies `test`, or null
function findNext(state, fromIndex, test) {
    const count = state.participants.length;
    for (let step = 1; step <= count; step++) {
        const player = state.participants[(fromIndex + step) % count];
        if (test(player)) return player;
    }
    return null;
}

function firstFrom(state, startIndex, test) {
    const count = state.participants.length;
    for (let step = 0; step < count; step++) {
        const player = state.participants[(startIndex + step) % count];
        if (test(player)) return player;
    }
    return null;
}

// Moves chips from a player's stack into the pot. Never goes below zero.
function putInPot(state, player, amount) {
    const paid = Math.max(0, Math.min(amount, player.chips));
    player.chips -= paid;
    state.potSize += paid;
    state.playerBets[player.refId] = (state.playerBets[player.refId] ?? 0) + paid;
    state.totalBets[player.refId] = (state.totalBets[player.refId] ?? 0) + paid;
    return paid;
}

/**
 * Starts a hand. `participants` is everyone at the table in seat order:
 * [{ refId, kind: 'user' | 'guest' | 'bot', displayName, chips, style? }].
 * `rotate` moves the blinds one seat each hand. Returns a new state.
 */
export function startHand({ participants, smallBlind, bigBlind, deck, rotate = 0 }) {
    const count = participants.length;
    if (count < 2) throw new GameRuleError('At least two players are required to start a game');

    const shift = ((rotate % count) + count) % count;
    const ordered = [...participants.slice(shift), ...participants.slice(0, shift)].map(p => ({
        refId: String(p.refId),
        kind: p.kind,
        displayName: p.displayName,
        chips: p.chips,
        style: p.style ?? null,
        folded: false,
        acted: false,
        drawn: false,
    }));

    const state = {
        round: 'betting1',
        participants: ordered,
        smallBlind,
        bigBlind,
        smallBlindPlayerId: ordered[0].refId,
        bigBlindPlayerId: ordered[1].refId,
        potSize: 0,
        currentBet: 0,
        currentTurn: null,
        playerBets: {},
        totalBets: {},
        raisesThisRound: 0,
        deck,
        discards: [],
        hands: dealCards(deck, ordered),
        winners: [],
        resultText: '',
        lastAction: null,
    };

    putInPot(state, ordered[0], smallBlind);
    putInPot(state, ordered[1], bigBlind);
    state.currentBet = Math.max(state.playerBets[ordered[0].refId], state.playerBets[ordered[1].refId]);

    // With two players the small blind acts first. With more, the seat after the big blind does.
    const first = firstFrom(state, 2 % count, canAct);
    if (first) state.currentTurn = first.refId;
    else settleRoundEnd(state); // everyone is already all-in from the blinds

    return state;
}

/** What the player whose turn it is may do right now. */
export function getLegalActions(state, refId) {
    const player = state.participants.find(p => p.refId === refId);
    const bettingRound = state.round === 'betting1' || state.round === 'betting2';
    if (!player || !bettingRound || state.currentTurn !== refId || !canAct(player)) {
        return { canAct: false };
    }

    const myBet = state.playerBets[refId] ?? 0;
    const toCall = Math.max(0, state.currentBet - myBet);
    const afterCall = player.chips - toCall;
    const canRaise = state.raisesThisRound < MAX_RAISES_PER_ROUND && afterCall >= state.bigBlind;

    return {
        canAct: true,
        toCall: Math.min(toCall, player.chips),
        canCheck: toCall === 0,
        canCall: toCall > 0,
        canRaise,
        minRaise: state.bigBlind,
        maxRaise: canRaise ? afterCall : 0, // biggest amount you can raise BY
        isAllInCall: toCall >= player.chips && toCall > 0,
    };
}

/**
 * Applies fold / check / call / raise for the player whose turn it is.
 * For 'raise', `amount` is how much to raise BY (on top of the call).
 */
export function applyBettingAction(state, refId, action) {
    if (state.round !== 'betting1' && state.round !== 'betting2') {
        throw new GameRuleError('Betting is not open right now');
    }
    const player = getPlayer(state, refId);
    if (state.currentTurn !== refId) throw new GameRuleError('It is not your turn');

    const legal = getLegalActions(state, refId);
    const type = action?.type;
    let amountPut = 0;

    if (type === 'fold') {
        player.folded = true;
    } else if (type === 'check') {
        if (!legal.canCheck) throw new GameRuleError('You cannot check, there is a bet to call');
    } else if (type === 'call') {
        if (!legal.canCall) throw new GameRuleError('There is nothing to call');
        amountPut = putInPot(state, player, legal.toCall);
    } else if (type === 'raise') {
        const by = action.amount;
        if (!Number.isInteger(by) || by < legal.minRaise) {
            throw new GameRuleError(`A raise must be at least $${legal.minRaise}`);
        }
        if (!legal.canRaise) throw new GameRuleError('You cannot raise right now');
        if (by > legal.maxRaise) throw new GameRuleError('You do not have enough chips for that raise');

        amountPut = putInPot(state, player, legal.toCall + by);
        state.currentBet = state.playerBets[refId];
        state.raisesThisRound += 1;
        // A raise gives everyone else another chance to respond
        for (const other of state.participants) if (other.refId !== refId) other.acted = false;
    } else {
        throw new GameRuleError('Unknown action');
    }

    player.acted = true;
    state.lastAction = { playerId: refId, type, amount: amountPut };
    afterBettingAction(state, player);
    return state;
}

function isBettingComplete(state) {
    const live = state.participants.filter(canAct);
    if (live.length === 0) return true;
    const matched = p => (state.playerBets[p.refId] ?? 0) >= state.currentBet;
    // Only one player can still bet and nobody is ahead of them: nothing left to decide
    if (live.length === 1 && matched(live[0])) return true;
    return live.every(p => p.acted && matched(p));
}

function afterBettingAction(state, actor) {
    const stillIn = state.participants.filter(isLive);
    if (stillIn.length === 1) {
        finishUncontested(state, stillIn[0]);
        return;
    }
    if (isBettingComplete(state)) {
        settleRoundEnd(state);
        return;
    }
    const next = findNext(state, indexOfPlayer(state, actor.refId), p => canAct(p) && (!p.acted || (state.playerBets[p.refId] ?? 0) < state.currentBet));
    state.currentTurn = next.refId;
}

// Betting is over: move on to the draw, or to the showdown after the second round
function settleRoundEnd(state) {
    state.playerBets = {};
    state.currentBet = 0;
    state.raisesThisRound = 0;
    for (const p of state.participants) p.acted = false;

    if (state.round === 'betting1') {
        state.round = 'drawing';
        const first = firstFrom(state, 0, p => isLive(p) && !p.drawn);
        state.currentTurn = first.refId;
    } else {
        showdown(state);
    }
}

/** The player whose turn it is replaces the cards at `discardIndexes` (0-4) from the deck. */
export function applyDraw(state, refId, discardIndexes) {
    if (state.round !== 'drawing') throw new GameRuleError('Drawing is not open right now');
    const player = getPlayer(state, refId);
    if (state.currentTurn !== refId) throw new GameRuleError('It is not your turn');

    const indexes = Array.isArray(discardIndexes) ? discardIndexes : [];
    const valid = indexes.every(i => Number.isInteger(i) && i >= 0 && i < 5);
    if (!valid || new Set(indexes).size !== indexes.length) throw new GameRuleError('Invalid cards selected');
    if (indexes.length > MAX_DISCARDS) throw new GameRuleError(`You can replace at most ${MAX_DISCARDS} cards`);

    const hand = state.hands[refId];
    if (indexes.length > 0) {
        // Draw first, so a card you throw away cannot come straight back to you
        if (state.deck.length < indexes.length) {
            state.deck = [...shuffleDeck(state.discards), ...state.deck];
            state.discards = [];
        }
        if (state.deck.length < indexes.length) throw new GameRuleError('Not enough cards left in the deck');
        const replacements = indexes.map(() => state.deck.pop());
        indexes.forEach((handIndex, i) => {
            state.discards.push(hand[handIndex]);
            hand[handIndex] = replacements[i];
        });
    }

    player.drawn = true;
    state.lastAction = { playerId: refId, type: 'draw', amount: indexes.length };

    const next = firstFrom(state, indexOfPlayer(state, refId) + 1, p => isLive(p) && !p.drawn);
    if (next) {
        state.currentTurn = next.refId;
        return state;
    }

    // Everyone has drawn: second betting round, starting from the small blind seat
    state.round = 'betting2';
    state.playerBets = {};
    state.currentBet = 0;
    state.raisesThisRound = 0;
    for (const p of state.participants) p.acted = false;
    const first = firstFrom(state, 0, canAct);
    if (first && state.participants.filter(canAct).length > 1) {
        state.currentTurn = first.refId;
    } else {
        // Nobody (or only one player) can still bet: straight to the showdown
        showdown(state);
    }
    return state;
}

// Everyone else folded, so the last player takes the pot without showing cards
function finishUncontested(state, winner) {
    const amount = state.potSize;
    winner.chips += amount;
    state.winners = [{ refId: winner.refId, amount, handName: null }];
    state.resultText = `${winner.displayName} wins $${amount}`;
    endHand(state);
}

function endHand(state) {
    state.round = 'finished';
    state.currentTurn = null;
    state.playerBets = {};
    state.currentBet = 0;
}

/**
 * Splits everything that was bet into a main pot and side pots, so a player who went
 * all-in can only win as much as they put in from each opponent.
 * Returns [{ amount, eligible: refId[] }].
 */
export function buildPots(totalBets, foldedIds) {
    const levels = [...new Set(Object.values(totalBets).filter(v => v > 0))].sort((a, b) => a - b);
    const pots = [];
    let previous = 0;
    for (const level of levels) {
        let amount = 0;
        const eligible = [];
        for (const [refId, total] of Object.entries(totalBets)) {
            amount += Math.max(0, Math.min(total, level) - previous);
            if (total >= level && !foldedIds.has(refId)) eligible.push(refId);
        }
        if (amount > 0 && eligible.length > 0) pots.push({ amount, eligible });
        else if (amount > 0 && pots.length > 0) pots[pots.length - 1].amount += amount; // dead money goes to the pot below
        previous = level;
    }
    return pots;
}

function showdown(state) {
    const contenders = state.participants.filter(isLive);
    const scores = {};
    for (const p of contenders) scores[p.refId] = evaluateHand(state.hands[p.refId]);

    const folded = new Set(state.participants.filter(p => p.folded).map(p => p.refId));
    const pots = buildPots(state.totalBets, folded);
    const won = {};

    for (const pot of pots) {
        let best = null;
        let winners = [];
        for (const refId of pot.eligible) {
            const comparison = best ? compareHands(scores[refId], best) : 1;
            if (comparison > 0) { best = scores[refId]; winners = [refId]; }
            else if (comparison === 0) winners.push(refId);
        }
        // Equal hands split the pot. Any odd chip goes to the first winner in seat order.
        const share = Math.floor(pot.amount / winners.length);
        let remainder = pot.amount - share * winners.length;
        for (const refId of winners) {
            won[refId] = (won[refId] ?? 0) + share + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder -= 1;
        }
    }

    state.winners = Object.entries(won).map(([refId, amount]) => ({ refId, amount, handName: scores[refId].name }));
    for (const w of state.winners) getPlayer(state, w.refId).chips += w.amount;

    const names = state.winners.map(w => getPlayer(state, w.refId).displayName);
    const top = state.winners.reduce((a, b) => (b.amount > a.amount ? b : a));
    state.resultText = state.winners.length === 1
        ? `${names[0]} wins $${top.amount} with ${top.handName}`
        : `${names.join(' and ')} split the pot (${top.handName})`;
    endHand(state);
}

/** Folds a player who left the table mid-hand, whatever the turn. */
export function forceFold(state, refId) {
    const player = state.participants.find(p => p.refId === refId);
    if (!player || player.folded || state.round === 'finished') return state;
    player.folded = true;

    const stillIn = state.participants.filter(isLive);
    if (stillIn.length === 1) {
        finishUncontested(state, stillIn[0]);
        return state;
    }
    if (state.currentTurn !== refId) return state;

    if (state.round === 'drawing') {
        const next = firstFrom(state, indexOfPlayer(state, refId) + 1, p => isLive(p) && !p.drawn);
        if (next) state.currentTurn = next.refId;
        else {
            // Everyone left has already drawn: treat it like the last draw finishing
            const last = stillIn[stillIn.length - 1];
            last.drawn = false;
            state.currentTurn = last.refId;
            applyDraw(state, last.refId, []);
        }
    } else {
        afterBettingAction(state, player);
    }
    return state;
}

/** What is safe to send to everyone at the table (no deck, no hidden cards). */
export function toPublicState(state) {
    const showCards = state.round === 'finished' && state.winners.some(w => w.handName);
    const revealed = {};
    if (showCards) {
        for (const p of state.participants) if (!p.folded) revealed[p.refId] = state.hands[p.refId];
    }
    return {
        round: state.round,
        smallBlind: state.smallBlind,
        bigBlind: state.bigBlind,
        smallBlindPlayerId: state.smallBlindPlayerId,
        bigBlindPlayerId: state.bigBlindPlayerId,
        potSize: state.potSize,
        currentBet: state.currentBet,
        currentTurn: state.currentTurn,
        playerBets: state.playerBets,
        participants: state.participants.map(p => ({
            refId: p.refId,
            kind: p.kind,
            displayName: p.displayName,
            isBot: p.kind === 'bot',
            chips: p.chips,
            folded: p.folded,
            drawn: p.drawn,
            allIn: !p.folded && p.chips === 0,
            bet: state.playerBets[p.refId] ?? 0,
        })),
        winners: state.winners,
        resultText: state.resultText,
        lastAction: state.lastAction,
        revealedHands: revealed,
    };
}