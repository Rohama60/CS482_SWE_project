import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import Account from '../models/AccountModel.js';
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';

function toUserResponse(account) {
  return {
    id: String(account._id),
    username: account.username,
    displayName: account.displayName,
    email: account.email,
    chipamount: account.chipamount,
    wins: account.wins,
    losses: account.losses,
    role: account.role,
    status: account.status ?? 'active',
    updatedAt: account.updatedAt,
  };
}

// GET /api/users
// The directory is restricted to administrators. Regular players can read
// their own profile through /api/users/me.
export async function GetUsersController(req, res) {
  try {
    const { search = '', sortBy = 'lastActive' } = req.query;
    const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = escapedSearch
      ? {
          $or: [
            { username: { $regex: escapedSearch, $options: 'i' } },
            { email: { $regex: escapedSearch, $options: 'i' } },
            { displayName: { $regex: escapedSearch, $options: 'i' } },
          ],
        }
      : {};
    const sort = sortBy === 'balance' ? { chipamount: -1 } : { updatedAt: -1 };
    const users = await Account.find(query).sort(sort).limit(100);

    return res.status(200).json(users.map(toUserResponse));
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

// GET /api/users/me
export async function GetCurrentUserController(req, res) {
  try {
    return res.status(200).json({ user: toUserResponse(req.account) });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
}

// GET /api/users/:id
// Players may read their own profile; administrators may read any profile.
export async function GetUserByIdController(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const account = req.account;
    const isAdmin = account.role === 'admin';
    if (!isAdmin && String(account._id) !== String(req.params.id)) {
      return res.status(403).json({ error: 'You may only view your own profile' });
    }

    const requestedAccount = isAdmin
      ? await Account.findById(req.params.id)
      : account;
    if (!requestedAccount) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user: toUserResponse(requestedAccount) });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
}

// Implements the user story for Player Mute Music
export async function PlayerMuteMusicController(req, res) {
  const { userId, musicMuted } = req.body;

  if (!userId || musicMuted === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId, 
      { "settings.musicMuted": musicMuted }, 
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ success: true, musicMuted: user.settings.musicMuted });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Implements the user story for Player Complaint Form
export async function FileComplaintController(req, res) {
  const { reporterId, reportedUsername, reason, details } = req.body;

  if (!reporterId || !reportedUsername || !reason || !details) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const complaint = new Complaint({ reporterId, reportedUsername, reason, details });
    await complaint.save();

    return res.status(201).json({ success: true, message: 'Complaint submitted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Implements the user story for Member Password Reset
export async function SelfPasswordResetController(req, res) {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await User.findOneAndUpdate({ email }, { password: hashedPassword });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found with this email.' });
    }

    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Implements the user story for Admin Password Reset
export async function AdminPasswordResetController(req, res) {
  const { targetUserId, newPassword } = req.body;

  if (!targetUserId || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await User.findByIdAndUpdate(targetUserId, { password: hashedPassword });

    if (!user) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    return res.status(200).json({ success: true, message: 'Admin successfully reset user password.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
