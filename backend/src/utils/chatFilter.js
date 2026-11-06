// M3: keeps chat clean. Whole words only, so "hello" and "class" are left alone.
export const MAX_MESSAGE_LENGTH = 200;

const BAD_WORDS = ['fuck', 'fucking', 'shit', 'bitch', 'bastard', 'damn', 'crap', 'ass', 'asshole', 'dick', 'piss', 'hell'];
const BAD_WORD_PATTERN = new RegExp(`\\b(${BAD_WORDS.join('|')})\\b`, 'gi');

// Returns the cleaned message and whether anything was replaced
export function filterMessage(text) {
    let filtered = false;
    const clean = text.replace(BAD_WORD_PATTERN, () => {
        filtered = true;
        return '***';
    });
    return { message: clean, filtered };
}
