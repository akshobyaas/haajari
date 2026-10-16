const { Schema, model } = require('mongoose');

const auditSchema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  entity: { type: String, required: true }, // 'attendance', 'student', ...
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  action: { type: String, required: true }, // 'update', 'delete', 'import'
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  from: Schema.Types.Mixed,
  to: Schema.Types.Mixed,
  reason: String,
  at: { type: Date, default: Date.now },
});

module.exports = model('AuditLog', auditSchema);
