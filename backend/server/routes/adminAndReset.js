import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const router = Router();

function getModel(candidates) {
    for (const name of candidates) {
        if (mongoose.models[name]) return mongoose.models[name];
    }
    return null;
}

const UserModel = getModel(['User', 'Player', 'users', 'players']);
const AccountModel = getModel(['Account', 'account', 'accounts']);
const SessionModel = getModel(['Session', 'session', 'sessions']);

async function hashForAuth(plainPassword) {
    try {
        const cryptoMod = await import('better-auth/crypto');
        if (typeof cryptoMod.hashPassword === 'function') {
            return await cryptoMod.hashPassword(plainPassword);
        }
    } catch {
        // Fall back to bcryptjs if better-auth/crypto is unavailable
    }
    return await bcrypt.hash(plainPassword, 10);
}

function getAuthUser(req) {
    return req.user ?? req.authUser ?? req.session?.user ?? null;
}

function isValidAccountId(id) {
    if (typeof id !== 'string' || !id.trim()) return false;
    return mongoose.Types.ObjectId.isValid(id) || /^[a-zA-Z0-9_-]{6,128}$/.test(id);
}

function verifyAdmin(req, res, next) {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const role = String(user?.role ?? '').toLowerCase();
    if (role !== 'admin' && user?.isAdmin !== true) {
        return res.status(403).json({ error: 'Admin privileges required' });
    }

    req.currentUser = user;
    return next();
}

async function writePassword(userDoc, plainPassword) {
    const hashed = await hashForAuth(plainPassword);

    if (userDoc) {
        if ('password' in userDoc) userDoc.password = hashed;
        if ('passwordHash' in userDoc) userDoc.passwordHash = hashed;
        await userDoc.save();
    }

    if (AccountModel && userDoc?._id) {
        const idStr = String(userDoc._id);
        const account = await AccountModel.findOne({
            $and: [
                { $or: [{ userId: userDoc._id }, { userId: idStr }] },
                { $or: [{ providerId: 'credential' }, { provider: 'credential' }, { accountId: userDoc.email }] },
            ],
        });
        if (account) {
            account.password = hashed;
            await account.save();
        }
    }
}

function formatUser(doc) {
    return {
        id: String(doc._id),
        name: doc.name ?? doc.displayName ?? doc.username ?? 'Player',
        email: doc.email ?? '',
        role: doc.role ?? 'member',
        chips: Number(doc.chips ?? doc.balance ?? 0),
        gamesPlayed: Number(doc.gamesPlayed ?? doc.handsPlayed ?? doc.gamesCount ?? 0),
        lastActiveAt: doc.lastActiveAt ?? doc.updatedAt ?? doc.createdAt ?? null,
    };
}

async function MemberPasswordResetController(req, res) {
    try {
        if (!UserModel) return res.status(500).json({ error: 'User model not registered' });

        const email = String(req.body?.email ?? '').trim().toLowerCase();
        const newPassword = String(req.body?.newPassword ?? '');
        if (!email || newPassword.length < 8) {
            return res.status(400).json({ error: 'Valid email and 8+ character password required' });
        }

        const user = await UserModel.findOne({ email });
        if (!user) return res.status(404).json({ error: 'Account not found' });

        await writePassword(user, newPassword);
        return res.json({ ok: true, message: 'Password reset successful' });
    } catch (err) {
        console.error('POST /reset-password error:', err);
        return res.status(500).json({ error: 'Could not reset password' });
    }
}

