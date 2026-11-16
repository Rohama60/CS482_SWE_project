import { auth } from '../Auth.js';
import Account from '../models/AccountModel.js';

export async function getAccountFromRequest(req) {
    const session = await auth.api.getSession({
        headers: new Headers(req.headers || {}),
    });

    if (!session?.user?.id) return null;
    return Account.findOne({ userId: session.user.id });
}

export async function requireAccount(req, res, next) {
    try {
        const account = await getAccountFromRequest(req);
        if (!account) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        req.account = account;
        return next();
    } catch (error) {
        console.error('Account authentication error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}
