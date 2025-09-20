# Gemini Chat Backend (Assignment - Kuvaka Tech)

## 🚀 Overview
This project is a backend clone of Gemini Chat with:
- OTP-based authentication
- Chatroom management
- Gemini API integration
- BullMQ for async processing
- Stripe subscription system (Basic & Pro plans)

Built with **Node.js (Express)**, **Postgres (Prisma)**, **Redis**, and **Docker**.

---

## 🛠️ Setup & Run

### Prerequisites
- [Docker & Docker Compose](https://docs.docker.com/get-docker/)
- [Stripe Test Account](https://stripe.com/)
- Google Gemini API Key

### Environment Variables (`.env`)

# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/gemini_db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret

# Gemini API
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_PRICE_ID=price_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx


### Run with Docker
```bash
docker-compose up --build
Backend runs at:
👉 http://localhost:8000
```

###  Architecture

- Express.js → REST API server

- Postgres (via Prisma ORM) → Stores users, chatrooms, and messages

- Redis →

  - OTP storage (short-lived keys)

  - Chatroom list caching

  - Queue backend for BullMQ

- BullMQ → Handles async Gemini API calls

- Gemini API → Generates bot responses

- Stripe → Manages subscription payments and upgrades




## 🔄 Queue System (BullMQ)

Gemini API calls can sometimes be slow or rate-limited.  
To ensure the app stays **fast and reliable**, we use **BullMQ (Redis-based queue)**.

### Flow
1. **User sends a message** → `POST /chatroom/:id/message`
2. Message is saved to DB (as `"user"`)
3. A **job is added to the queue** (`gemini-messages`)
4. The **worker** (`worker.js`) picks up the job
5. Worker calls **Gemini API**
6. Bot reply is saved in DB (as `"bot"`)
7. User can fetch replies with `GET /chatroom/:id`


![alt text](image.png)

## 📱 Testing via Postman

### 🔑 Auth Flow
- `POST /auth/signup` → Register user  
- `POST /auth/send-otp` → Request OTP  
- `POST /auth/verify-otp` → Verify OTP → Get JWT  

👉 Use the JWT in headers:  Authorization: Bearer <token>

### 💬 Chatroom Flow
- `POST /chatroom` → Create a chatroom  
- `GET /chatroom` → List chatrooms (with Redis caching)  
- `POST /chatroom/:id/message` → Send message (adds job to Gemini queue)  
- `GET /chatroom/:id` → Fetch all messages in a chatroom  

---

### 💳 Subscription Flow
- `POST /subscription/subscribe/pro` → Start Pro subscription (Stripe Checkout)  
- `POST /subscription/webhook/stripe` → Stripe webhook for payment updates  
- `GET /subscription/status` → Check subscription plan (Basic/Pro)  

---


---

## ⚡ Assumptions & Design Decisions
- ✅ OTP-based login only (no email verification)  
- ✅ Stripe in **sandbox mode**  
- ✅ Basic plan → **5 messages/day** limit  
- ✅ Pro plan → **Unlimited messages**  
- ✅ Caching used only for **chatroom list**  
- ✅ Asynchronous Gemini calls handled via **BullMQ queue**
