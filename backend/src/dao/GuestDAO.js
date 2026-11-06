import Guest from '../models/GuestModel.js';

export async function createGuest(guestData) {
    const guest = new Guest(guestData);
    return await guest.save();
}

export async function findGuestById(id) {
    return await Guest.findById(id);
}

// G2: a guest who made an account doesn't need their guest record anymore
export async function deleteGuest(id) {
    return await Guest.findByIdAndDelete(id);
}
