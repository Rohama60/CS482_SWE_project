import Table from '../models/TableModel.js';

export async function createTable(tableData) {
    const table = new Table(tableData);
    return await table.save();
}

export async function findAllTables(filter = {}) {
    return await Table.find(filter).sort({ createdAt: -1 });
}


export async function findTableById(id) {
    return await Table.findById(id);
}

export async function deleteTable(id) {
    return await Table.findByIdAndDelete(id);
}

export async function updateTable(id, updateData) {
    return await Table.findByIdAndUpdate(id, updateData, { new: true });
}
export async function findTablesByHost(hostId) {
    return await Table.find({ host: hostId })
        .sort({ createdAt: -1 });
}
// P7: find a private table from the code the player typed
export async function findTableByInviteCode(inviteCode) {
    return await Table.findOne({ inviteCode });
}

// P7: adds a seat only if there is still room and the player isn't already seated.
// Doing the check and the update in one database call stops two people
// from grabbing the last seat at the same time. Returns null if it didn't fit.
export async function addSeatIfOpen(id, seat) {
    return await Table.findOneAndUpdate(
        {
            _id: id,
            $expr: { $lt: ['$players', '$max'] },
            'seats.refId': { $ne: seat.refId }
        },
        { $push: { seats: seat }, $inc: { players: 1 } },
        { returnDocument: 'after' }
    );
}
