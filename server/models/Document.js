const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: [true, 'Room ID is required'],
    unique: true,
    index: true,
    trim: true
  },
  content: {
    type: String,
    default: '// Welcome to Real-Time Collaborative Code Editor!\n// Start typing to collaborate in real-time.\n\nfunction main() {\n  console.log("Hello, World!");\n}\n\nmain();\n'
  },
  language: {
    type: String,
    default: 'javascript',
    enum: ['javascript', 'python', 'java', 'cpp', 'html', 'css', 'json']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

documentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Document', documentSchema);
