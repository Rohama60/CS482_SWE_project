import mongoose from 'mongoose';

const pokerGameSchema = new mongoose.Schema({
    playerIds: [
        { type: mongoose.Schema.Types.ObjectId,
             ref: 'Player' }
            ],
    guestIds: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Guest'
        }],
        default: []
    }, 
        
    
    tableId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Table',
        required: true,
    },
    smallBlind: { type: Number, required: true },

    bigBlind: { type: Number, required: true },

    potSize: {type: Number, default: 0},

    round: {
        type: String,
        enum:
        ['waiting',
         'dealiing',
         'betting1',
         'drawing',
         'betting2',
         'showdown',
         'finished'
        ],
        default: 'waiting'
    }
});
export default mongoose.model('PokerGame', pokerGameSchema);