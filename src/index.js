const express = require("express");
const prisma = require("./db");
const authRoutes = require("./routes/auth");
const chatroomRoutes = require("./routes/chatroom");
const userRoutes = require("./routes/user");
const subscriptionRoutes = require("./routes/subscription");
const { Worker } = require("bullmq");
const { GoogleGenerativeAI } = require("@google/generative-ai");

require("dotenv").config();

const app = express();

// 👇 Stripe webhook must use raw body
app.use(
  "/subscription/webhook/stripe",
  require("body-parser").raw({ type: "application/json" })
);

// 👇 For all other routes, use JSON
app.use(express.json());

app.use("/user", userRoutes);
app.use("/auth", authRoutes);
app.use("/chatroom", chatroomRoutes);
app.use("/subscription", subscriptionRoutes);

app.get("/", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json({ msg: "Gemini backend running...", users });
});

// Start API server
app.listen(8000, () => {
  console.log("🚀 Server running on http://localhost:8000");
});


// =========================
// ✅ Start BullMQ Worker inside same process
// =========================
const connection = { url: process.env.REDIS_URL };

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function callGemini(userMessage) {
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(userMessage);
  return result.response.text();
}

const worker = new Worker(
  "gemini-messages",
  async job => {
    const { chatroomId, content } = job.data;

    try {
      const botReply = await callGemini(content);

      await prisma.message.create({
        data: {
          who: "bot",
          content: botReply,
          roomId: chatroomId,
        },
      });

      console.log("🤖 Gemini replied:", botReply);
    } catch (err) {
      console.error("❌ Gemini API error:", err);

      await prisma.message.create({
        data: {
          who: "bot",
          content: "Sorry, Gemini could not respond right now.",
          roomId: chatroomId,
        },
      });
    }
  },
  { connection }
);

worker.on("completed", job => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err);
});