async function AdminPasswordResetController(req, res) {
    try {
        if (!UserModel) return res.status(500).json({ error: 'User model not registered' });

        const targetUserId = String(req.body?.targetUserId ?? req.body?.userId ?? '').trim();
        const newPassword = String(req.body?.newPassword ?? '');
        if (!targetUserId || newPassword.length < 8) {
            return res.status(400).json({ error: 'Target user and 8+ character password required' });
        }
        if (!isValidAccountId(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const user = mongoose.Types.ObjectId.isValid(targetUserId)
            ? await UserModel.findById(targetUserId)
            : await UserModel.findOne({ $or: [{ _id: targetUserId }, { id: targetUserId }] });
        if (!user) return res.status(404).json({ error: 'User not found' });

        await writePassword(user, newPassword);
        return res.json({ ok: true, message: `Password updated for ${user.email || user.name || targetUserId}` });
    } catch (err) {
        console.error('POST /admin/reset-password error:', err);
        return res.status(500).json({ error: 'Could not update user password' });
    }
}

async function GetAdminUsersController(req, res) {
    try {
        if (!UserModel) return res.status(500).json({ error: 'User model not registered' });

        const search = String(req.query.search ?? '').trim();
        const sort = String(req.query.sort ?? 'frequent');

        const filter = search
            ? {
                  $or: [
                      { name: { $regex: search, $options: 'i' } },
                      { email: { $regex: search, $options: 'i' } },
                  ],
              }
            : {};

        const sortSpec =
            sort === 'recent'
                ? { lastActiveAt: -1, updatedAt: -1, createdAt: -1 }
                : { gamesPlayed: -1, handsPlayed: -1, lastActiveAt: -1 };

        const docs = await UserModel.find(filter)
            .select('-password -passwordHash')
            .sort(sortSpec)
            .lean();

        return res.json({ users: docs.map(formatUser) });
    } catch (err) {
        console.error('GET /admin/users error:', err);
        return res.status(500).json({ error: 'Could not load users' });
    }
}

async function UpdateAdminUserBalanceController(req, res) {
    try {
        if (!UserModel) return res.status(500).json({ error: 'User model not registered' });

        const userId = String(req.params.id ?? req.params.userId ?? '');
        if (!isValidAccountId(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const user = mongoose.Types.ObjectId.isValid(userId)
            ? await UserModel.findById(userId)
            : await UserModel.findOne({ $or: [{ _id: userId }, { id: userId }] });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const currentChips = Number(user.chips ?? user.balance ?? 0);
        let nextChips = currentChips;

        if (typeof req.body?.balance === 'number' && Number.isFinite(req.body.balance)) {
            if (req.body.balance < 0) return res.status(400).json({ error: 'Balance cannot be negative' });
            nextChips = Math.floor(req.body.balance);
        } else if (typeof req.body?.delta === 'number' && Number.isFinite(req.body.delta)) {
            nextChips = currentChips + Math.trunc(req.body.delta);
            if (nextChips < 0) return res.status(400).json({ error: 'Balance cannot go below 0' });
        } else {
            return res.status(400).json({ error: 'Provide a valid numeric balance or delta' });
        }

        user.chips = nextChips;
        if ('balance' in user) user.balance = nextChips;
        await user.save();

        return res.json({ user: formatUser(user) });
    } catch (err) {
        console.error('PATCH /admin/users/:id/balance error:', err);
        return res.status(500).json({ error: 'Could not update balance' });
    }
}

async function DeleteAdminUserController(req, res) {
    try {
        if (!UserModel) return res.status(500).json({ error: 'User model not registered' });

        const userId = String(req.params.id ?? req.params.userId ?? '');
        if (!isValidAccountId(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const actingId = String(req.currentUser?.id ?? req.currentUser?._id ?? '');
        if (actingId && actingId === userId) {
            return res.status(400).json({ error: 'Cannot delete your own active account' });
        }

        const deleted = mongoose.Types.ObjectId.isValid(userId)
            ? await UserModel.findByIdAndDelete(userId)
            : await UserModel.findOneAndDelete({ $or: [{ _id: userId }, { id: userId }] });
        if (!deleted) return res.status(404).json({ error: 'User not found' });

        if (AccountModel) {
            await AccountModel.deleteMany({ $or: [{ userId: deleted._id }, { userId: String(deleted._id) }] }).catch(() => {});
        }
        if (SessionModel) {
            await SessionModel.deleteMany({ $or: [{ userId: deleted._id }, { userId: String(deleted._id) }] }).catch(() => {});
        }

        return res.json({ ok: true, deletedUserId: userId });
    } catch (err) {
        console.error('DELETE /admin/users/:id error:', err);
        return res.status(500).json({ error: 'Could not delete user' });
    }
}

router.post('/auth/reset-password', MemberPasswordResetController);
router.post('/admin/reset-password', verifyAdmin, AdminPasswordResetController);
router.get('/admin/users', verifyAdmin, GetAdminUsersController);
router.patch('/admin/users/:id/balance', verifyAdmin, UpdateAdminUserBalanceController);
router.delete('/admin/users/:id', verifyAdmin, DeleteAdminUserController);

export default router;
