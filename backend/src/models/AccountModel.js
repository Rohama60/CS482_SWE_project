import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    displayName: { type: String},
    chipamount: { type: Number, default: 500 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    role: { type: String, default: 'player' }
    });



const Account = mongoose.model('Account', accountSchema);



export default Account;
