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
    return await Table.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
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
        // P3: a spectator who takes a seat stops being a spectator
        { $push: { seats: seat }, $inc: { players: 1 }, $pull: { spectators: { refId: seat.refId } } },
        { returnDocument: 'after' }
    );
}

export async function removeSeat(id, player) {
    return await Table.findByIdAndUpdate(
    {
        _id: id,
        seats: {
            $eleMatch: {
                kind: player.kind,
                refId: player.refId
            }
        },
    },
    {
        $pull: {
            seats: {
                kind: player.kind,
                refId: player.refId
            }
        },
        $inc: {players: -1}
        },
        {returnDocument: 'after'}
    );
}
    

// P3: start watching. $addToSet-style check on refId so the same person isn't listed twice.
export async function addSpectator(id, spectator) {
    return await Table.findOneAndUpdate(
        { _id: id, 'spectators.refId': { $ne: spectator.refId } },
        { $push: { spectators: spectator } },
        { returnDocument: 'after' }
    );
}

// P3: stop watching
export async function removeSpectator(id, refId) {
    return await Table.findByIdAndUpdate(
        id,
        { $pull: { spectators: { refId } } },
        { returnDocument: 'after' }
    );
}
