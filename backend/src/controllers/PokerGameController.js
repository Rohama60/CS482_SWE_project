

import {findTableById, removeSeat, updateTable, startTableGame } from '../dao/TableDAO.js'
import {createPokerGame, findPokerGameById } from '../dao/PokerGameDAO.js'
import mongoose from 'mongoose';
import { getJoiningPlayer } from './JoinTableController.js';
import { createDeck, shuffleDeck, dealCards } from '../../game/PlayingCards.js';
import { deductChips } from '../dao/ChipDAO.js';

class GameAlreadyStartedError extends Error {}

const BLIND_BY_STAKE = {
    low: {small: 1, big: 2},
    medium: {small: 5, big: 10},
    high: {small: 25, big: 50}
}
// Controller to create a new poker game
    export async function CreatePokerGameController(req, res) {
    try{
        // Grab the tableId from the request body
        const { tableId } = req.body;
        
        // Find the table associated with the provided tableID
        const table = await findTableById(tableId);
        
        if(!table){
            return res.status(404).json({message: 'Table not found'});
        }
        console.log('TABLE NAME:', table.name);


        console.log('TABLE ID:', table._id);
        console.log('TABLE SEATS:', JSON.stringify(table.seats, null, 2));
        console.log('NUMBER OF PLAYERS:', table.players);
       
        const playerIds = (table.seats || [])
            .filter(seat => seat.kind === 'user')
            .map(seat => seat.refId);

        const guestIds = (table.seats || [])
            .filter(seat => seat.kind === 'guest')
            .map(seat => seat.refId);

    
        const blinds = BLIND_BY_STAKE[table.stakes];
        
        if(!blinds){
            return res.status(400).json({message: 'Invalid stakes'});
        }
        const seats = table.seats || [];

        // Require at least two players
        if (seats.length < 2) {
            return res.status(400).json({
                message: 'At least two players are required to start a game'
            });
        }

        // Assign blinds based on seating order (initial two-player version)
        const smallBlindPlayer = seats[0];
        const bigBlindPlayer = seats[1];

        // Record how much each player contributes
        const playerBets = {
            [String(smallBlindPlayer.refId)]: blinds.small,
            [String(bigBlindPlayer.refId)]: blinds.big
        };

        // Calculate the initial pot
        const initialPot = blinds.small + blinds.big;    
        
        console.log('Table ID:', table._id);
            console.log('All seats:', table.seats);
            console.log('Registered players:', playerIds);
            console.log('Guests:', guestIds);
        
            const deck = shuffleDeck(createDeck())

        const hands = dealCards(deck, table.seats || []);

        console.log('Cards dealt to:', Object.keys(hands));
        console.log('Cards remaining in deck:', deck.length);


       
// Start a MongoDB session for the transaction
const session = await mongoose.startSession();

let game;

try {
    await session.withTransaction(async () => {

        // Claim the table before deducting chips
    const claimedTable = await startTableGame(tableId, session);

    if (!claimedTable) {
        throw new GameAlreadyStartedError('A game is already in progress at this table');
    }

    // Deduct small blind from the first player
    const smallBlindResult = await deductChips(
        smallBlindPlayer,
        blinds.small,
        session
    );

    if (!smallBlindResult) {
        throw new Error('Small blind player has insufficient chips');
    }

    // Deduct big blind from the second player
    const bigBlindResult = await deductChips(
        bigBlindPlayer,
        blinds.big,
        session
    );

    if (!bigBlindResult) {
        throw new Error('Big blind player has insufficient chips');
    }


        // Create the poker game after deducting blinds
        game = await createPokerGame({
            tableId: table._id,
            playerIds,
            guestIds,

            smallBlind: blinds.small,
            bigBlind: blinds.big,

            smallBlindPlayerId: String(smallBlindPlayer.refId),
            bigBlindPlayerId: String(bigBlindPlayer.refId),

            currentBet: blinds.big,
            currentTurn: String(smallBlindPlayer.refId),
            playerBets,

            potSize: initialPot,
            round: 'betting1',

            deck,
            hands
        }, session);

            });
        } finally {
            await session.endSession();
        }        const io = req.app.get('io');

        io.to(`table-${tableId}`).emit('game-started', {
            gameId: String(game._id),
            game: {
                _id: String(game._id),
                smallBlind: game.smallBlind,
                bigBlind: game.bigBlind,
                smallBlindPlayerId: game.smallBlindPlayerId,
                bigBlindPlayerId: game.bigBlindPlayerId,
                currentBet: game.currentBet,
                currentTurn: game.currentTurn,
                playerBets: Object.fromEntries(game.playerBets),
                potSize: game.potSize,
                round: game.round
            }
        });

        return res.status(201).json({
            game: {
                _id: game._id,
                tableId: game.tableId,
                playerIds: game.playerIds,
                guestIds: game.guestIds,
                smallBlind: game.smallBlind,
                bigBlind: game.bigBlind,
                smallBlindPlayerId: game.smallBlindPlayerId,
                bigBlindPlayerId: game.bigBlindPlayerId,
                currentBet: game.currentBet,
                currentTurn: game.currentTurn,
                playerBets: game.playerBets,
                potSize: game.potSize,
                round: game.round
            },
            seats: table.seats || []
        });
}
    catch(error){
        console.error('Error creating poker game:', error);
         if (error instanceof GameAlreadyStartedError) {
                return res.status(409).json({
                    message: error.message
                });
            }

            return res.status(500).json({
                message: 'Internal server error'
            });
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

        const game = await findPokerGameById(gameId);

        if (!game) {
            return res.status(404).json({
                error: 'Game not found'
            });
        }
       
        // Only return the hand belonging to this player.
        const cards = game.hands?.get(String(player.refId));

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