import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';

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
