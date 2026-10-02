const mongoose = require('mongoose');

const sequenceSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, min: 0, default: 0 }
}, { versionKey: false });

module.exports = mongoose.models.Sequence || mongoose.model('Sequence', sequenceSchema);
