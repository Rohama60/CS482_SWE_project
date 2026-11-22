import mongoose from 'mongoose';

const adClickStatSchema = new mongoose.Schema({
    adType: {
        type: String,
        enum: ['quick', 'feature', 'premium'],
        required: true,
        unique: true,
    },
    clicks: { type: Number, default: 0, min: 0 },
    lastClickedAt: { type: Date },
});

export default mongoose.model('AdClickStat', adClickStatSchema);
