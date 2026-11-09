import mongoose from 'mongoose';
import { auth } from '../Auth.js';
import Account from '../models/AccountModel.js';
import AuditLog from '../models/AuditLog.js';

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
