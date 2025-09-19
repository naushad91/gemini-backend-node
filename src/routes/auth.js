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
// ----------------- signup -----------------
router.post("/signup", async (req, res) => {
  const { phone_no, name, email, password } = req.body;

  // 1. Check all fields
  if (!phone_no || !name || !email || !password) {
    return res
      .status(400)
      .json({ error: "All fields (phone_no, name, email, password) are required" });
  }

  // 2. Validate phone number (10 digits)
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone_no)) {
    return res.status(400).json({ error: "Phone number must be 10 digits" });
  }

  // 3. Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  // 4. Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      error:
        "Password must be at least 6 characters long and include uppercase, lowercase, and a number",
    });
  }

  try {
    // 5. Check if phone_no already exists
    const existingPhone = await prisma.user.findUnique({ where: { phone_no } });
    if (existingPhone) {
      return res.status(409).json({ error: "Phone number already registered" });
    }

    // 6. Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // 7. Hash password & create user
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        phone_no,
        name,
        email,
        password_hash: hashedPassword,
      },
    });

    // Don’t return password_hash
    const { password_hash, ...safe } = user;
    res.status(201).json(safe);
  } catch (err) {
    console.error("signup error:", err);
    res.status(500).json({ error: "Signup failed, please try again later" });
  }
});

// ----------------- send-otp (pure OTP login) -----------------
// Requires only phone_no. Sends OTP if user exists.
router.post("/send-otp", async (req, res) => {
  const { phone_no } = req.body;
  if (!phone_no) {
    return res.status(400).json({ error: "phone_no is required" });
  }

  const user = await prisma.user.findUnique({ where: { phone_no } });

  // user not registered
  if (!user) {
    return res.status(404).json({ error: "mobile number not registered" });
  }

  // generate OTP
  const otp = generateOtp();
  await redis.set(`otp:login:${phone_no}`, otp, "EX", 120); // store OTP 2 minutes

  // return OTP in response (mocked for assignment)
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


module.exports = router;