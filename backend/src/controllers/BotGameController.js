import mongoose from 'mongoose';
import { auth } from '../Auth.js';
import Account from '../models/AccountModel.js';
import { findTableById, startTableGame } from '../dao/TableDAO.js';
import { createPokerGame, findPokerGameById, updatePokerGame, findLatestGameByTableId, runInTransaction, addChips, getChipBalance, finishTableGame } from '../dao/BotGameDAO.js';
import { createGameService, GameConflictError, GameNotFoundError } from '../services/GameService.js';
import { GameRuleError } from '../../game/PokerEngine.js';
import { getJoiningPlayer } from './JoinTableController.js';

// Everything for playing against bots lives in this file, so PokerGameController.js is untouched.
let ioRef = null;
const service = createGameService({
    tableDao: { findTableById, startTableGame, finishTableGame },
    gameDao: { createPokerGame, findPokerGameById, updatePokerGame, findLatestGameByTableId, runInTransaction },
    chipDao: { addChips, getChipBalance },
    emit: (tableId, event, payload) => ioRef?.to(`table-${tableId}`).emit(event, payload),
});

function sendError(res, error) {
    if (error instanceof GameConflictError) return res.status(409).json({ message: error.message });
    if (error instanceof GameNotFoundError) return res.status(404).json({ message: error.message });
    if (error instanceof GameRuleError) return res.status(400).json({ message: error.message });
    console.error('Bot game error:', error);
    return res.status(500).json({ message: 'Internal server error' });
}

async function currentPlayer(req, res) {
    ioRef = req.app.get('io');
    const player = await getJoiningPlayer(req);
    if (!player) res.status(401).json({ message: 'Player not authenticated' });
    return player;
}

// Starts a hand. Bots at the table are dealt in and start playing on their own.
export async function CreateBotGameController(req, res) {
    try {
        ioRef = req.app.get('io');
        const { tableId } = req.body;
        if (!mongoose.isValidObjectId(tableId)) return res.status(400).json({ message: 'Invalid table ID' });
        const table = await findTableById(tableId);
        if (!table) return res.status(404).json({ message: 'Table not found' });
        const session = await auth.api.getSession({
            headers: new Headers({
                cookie: req.headers.cookie || ''
            })
        });

        const account = session?.user?.id
            ? await Account.findOne({ userId: session.user.id })
            : null;

        if (!account || String(table.host) !== String(account._id)) {
            return res.status(403).json({
                error: 'Only the host can start the game'
            });
        }
        // Only human players need to press Ready.
        // Bots are not included in table.seats.
        const otherPlayers = table.seats.filter(
            seat => !(
                seat.kind === 'user' &&
                String(seat.refId) === String(table.host)
            )
        );

        // Every other seated player must be ready.
        // If there are no other humans, bots can play immediately.
        const everyoneReady = otherPlayers.every(
            seat => seat.ready === true
        );

        // At least two participants are required, counting bots.
        const totalParticipants = table.seats.length + (table.bots ?? 0);

        if (totalParticipants < 2) {
            return res.status(403).json({
                message: 'At least two players are required to start'
            });
        }

        if (!everyoneReady) {
            return res.status(403).json({
                message: 'Waiting for other players to be ready'
            });
        }
        const game = await service.startGame(tableId);
        const player = await getJoiningPlayer(req);
        const view = await service.viewFor(game, player);

        ioRef?.to(`table-${tableId}`).emit('game-started', { gameId: String(game._id), game: { ...view, myHand: undefined, legal: undefined } });
        service.runBots(game._id);

        return res.status(201).json({ game: view, seats: table.seats || [] });
    } catch (error) { return sendError(res, error); }
}

// Bet: body { type: 'fold' | 'check' | 'call' | 'raise', amount? }
export async function BotGameActionController(req, res) {
    try {
        const player = await currentPlayer(req, res); if (!player) return;
        const { gameId } = req.params;
        if (!mongoose.isValidObjectId(gameId)) return res.status(400).json({ message: 'Invalid game ID' });
        const { type, amount } = req.body || {};
        const game = await service.act(gameId, player, { type, amount });
        service.runBots(gameId);
        return res.status(200).json({ game: await service.viewFor(game, player) });
    } catch (error) { return sendError(res, error); }
}

// Draw: body { discard: [0..4] } (empty list = stand pat)
export async function BotGameDrawController(req, res) {
    try {
        const player = await currentPlayer(req, res); if (!player) return;
        const { gameId } = req.params;
        if (!mongoose.isValidObjectId(gameId)) return res.status(400).json({ message: 'Invalid game ID' });
        const discard = req.body?.discard;
        if (discard !== undefined && !Array.isArray(discard)) {
            return res.status(400).json({ message: 'Discard must be an array of card indexes' });
        }
        const game = await service.draw(gameId, player, discard ?? []);
        service.runBots(gameId);
        return res.status(200).json({ game: await service.viewFor(game, player) });
    } catch (error) { return sendError(res, error); }
}

export async function GetBotGameController(req, res) {
    try {
        ioRef = req.app.get('io');
        const { gameId } = req.params;
        if (!mongoose.isValidObjectId(gameId)) return res.status(400).json({ message: 'Invalid game ID' });
        const player = await getJoiningPlayer(req);
        const game = await service.load(gameId);
        service.runBots(gameId); // restarts bots if the server restarted mid-hand
        return res.status(200).json({ game: await service.viewFor(game, player) });
    } catch (error) { return sendError(res, error); }
}

// Latest hand at a table (so a refresh brings you back to it)
export async function GetTableBotGameController(req, res) {
    try {
        ioRef = req.app.get('io');
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid table ID' });
        const player = await getJoiningPlayer(req);
        const latest = await service.findLatest(id);
        if (!latest?.engine) return res.status(404).json({ message: 'No game at this table yet' });
        service.runBots(latest._id);
        return res.status(200).json({ game: await service.viewFor(latest, player) });
    } catch (error) { return sendError(res, error); }
}

// Runs BEFORE the existing leave controller: folds the leaving player out of a running
// hand, then hands over to the normal leave code with next().
export async function FoldBotGamePlayerOnLeave(req, res, next) {
    try {
        ioRef = req.app.get('io');
        const { id } = req.params;
        if (mongoose.isValidObjectId(id)) {
            const player = await getJoiningPlayer(req);
            if (player) await service.leave(id, player);
        }
    } catch (error) {
        console.error('Could not fold leaving player:', error);
    }
    next();
}