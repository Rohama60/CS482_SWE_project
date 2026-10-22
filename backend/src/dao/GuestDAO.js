import Guest from '../models/GuestModel.js';

export async function createGuest(guestData) {
    const guest = new Guest(guestData);
    return await guest.save();
}

export async function findGuestById(id) {
    return await Guest.findById(id);
}
