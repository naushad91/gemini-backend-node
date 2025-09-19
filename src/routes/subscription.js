const express = require("express");
const Stripe = require("stripe");
const prisma = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ----------------- POST /subscribe/pro -----------------
// Creates Stripe Checkout session for upgrading user to Pro
router.post("/pro", authMiddleware, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: "price_12345", // replace with your Stripe Price ID
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:3000/cancel",
      client_reference_id: req.user.id.toString(), // link checkout to user
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("create subscription error:", err);
    res.status(500).json({ error: "could not start subscription" });
  }
});

// ----------------- POST /webhook/stripe -----------------
// Stripe will call this after payment events
router.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = parseInt(session.client_reference_id, 10);

    // Mark user as Pro in DB
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: true },
    });

    console.log(`✅ User ${userId} upgraded to Pro`);
  }

  res.json({ received: true });
});

// ----------------- GET /subscription/status -----------------
router.get("/status", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isPremium: true },
  });

  res.json({ isPremium: user.isPremium });
});
