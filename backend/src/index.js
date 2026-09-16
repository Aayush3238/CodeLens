require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const swaggerUi = require("swagger-ui-express");
const passport = require("./config/passport");
const swaggerSpec = require("./config/swagger");
const { apiLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");
const { csrfProtection, setCsrfToken } = require("./middleware/csrf");
const logger = require("./utils/logger");

const authRoutes = require("./routes/auth");
const problemRoutes = require("./routes/problems");
const submissionRoutes = require("./routes/submissions");
const aiRoutes = require("./routes/ai");
const dashboardRoutes = require("./routes/dashboard");
const leetcodeRoutes = require("./routes/leetcode");
const githubRoutes = require("./routes/github");
const notificationRoutes = require("./routes/notifications");
const bookmarkRoutes = require("./routes/bookmarks");
const graphRoutes = require("./routes/graph");
const { startCronSync } = require("./services/sync/cronSync");

const app = express();
const PORT = process.env.PORT || 5000;

let redis;
try {
  redis = require("./config/redis");
} catch {
  redis = null;
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://github.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.github.com", "https://leetcode.com"],
      frameSrc: ["https://accounts.google.com", "https://github.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production");
}

const sessionConfig = {
  secret: process.env.SESSION_SECRET || "dev-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
};

if (redis && process.env.REDIS_URL) {
  sessionConfig.store = new RedisStore({
    client: redis,
    prefix: "sess:",
    ttl: 86400,
  });
}

app.use(session(sessionConfig));
app.use(passport.initialize());
app.use("/api", apiLimiter);

app.get("/api/csrf-token", setCsrfToken, (req, res) => {
  res.json({ csrfToken: res.getHeader("X-CSRF-Token") });
});

app.use("/api", csrfProtection);

app.use("/uploads", express.static("uploads"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "LeetCoach AI API Documentation",
}));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/leetcode", leetcodeRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/graph", graphRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  startCronSync();
}

app.listen(PORT, () => {
  logger.info(`LeetCoach AI server running on port ${PORT}`);
});

module.exports = app;
