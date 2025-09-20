const { Worker } = require("bullmq");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const prisma = require("./db");
require("dotenv").config();

// init Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function callGemini(userMessage) {
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}

const connection = { host: "127.0.0.1", port: 6379 };

const worker = new Worker(
  "gemini-messages",
  async job => {
    const { chatroomId, content } = job.data;

    try {
      // call Gemini
      const botReply = await callGemini(content);

      // save bot reply in db
      await prisma.message.create({
        data: {
          who: "bot",
          content: botReply,
          roomId: chatroomId,
        },
      });

      console.log("Gemini replied:", botReply);
    } catch (err) {
      console.error("Gemini API error:", err);

      // save fallback error message
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
