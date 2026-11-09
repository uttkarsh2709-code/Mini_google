const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  event_type: {
    type: String,
    enum: ['search', 'chat'],
    required: true
  },
  query: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    default: null
  },
  url: {
    type: String,
    default: null
  },
  response: {
    type: String,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('History', historySchema);

