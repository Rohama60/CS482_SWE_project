export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck() {
    const deck = [];
    for(const suit of SUITS){
        for(const ranks of Ranks){
            deck.push({suit, rank});
        }
    }
    return deck;
}



export function shuffleDeck(deck) {
    const shuffledDeck = [...deck];
    for( let i = deck.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
    }
    return shuffledDeck;
}