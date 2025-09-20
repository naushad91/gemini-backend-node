// const Redis = require("ioredis");

// const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// module.exports = redis;


const Redis = require("ioredis");

let redis;

if (process.env.REDIS_URL) {
  // Upstash (cloud)
  redis = new Redis(process.env.REDIS_URL, {
    tls: {}, // Upstash requires TLS
  });
} else {
  // Local dev (docker redis)
  redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  });
}

module.exports = redis;
