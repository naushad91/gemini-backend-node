const prisma = require("../db");

async function rateLimit(req, res, next) {
  const user = req.user;

  // Safety: if no user found (authMiddleware missing/failed)
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: user not found" });
  }

  // Pro users = unlimited
  if (user.isPremium) return next();

  // Get today's start time (midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count how many messages user sent today
  const count = await prisma.message.count({
    where: {
      room: { userId: user.id },
      sentAt: { gte: today },
    },
  });

  if (count >= 5) {
    return res
      .status(429)
      .json({ error: "Daily limit reached. Upgrade to Pro for unlimited messages." });
  }

  next();
}

module.exports = rateLimit;
