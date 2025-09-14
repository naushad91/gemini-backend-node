const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../db");
const redis = require("../redis");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const authMiddleware = require("../middleware/auth");

const router = express.Router();



// send OTP endpoint
router.post("/send-otp", async (req, res) => {
    const { phone_no } = req.body;
    if (!phone_no) {
        return res.status(400).json({ error: "phone_no is required" });
    }

    const otp = Array.from({ length: 6 }, () => crypto.randomInt(0, 10)).join("");
    const hashedOtp = await bcrypt.hash(otp, 10);
    // store hashed in redis
    await redis.set(`otp:${phone_no}`, hashedOtp, "EX", 120); 
    res.json({ phone_no, otp });
});




// verify OTP endpoint also generting jwts 
router.post("/verify-otp", async (req, res) => {
    const { phone_no, otp } = req.body;
    if (!phone_no || !otp) return res.status(400).json({ error: "phone_no and otp are required" });

    const savedOtpHash = await redis.get(`otp:${phone_no}`);
    if (!savedOtpHash) return res.status(400).json({ error: "Invalid or expired OTP" });

    const isValid = await bcrypt.compare(otp, savedOtpHash);
    if (!isValid) return res.status(400).json({ error: "Invalid OTP" });

    // remove OTP to prevent reuse
    await redis.del(`otp:${phone_no}`);

   
    //   let user = await prisma.user.findUnique({ where: { phone_no } });
    //   if (!user) user = await prisma.user.create({ data: { phone_no } });
    const user = await prisma.user.upsert({
        where: { phone_no: phone_no },
        update: {},                // if user exists, don’t change anything
        create: { phone_no: phone_no }
    });

    // sign JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ access_token: token, token_type: "bearer" });
});

// get /me enpoint
router.get("/me", authMiddleware, async (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;