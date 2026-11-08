import { APIError } from 'better-auth/api';
import mongoose from 'mongoose';
import { auth } from '../Auth.js';
import { findGuestById, deleteGuest } from '../dao/GuestDAO.js';
import { setAccountChips } from '../dao/AccountDAO.js';

// G2: when a guest signs up, move their chips to the new account and remove the guest.
// Returns the chips that were saved, or null if this wasn't a guest.
// If something goes wrong here, the account is still created, the chips just aren't moved.
export async function saveGuestChips(guestId, userId) {
    if (!guestId || !userId || !mongoose.isValidObjectId(guestId)) return null;
    try {
        const guest = await findGuestById(guestId);
        if (!guest) return null;
        await setAccountChips(userId, guest.chipamount);
        await deleteGuest(guestId);
        return guest.chipamount;
    } catch (error) {
        console.error('Could not move guest chips:', error);
        return null;
    }
}


export async function SignUpController(req, res){
    const { name, email, username, password, confirmPassword, guestId } = req.body || {};
    if(!name || !email || !username || !password || !confirmPassword){
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if(password !== confirmPassword){
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    try {
        // 
        const result = await auth.api.signUpEmail({
            body: { name, email, username, password, confirmPassword },
            headers: req.headers,
            returnHeaders: true,
        });

        result.headers?.forEach((value, key) => res.setHeader(key, value));

        // G2: a guest keeps their chips when they make an account
        const savedChips = await saveGuestChips(guestId, result.response?.user?.id);
        if (savedChips !== null) {
            return res.status(200).json({ ...result.response, savedChips });
        }
        return res.status(200).json(result.response);
    } catch (error) {
        if (error instanceof APIError) {
            return res.status(error.statusCode).json({
                error: error.message,
            });
        }

        console.error('Sign up failed:', error);
        return res.status(500).json({ error: 'Unable to create account' });
    }
}