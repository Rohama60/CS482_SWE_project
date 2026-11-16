import {
    findTableById,
    removeSeat,
    updateTable,
    startTableGame,
} from '../dao/TableDAO.js'
import mongoose from 'mongoose';
import { getJoiningPlayer } from './JoinTableController.js';
import {
    createGameService,
    GameConflictError,
    GameNotFoundError,
} from '../services/GameService.js';
import { GameRuleError } from '../../game/PokerEngine.js';
import { getPlayerChips } from '../dao/ChipDAO.js';
import {
    createPokerGame,
    findPokerGameById,
    updatePokerGame,
    findLatestGameByTableId,
    runInTransaction,
    addChips,
    getChipBalance,
    finishTableGame,
} from '../dao/BotGameDAO.js';

let ioRef;
const service = createGameService({
    tableDao: { findTableById, startTableGame, finishTableGame },
    gameDao: {
        createPokerGame,
        findPokerGameById,
        updatePokerGame,
        findLatestGameByTableId,
        runInTransaction,
    },
    chipDao: { addChips, getChipBalance },
    emit: (tableId, event, payload) => {
        ioRef?.to(`table-${tableId}`).emit(event, payload);
    },
});

function sendGameError(res, error) {
    if (error instanceof GameConflictError) return res.status(409).json({ message: error.message });
    if (error instanceof GameNotFoundError) return res.status(404).json({ message: error.message });
    if (error instanceof GameRuleError) return res.status(400).json({ message: error.message });
    console.error('Poker game error:', error);
    return res.status(500).json({ message: 'Internal server error' });
}

export async function CreatePokerGameController(req, res) {
    try {
        ioRef = req.app.get('io');
        const { tableId } = req.body;
        if (!mongoose.isValidObjectId(tableId)) {
            return res.status(400).json({ message: 'Invalid table ID' });
        }

        const game = await service.startGame(tableId);
        const player = await getJoiningPlayer(req);
        const view = await service.viewFor(game, player);
        ioRef?.to(`table-${tableId}`).emit('game-started', { gameId: String(game._id), game: view });

        return res.status(201).json({ game: view });
    } catch (error) {
        return sendGameError(res, error);
    }
}

export async function GetPlayerHandController(req, res) {
    try {
        const { gameId } = req.params;

        if (!mongoose.isValidObjectId(gameId)) {
            return res.status(400).json({
                error: 'Invalid game ID'
            });
        }

        const player = await getJoiningPlayer(req);
       
        if (!player) {
            return res.status(401).json({
                error: 'Player not authenticated'
            });
        }

        const game = await service.load(gameId);
        const view = await service.viewFor(game, player);
        const cards = view.myHand;

        if (!cards) {
            return res.status(403).json({
                error: 'You are not a player in this game'
            });
        }

        return res.status(200).json({ cards });

    } 
    catch (error) {
        console.error('Error retrieving hand:', error);

        return res.status(500).json({
            error: 'Unable to retrieve cards'
        });
    }
}

    export async function LeaveTableController(req, res) {
        try {
            const { id } = req.params;
            if (!mongoose.isValidObjectId(id)) {
                return res.status(400).json({ error: 'Invalid table ID' });
            }

            const player = await getJoiningPlayer(req);
            
            if (!player) {
                return res.status(401).json({ error: 'Log in or play as a guest to leave a table' });
            }
            
            const table = await findTableById(id);
            
            if (!table) {
                return res.status(404).json({ error: 'Table not found' });
            }
            
            await service.leave(id, player);
            const updatedTable = await removeSeat(id, player);
            
            if (!updatedTable) {
                return res.status(400).json({ error: 'Player not found in table' });
            }
            
            const status = updatedTable.players >= updatedTable.max ? 'full' : 'active';
            const io = req.app.get('io');
            const finalTable = await updateTable(id, { status });
            io.to(`table-${id}`).emit('table-updated', finalTable);

            return res.status(200).json({ message: 'Left table', table: finalTable });
        }
        catch (error) {
            console.error('Error leaving table:', error);
            res.status(500).json({ message: 'Internal server error' });
        }

    }

export async function GetPlayerChipsController(req, res) {
    try {
        console.time('CHIPS AUTH');
        const player = await getJoiningPlayer(req);
        console.timeEnd('CHIPS AUTH');

        if (!player) {
            return res.status(401).json({
                error: 'Player not authenticated'
            });
        }

        console.time('CHIPS DB');
        const account = await getPlayerChips(player);
        console.timeEnd('CHIPS DB');

        if (!account) {
            return res.status(404).json({
                error: 'Player not found'
            });
        }

        return res.status(200).json({
            chipamount: account.chipamount
        });

    } catch (error) {
        console.error('Error fetching player chips:', error);

        return res.status(500).json({
            error: 'Unable to retrieve chip balance'
        });
    }
}