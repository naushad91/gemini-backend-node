const express = require("express");
const prisma = require("./db");

const app = express();
app.use(express.json());

// test endpoint
app.get("/", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json({ msg: "Gemini backend running...", users });
});

app.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
});
