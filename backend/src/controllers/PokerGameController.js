

import {findTableById, removeSeat, updateTable } from '../dao/TableDAO.js'
import {createPokerGame } from '../dao/PokerGameDAO.js'
import mongoose from 'mongoose';
import { getJoiningPlayer } from './JoinTableController.js';
import { createDeck, shuffleDeck, dealCards } from '../../game/PlayingCards.js';
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
        }console.log('Table ID:', table._id);
            console.log('All seats:', table.seats);
            console.log('Registered players:', playerIds);
            console.log('Guests:', guestIds);
        const deck = shuffleDeck(createDeck())

        const hands = dealCards(deck, table.seats || []);

        console.log('Cards dealt to:', Object.keys(hands));
        console.log('Cards remaining in deck:', deck.length);


        const game = await createPokerGame({
            tableId: table._id,
            playerIds,
            guestIds,
            smallBlind: blinds.small,
            bigBlind: blinds.big,
            potSize: 0,
            round: 'dealing',
            deck,
            hands
        });

            return res.status(201).json({
            game: {
                _id: game._id,
                tableId: game.tableId,
                playerIds: game.playerIds,
                guestIds: game.guestIds,
                smallBlind: game.smallBlind,
                bigBlind: game.bigBlind,
                potSize: game.potSize,
                round: game.round
            },
            seats: table.seats || []
        });
    }
    catch(error){
        console.error('Error creating poker game:', error);
        res.status(500).json({message: 'Internal server error'});
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