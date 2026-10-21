const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const Room = require('../models/Room');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

const ALLOWED_LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'html', 'css', 'json'];

// Helper to check room authorization
const checkRoomAccess = async (roomId, userId) => {
  const room = await Room.findOne({ roomId });
  if (!room) {
    return { error: 'Room not found', status: 404 };
  }

  const isOwner = room.owner.toString() === userId.toString();
  const isMember = room.members.some((m) => m.toString() === userId.toString());

  if (!isOwner && !isMember) {
    return { error: 'Unauthorized to access this room document', status: 403 };
  }

  return { room };
};

// GET /api/documents/:roomId - Retrieve document for a room
router.get('/:roomId', async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const access = await checkRoomAccess(roomId, req.user._id);
    if (access.error) {
      return res.status(access.status).json({ message: access.error });
    }

    let document = await Document.findOne({ roomId })
      .populate('updatedBy', 'name email');

    // If document doesn't exist yet, create default one
    if (!document) {
      document = await Document.create({
        roomId,
        content: `// Room: ${access.room.name}\n// Created by: ${req.user.name}\n\nconsole.log("Hello, World!");\n`,
        language: 'javascript',
        updatedBy: req.user._id
      });
    }

    return res.status(200).json({ document });
  } catch (error) {
    next(error);
  }
});

// PUT /api/documents/:roomId - Save code content and language
router.put('/:roomId', async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { content, language } = req.body;

    const access = await checkRoomAccess(roomId, req.user._id);
    if (access.error) {
      return res.status(access.status).json({ message: access.error });
    }

    if (language && !ALLOWED_LANGUAGES.includes(language)) {
      return res.status(400).json({
        message: `Invalid language. Allowed: ${ALLOWED_LANGUAGES.join(', ')}`
      });
    }

    let document = await Document.findOne({ roomId });

    if (!document) {
      document = new Document({
        roomId,
        content: typeof content === 'string' ? content : '',
        language: language || 'javascript',
        updatedBy: req.user._id
      });
    } else {
      if (typeof content === 'string') {
        document.content = content;
      }
      if (language) {
        document.language = language;
      }
      document.updatedBy = req.user._id;
    }

    await document.save();

    // Update Room updatedAt
    await Room.updateOne({ roomId }, { $set: { updatedAt: new Date() } });

    const populatedDoc = await Document.findById(document._id)
      .populate('updatedBy', 'name email');

    return res.status(200).json({
      message: 'Code saved successfully.',
      document: populatedDoc
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
