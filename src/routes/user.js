const express = require("express");
const prisma = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// ----------------- GET /user/me -----------------
// Returns current logged-in user's info
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        phone_no: true,
        name: true,
        isPremium: true,
        joinedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("get /me error:", err);
    res.status(500).json({ error: "could not fetch user" });
  }
});

module.exports = router;
