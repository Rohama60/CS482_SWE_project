import { createTable, findAllTables, findTableById } from '../dao/TableDAO.js';

const BLIND_BY_STAKE = { low: '1 / 2', medium: '5 / 10', high: '25 / 50' };

export async function CreateTableController(req, res) {
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
        host: req.user?.id ?? null       // only if you have auth middleware
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