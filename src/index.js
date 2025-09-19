const express = require("express");
const prisma = require("./db");
const authRoutes = require("./routes/auth");
const chatroomRoutes = require("./routes/chatroom");
const userRoutes = require("./routes/user");
const subscriptionRoutes = require("./routes/subscription");

const app = express();

// 👇 Add this BEFORE express.json()
app.use("/subscription/webhook/stripe", 
  require("body-parser").raw({ type: "application/json" })
);

// 👇 For all other routes, JSON is fine
app.use(express.json());

app.use("/user", userRoutes);
app.use("/auth", authRoutes);
app.use("/chatroom", chatroomRoutes);
app.use("/subscription", subscriptionRoutes);

app.get("/", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json({ msg: "Gemini backend running...", users });
});

app.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
});
