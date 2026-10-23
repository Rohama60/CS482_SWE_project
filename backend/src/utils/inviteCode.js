// P7: short codes for private tables, like "K7Q2MX".
// Letters and numbers that are easy to confuse (0/O, 1/I/L) are left out.
const CHARACTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    }
    return code;
}

// Lets players type the code in lowercase or with extra spaces
export function normalizeInviteCode(code) {
    return typeof code === 'string' ? code.trim().toUpperCase() : '';
}
