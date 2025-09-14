const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../db");
const redis = require("../redis");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// helper: generate 6-digit OTP
function generateOtp() {
  return Array.from({ length: 6 }, () => crypto.randomInt(0, 10)).join("");
}

// ----------------- signup -----------------
// phone_no and password are required
router.post("/signup", async (req, res) => {
  const { phone_no, name, password } = req.body;
  if (!phone_no || !password) {
    return res.status(400).json({ error: "phone_no and password are required" });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { phone_no } });
    if (existing) {
      return res.status(409).json({ error: "user already exists" });
    }

    const createData = {
      phone_no,
      name: name ?? undefined,
      password_hash: await bcrypt.hash(password, 10), // always required
    };

    const user = await prisma.user.create({ data: createData });
    const { password_hash, ...safe } = user; // don’t return hash
    res.status(201).json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "signup failed" });
  }
});

// ----------------- send-otp (login page) -----------------
// Requires phone_no + password. If match, generate OTP.
router.post("/send-otp", async (req, res) => {
  const { phone_no, password } = req.body;
  if (!phone_no || !password) {
    return res.status(400).json({ error: "phone_no and password required" });
  }

  const user = await prisma.user.findUnique({ where: { phone_no } });

  // user not registered
  if (!user) {
    return res.status(404).json({ error: "mobile number not registered" });
  }

  // compare password
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "incorrect password" });
  }

  // generate OTP
  const otp = generateOtp();
  await redis.set(`otp:login:${phone_no}`, otp, "EX", 120); // store OTP 2 minutes

  // return OTP in response (mocked)
  return res.json({ phone_no, otp });
});


// ----------------- forgot-password -----------------
// If user forgets password, they can request an OTP to the registered mobile.
// We store the OTP under the same "login" key so verify-otp will work the same way.
router.post("/forgot-password", async (req, res) => {
  const { phone_no } = req.body;
  if (!phone_no) return res.status(400).json({ error: "phone_no required" });

  const user = await prisma.user.findUnique({ where: { phone_no } });
  if (!user) return res.status(404).json({ error: "user not found" });

  const otp = generateOtp();
  await redis.set(`otp:login:${phone_no}`, otp, "EX", 120);

  // mocked: return OTP in response
  res.json({ phone_no, otp });
});

// ----------------- verify-otp -----------------
// Verifies OTP (used after send-otp/login  or forgot-password).
// Verifies OTP for existing user and returns JWT.
router.post("/verify-otp", async (req, res) => {
  const { phone_no, otp } = req.body;
  if (!phone_no || !otp) {
    return res.status(400).json({ error: "phone_no and otp are required" });
  }

  const key = `otp:login:${phone_no}`;
  const saved = await redis.get(key);

  if (!saved || saved !== otp) {
    return res.status(400).json({ error: "invalid or expired otp" });
  }

  // consume OTP
  await redis.del(key);

  // find user (signup must have been done earlier)
  const user = await prisma.user.findUnique({ where: { phone_no } });
  if (!user) {
    return res.status(404).json({ error: "mobile number not registered" });
  }

  // generate JWT
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({ access_token: token, token_type: "bearer" });
});

// ----------------- change-password -----------------
// Allows logged-in user to set a new password (after OTP login)
router.post("/change-password", authMiddleware, async (req, res) => {
  const { new_password } = req.body;

  if (!new_password) {
    return res.status(400).json({ error: "new_password is required" });
  }

  try {
    const user = req.user;

    // Hash new password
    const newHash = await bcrypt.hash(new_password, 10);

    // Update DB
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newHash },
    });

    res.json({ ok: true, msg: "password changed successfully" });
  } catch (err) {
    console.error("change-password error:", err);
    res.status(500).json({ error: "could not change password" });
  }
});
// ----------------- me -----------------
router.get("/me", authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;