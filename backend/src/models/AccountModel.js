import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    displayName: { type: String},
    chipamount: { type: Number, default: 500 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    avatarId: {
        type: String,
        enum: ['scarlet-ace', 'midnight-club', 'diamond-dealer', 'river-crown', 'gold-outlaw', 'royal-phantom', 'upload'],
        default: 'scarlet-ace'
    },
    ownedAvatars: {
        type: [String],
        enum: ['scarlet-ace', 'midnight-club', 'diamond-dealer', 'river-crown', 'gold-outlaw', 'royal-phantom'],
        default: ['scarlet-ace', 'midnight-club']
    },
    customAvatar: { type: String, select: false },
    role: { 
        type: String, 
        enum: ['player', 'admin'],
        default: 'player' }
    });



const Account = mongoose.model('Account', accountSchema);



export default Account;
