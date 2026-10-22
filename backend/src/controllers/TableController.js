import { createTable, findAllTables, findTableById, deleteTable, updateTable, findTablesByHost } from '../dao/TableDAO.js';
import Account from '../models/AccountModel.js';
import {auth} from '../Auth.js';
const BLIND_BY_STAKE = { low: '1 / 2', medium: '5 / 10', high: '25 / 50' };

export async function CreateTableController(req, res) {
    const session = await auth.api.getSession({ 
        headers: new Headers(req.headers) });
    if (!session?.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const account = await Account.findOne({
        userId: session.user.id
    });

    if (!account) {
        return res.status(404).json({ error: 'Account not found' });
    }
    const { name, stakes, seats, bots = 0, isPrivate = false } = req.body;

    if (!name || !stakes || !seats) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!BLIND_BY_STAKE[stakes]) {
        return res.status(400).json({ error: 'Invalid stakes' });
    }
    if (!Number.isInteger(seats) || seats < 2 || seats > 6) {
        return res.status(400).json({ error: 'Seats must be between 2 and 6' });
    }
    // The host always keeps one seat
    if (!Number.isInteger(bots) || bots < 0 || bots > seats - 1) {
        return res.status(400).json({ error: `Bots must be between 0 and ${seats - 1}` });
    }

    const players = 1 + bots;

    const newTable = await createTable({
        name: name.trim(),
        stakes,
        blind: BLIND_BY_STAKE[stakes],   // set on the server, not trusted from the client
        max: seats,
        players,
        bots,
        status: bots === 0 ? 'waiting' : players >= seats ? 'full' : 'active',
        isPrivate,
        host: account._id      
    });

    return res.status(201).json({
        message: 'Table created',
        table: newTable
    });
}

export async function GetTablesController(req, res) {
    const { stakes } = req.query;
    const filter = { isPrivate: false };  // private tables stay out of the public lobby
    if (stakes && stakes !== 'all') filter.stakes = stakes;

    const tables = await findAllTables(filter);
    return res.status(200).json({ tables });
}

export async function GetTableByIdController(req, res) {
    const table = await findTableById(req.params.id);
    if (!table) {
        return res.status(404).json({ error: 'Table not found' });
    }
    return res.status(200).json({ table });
}
import mongoose from 'mongoose';

// Keep your existing imports for auth, Account,
// findTableById, and deleteTable.

export async function DeleteTableController(req, res) {
    try {
        const session = await auth.api.getSession({
            headers: new Headers(req.headers)
        });

        if (!session?.user) {
            return res.status(401).json({
                error: 'Unauthorized'
            });
        }

        const account = await Account.findOne({
            userId: session.user.id
        });

        if (!account) {
            return res.status(404).json({
                error: 'Account not found'
            });
        }

        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                error: 'Invalid table ID'
            });
        }

        const table = await findTableById(id);

        if (!table) {
            return res.status(404).json({
                error: 'Table not found'
            });
        }

        // Check if logged-in user owns the table
        if (String(table.host) !== String(account._id)) {
            return res.status(403).json({
                error: 'You can only delete tables you host'
            });
        }

        await deleteTable(id);

        return res.status(200).json({
            message: 'Table deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting table:', error);

        return res.status(500).json({
            error: 'Failed to delete table'
        });
    }
}

export async function UpdateTableController(req, res) {
    try {
        const { id } = req.params;
        const { name, stakes, max, bots, isPrivate } = req.body;

        const table = await findTableById(id);

        if (!table) {
            return res.status(404).json({
                error: 'Invalid table ID'
            });
        }

        const blindByStake = {
            low: '1 / 2',
            medium: '5 / 10',
            high: '25 / 50'
        };

        if (
            !['low', 'medium', 'high'].includes(stakes) ||
            !Number.isInteger(max) ||
            max < 2 ||
            max > 6 ||
            max < table.players ||
            !Number.isInteger(bots) ||
            bots < 0 ||
            bots >= max ||
            typeof name !== 'string' ||
            !name.trim() ||
            typeof isPrivate !== 'boolean'
        ) {
            return res.status(400).json({
                error: 'Invalid table settings'
            });
        }

        const updatedTable = await updateTable(id, {
            name: name.trim(),
            stakes,
            max,
            bots,
            isPrivate,
            blind: blindByStake[stakes]
        });

        return res.status(200).json({
            message: 'Table updated',
            table: updatedTable
        });

    } catch (error) {
        console.error('Update table error:', error);

        return res.status(500).json({
            error: 'Failed to update table'
        });
    }
}
export async function GetMyTablesController(req, res) {
    try {
        const session = await auth.api.getSession({
            headers: new Headers(req.headers)
        });

        if (!session?.user) {
            return res.status(401).json({
                error: 'Unauthorized'
            });
        }

        const account = await Account.findOne({
            userId: session.user.id
        });

        if (!account) {
            return res.status(404).json({
                error: 'Account not found'
            });
        }

        const tables = await findTablesByHost(account._id);

        return res.status(200).json({
            tables
        });

    } catch (error) {
        console.error('Error getting hosted tables:', error);

        return res.status(500).json({
            error: 'Failed to get hosted tables'
        });
    }
}
    