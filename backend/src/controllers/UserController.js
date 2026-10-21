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
