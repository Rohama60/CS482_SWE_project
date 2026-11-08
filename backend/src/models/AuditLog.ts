import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  details: { type: String, required: true },
  status: { type: String, enum: ['Success', 'Failed'], default: 'Success' }
}, { timestamps: true });

export default mongoose.model('AuditLog', auditLogSchema);
