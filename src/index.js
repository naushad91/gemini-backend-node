const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Gemini backend running...");
});

app.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
});
