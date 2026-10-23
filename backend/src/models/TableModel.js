import mongoose from 'mongoose';

// P7: who is sitting at the table. A seat can belong to a logged-in user or a guest.
const seatSchema = new mongoose.Schema({
    kind: { type: String, enum: ['user', 'guest'], required: true },
    refId: { type: String, required: true },
    displayName: { type: String, default: 'Player' },
}, { _id: false });

const tableSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 28},
    stakes: { type: String, enum: ['low', 'medium', 'high'], required: true },
    blind: { type: String, required: true },
    max: { type: Number, required: true, min: 2, max: 6 },
    players: {type: Number, default:1},
    bots: {type:Number, default:0},
    status: {type: String, enum: ['waiting', 'active', 'full'], defult: 'waiting'},
    avgPot: { type: String, default: '-' },
    hands: { type: Number, default: 0 },
    isPrivate: { type: Boolean, default: false },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    seats: { type: [seatSchema], default: [] },
    // P3: people watching without a seat. They don't count toward max players.
    spectators: { type: [seatSchema], default: [] },
    inviteCode: { type: String, default: null, index: true },
}, { timestamps: true });

tableSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.inviteCode; // only the host should see the code
        return ret;
    }
});

const Table = mongoose.model('Table', tableSchema);

export default Table;

