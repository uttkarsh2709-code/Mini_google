const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    default: 'Untitled'
  },
  content: {
    type: String,
    default: ''
  },
  outgoing_links: {
    type: String,
    default: ''
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Full-text search index on title and content
pageSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Page', pageSchema);

