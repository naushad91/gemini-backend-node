const prisma = require("../db");

async function rateLimit(req, res, next) {
  const user = req.user;

  // Pro users = no limit
  if (user.isPremium) return next();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.message.count({
    where: {
      room: {
      userId: user.id,   // check chatroom’s userId
    },
      sentAt: { gte: today },
    },
  });

  if (count >= 5) {
    return res.status(429).json({ error: "Daily limit reached. Upgrade to Pro for unlimited messages." });
  }

  next();
}

module.exports = rateLimit;
