import mongoose from 'mongoose';
import { createGuest, findGuestById } from '../dao/GuestDAO.js';

export const GUEST_STARTING_CHIPS = 500;

// Makes names like "Guest-4821"
export function makeGuestName() {
    const number = Math.floor(1000 + Math.random() * 9000);
    return `Guest-${number}`;
}

// POST /api/guests
// No login check on purpose: this is how someone plays without an account.
export async function CreateGuestController(req, res) {
    try {
        const guest = await createGuest({
            displayName: makeGuestName(),
            chipamount: GUEST_STARTING_CHIPS,
            role: 'guest',
        });

        return res.status(201).json({
            message: 'Guest created',
            guest
        });
    } catch (error) {
        console.error('Error creating guest:', error);
        return res.status(500).json({ error: 'Failed to create guest' });
    }
}

// GET /api/guests/:id
// Lets the frontend check the guest still exists (they expire after 24 hours).
export async function GetGuestByIdController(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid guest ID' });
        }

        const guest = await findGuestById(id);

        if (!guest) {
            return res.status(404).json({ error: 'Guest not found' });
        }

        return res.status(200).json({ guest });
    } catch (error) {
        console.error('Error getting guest:', error);
        return res.status(500).json({ error: 'Failed to get guest' });
    }
}
