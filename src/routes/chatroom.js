const express = require("express");
const prisma = require("../db");
const redis = require("../redis");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// ----------------- create chatroom -----------------
// Creates a new chatroom for the logged-in user
router.post("/", authMiddleware, async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: "chatroom title is required" });
  }

  try {
    const chatroom = await prisma.chatroom.create({
      data: {
        title,
        userId: req.user.id,
      },
    });

    // Invalidate cached list for this user
    await redis.del(`chatrooms:${req.user.id}`);

    res.status(201).json(chatroom);
  } catch (err) {
    console.error("create chatroom error:", err);
    res.status(500).json({ error: "could not create chatroom" });
  }
});

// ----------------- list chatrooms -----------------
// Returns all chatrooms for the logged-in user, with Redis caching
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `chatrooms:${userId}`;

  try {
    // 1. Try cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ fromCache: true, chatrooms: JSON.parse(cached) });
    }

    // 2. Fallback to DB
    const chatrooms = await prisma.chatroom.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // 3. Save to cache (TTL = 300s = 5min)
    await redis.set(cacheKey, JSON.stringify(chatrooms), "EX", 300);

    res.json({ fromCache: false, chatrooms });
  } catch (err) {
    console.error("get chatrooms error:", err);
    res.status(500).json({ error: "could not fetch chatrooms" });
  }
});

// ----------------- get chatroom details -----------------
// Returns details of one chatroom, including its messages
router.get("/:chatroomId", authMiddleware, async (req, res) => {
  const { chatroomId } = req.params;

  try {
    const chatroom = await prisma.chatroom.findUnique({
      where: { id: Number(chatroomId) },
      include: {
        messages: {
          orderBy: { sentAt: "asc" }, // oldest first
        },
      },
    });

    // Ensure this chatroom belongs to the logged-in user
    if (!chatroom || chatroom.userId !== req.user.id) {
      return res.status(403).json({ error: "not allowed to access this chatroom" });
    }

    res.json(chatroom);
  } catch (err) {
    console.error("get chatroom error:", err);
    res.status(500).json({ error: "could not fetch chatroom" });
  }
});

module.exports = router;
