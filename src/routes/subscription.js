const express = require("express");
const Stripe = require("stripe");
const prisma = require("../db");
const authMiddleware = require("../middleware/auth");
const bodyParser = require("body-parser");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ----------------- 1. Start Pro subscription -----------------
router.post("/subscribe/pro", authMiddleware, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // from dashboard
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/success", // frontend success page
      cancel_url: "http://localhost:3000/cancel",   // frontend cancel page
      metadata: {
        userId: req.user.id, // so we know which user paid
      },
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("subscribe error:", err);
    res.status(500).json({ error: "could not create checkout session" });
  }
});

// ----------------- 2. Stripe webhook -----------------
router.post(
  "/webhook/stripe",
  bodyParser.raw({ type: "application/json" }), // raw body for Stripe
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const userId = session.metadata.userId;
        if (userId) {
          await prisma.user.update({
            where: { id: Number(userId) },
            data: { isPremium: true },
          });
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("webhook error:", err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// ----------------- 3. Check subscription status -----------------
router.get("/subscription/status", authMiddleware, async (req, res) => {
  const plan = req.user.isPremium ? "Pro" : "Basic";
  res.json({ plan });
});

module.exports = router;
