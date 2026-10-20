import mongoose from 'mongoose';

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
}, { timestamps: true });

tableSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

const Table = mongoose.model('Table', tableSchema);

export default Table;

