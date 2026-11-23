import mongoose from 'mongoose';
import { auth, mongoClient } from '../Auth.js';
import Account from '../models/AccountModel.js';
import AuditLog from '../models/AuditLog.js';

async function setCredentialPassword(account, password) {
    const { hashPassword } = await import('better-auth/crypto');
    const hashedPassword = await hashPassword(password);
    const database = mongoClient.db(process.env.MONGODB_DB_NAME || 'poker');
    const result = await database.collection('account').updateOne(
        { userId: account.userId, providerId: 'credential' },
        { $set: { password: hashedPassword } },
    );
    return result.matchedCount > 0;
}

// Admin Authentication Middleware
export async function verifyAdmin(req, res, next) {
    try {
        const session = await auth.api.getSession({
            headers: new Headers(req.headers || {})
        });

        if (!session?.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const account = await Account.findOne({ userId: session.user.id });
        if (!account || account.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied: Administrator privileges required' });
        }
        
        req.adminAccount = account;
        next();
    } catch (error) {
        console.error('Admin verification error:', error);
        return res.status(500).json({ error: 'Internal server error during authorization' });
    }
}

// Get Users with Search & Sorting
export async function GetAdminUsersController(req, res) {
    try {
        const { search, sortBy = 'lastActive' } = req.query;
        let query = {};

        if (search) {
            query = {
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { displayName: { $regex: search, $options: 'i' } }
                ]
            };
        }
        const sortOrder = sortBy === 'balance' ? { balance: -1 } : { updatedAt: -1 };
        const users = await Account.find(query).sort(sortOrder);
        
        return res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users for admin:', error);
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
}

// Delete User & Create Audit Log
export async function DeleteAdminUserController(req, res) {
    try {
        const { id } = req.params;
  
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        if (String(req.adminAccount?._id) === id) {
            return res.status(400).json({ error: 'Cannot delete your own admin account' });
        }

        const targetAccount = await Account.findByIdAndDelete(id);
        if (!targetAccount) {
            return res.status(404).json({ error: 'User not found' });
        }

        await AuditLog.create({
            adminId: req.adminAccount._id,
            action: 'DELETE_USER',
            targetUserId: id,
            details: `Deleted user account ${targetAccount.email || targetAccount.username}`,
            status: 'Success'
        });

        return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ error: 'Failed to delete user' });
    }
}

export async function UpdateAdminPlayerController(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const account = await Account.findById(id);
        if (!account) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { chips, status, password } = req.body ?? {};
        const hasChips = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'chips');
        const hasStatus = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'status');
        const hasPassword = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'password');

        if (!hasChips && !hasStatus && !hasPassword) {
            return res.status(400).json({ error: 'Provide a player update' });
        }
        if (hasChips && (typeof chips !== 'number' || !Number.isFinite(chips) || chips < 0)) {
            return res.status(400).json({ error: 'Chip balance must be a non-negative number' });
        }
        if (hasStatus && status !== 'active' && status !== 'banned') {
            return res.status(400).json({ error: 'Status must be active or banned' });
        }
        if (hasPassword && (typeof password !== 'string' || password.length < 8)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        if (hasPassword) {
            if (!await setCredentialPassword(account, password)) {
                return res.status(404).json({ error: 'Credential account not found' });
            }
        }

        const changes = [];
        if (hasChips) {
            account.chipamount = Math.floor(chips);
            changes.push(`chip balance to ${account.chipamount}`);
        }
        if (hasStatus) {
            account.status = status;
            changes.push(`status to ${status}`);
        }
        if (changes.length) {
            await account.save();
            await AuditLog.create({
                adminId: req.adminAccount._id,
                action: 'UPDATE_PLAYER',
                targetUserId: account._id,
                details: `Updated ${account.email || account.username}: ${changes.join(', ')}`,
                status: 'Success',
            });
        }

        return res.status(200).json({ message: 'Player updated successfully' });
    } catch (error) {
        console.error('Error updating player:', error);
        return res.status(500).json({ error: 'Failed to update player' });
    }
}

export async function AdminPasswordResetController(req, res) {
    try {
        const targetUserId = String(req.body?.targetUserId ?? '').trim();
        const newPassword = req.body?.newPassword;
        if (!mongoose.isValidObjectId(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const account = await Account.findById(targetUserId);
        if (!account) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!await setCredentialPassword(account, newPassword)) {
            return res.status(404).json({ error: 'Credential account not found' });
        }

        return res.status(200).json({
            message: `Password updated for ${account.email || account.username}`,
        });
    } catch (error) {
        console.error('Error resetting player password:', error);
        return res.status(500).json({ error: 'Failed to reset player password' });
    }
}

// Update User Balance & Create Audit Log
export async function UpdateAdminUserBalanceController(req, res) {
    try {
        const { id } = req.params;
        const { balance } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        if (typeof balance !== 'number') {
            return res.status(400).json({ error: 'Invalid balance amount' });
        }

        const updatedAccount = await Account.findByIdAndUpdate(
            id,
            { balance },
            { new: true }
        );

        if (!updatedAccount) {
            return res.status(404).json({ error: 'User not found' });
        }

        await AuditLog.create({
            adminId: req.adminAccount._id,
            action: 'UPDATE_BALANCE',
            targetUserId: id,
            details: `Updated balance to $${balance} for ${updatedAccount.email || updatedAccount.username}`,
            status: 'Success'
        });

        return res.status(200).json(updatedAccount);
    } catch (error) {
        console.error('Error updating user balance:', error);
        return res.status(500).json({ error: 'Failed to update balance' });
    }
}
