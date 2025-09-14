const express = require("express");
const prisma = require("./db");
const authRoutes = require("./routes/auth");
const chatroomRoutes = require("./routes/chatroom");

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/chatroom", chatroomRoutes);

app.get("/", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json({ msg: "Gemini backend running...", users });
});

app.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
});
