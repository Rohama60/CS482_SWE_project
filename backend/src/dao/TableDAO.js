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