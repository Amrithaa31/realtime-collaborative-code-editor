const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Room = require('../models/Room');
const Document = require('../models/Document');
const authMiddleware = require('../middleware/authMiddleware');

// Protect all room endpoints
router.use(authMiddleware);

// Generate human-friendly unique room code (e.g. rm-7d8a-9f2b)
const generateRoomId = () => {
  const part1 = crypto.randomBytes(2).toString('hex');
  const part2 = crypto.randomBytes(2).toString('hex');
  return `room-${part1}-${part2}`;
};

// POST /api/rooms - Create a new room
router.post('/', async (req, res, next) => {
  try {
    const { name, language = 'javascript' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Room name is required.' });
    }

    const roomId = generateRoomId();

    const room = await Room.create({
      name: name.trim(),
      roomId,
      owner: req.user._id,
      members: [req.user._id]
    });

    // Create default initial document for this room
    await Document.create({
      roomId: room.roomId,
      language: language,
      content: `// Room: ${room.name}\n// Created by: ${req.user.name}\n\nfunction main() {\n  console.log("Welcome to ${room.name}!");\n}\n\nmain();\n`,
      updatedBy: req.user._id
    });

    const populatedRoom = await Room.findById(room._id)
      .populate('owner', 'name email')
      .populate('members', 'name email');

    return res.status(201).json({
      message: 'Room created successfully.',
      room: populatedRoom
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms - List all rooms where the current user is owner or member
router.get('/', async (req, res, next) => {
  try {
    const rooms = await Room.find({
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    })
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .sort({ updatedAt: -1 });

    return res.status(200).json({ rooms });
  } catch (error) {
    next(error);
  }
});

// GET /api/rooms/:roomId - Get a specific room's metadata
router.get('/:roomId', async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId })
      .populate('owner', 'name email')
      .populate('members', 'name email');

    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    // Check if user is an authorized member or owner
    const isOwner = room.owner._id.toString() === req.user._id.toString();
    const isMember = room.members.some(
      (m) => m._id.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      return res.status(403).json({
        message: 'You are not a member of this room. Please join using the room ID from your dashboard.'
      });
    }

    return res.status(200).json({ room });
  } catch (error) {
    next(error);
  }
});

// POST /api/rooms/:roomId/join - Join an existing room using roomId
router.post('/:roomId/join', async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room with this ID does not exist.' });
    }

    const alreadyMember = room.members.some(
      (m) => m.toString() === req.user._id.toString()
    );

    if (!alreadyMember) {
      room.members.push(req.user._id);
      await room.save();
    }

    const updatedRoom = await Room.findById(room._id)
      .populate('owner', 'name email')
      .populate('members', 'name email');

    return res.status(200).json({
      message: 'Joined room successfully.',
      room: updatedRoom
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/rooms/:roomId/leave - Leave a room
router.post('/:roomId/leave', async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    if (room.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message: 'Room owners cannot leave their own room. You can delete the room instead.'
      });
    }

    room.members = room.members.filter(
      (m) => m.toString() !== req.user._id.toString()
    );
    await room.save();

    return res.status(200).json({ message: 'Left room successfully.' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/rooms/:roomId - Delete room (owner only)
router.delete('/:roomId', async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    if (room.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Only the room owner has permission to delete this room.'
      });
    }

    await Room.deleteOne({ _id: room._id });
    await Document.deleteMany({ roomId: room.roomId });

    return res.status(200).json({ message: 'Room and its documents deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
