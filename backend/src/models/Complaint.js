import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUsername: { type: String, required: true },
  reason: { type: String, required: true },
  details: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Reviewed', 'Resolved'], default: 'Pending' }
}, { timestamps: true });

export default mongoose.model('Complaint', complaintSchema);
