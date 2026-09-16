const crypto = require("crypto");

if (process.env.NODE_ENV === "production" && !process.env.CSRF_SECRET) {
  throw new Error("CSRF_SECRET must be set in production");
}

const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString("hex");

function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const signature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(token)
    .digest("hex");
  return `${token}.${signature}`;
}

function verifyCsrfToken(token) {
  if (!token || !token.includes(".")) return false;
  const [rawToken, signature] = token.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(rawToken)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}

function csrfProtection(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const token = req.headers["x-csrf-token"];
  if (!verifyCsrfToken(token)) {
    return res.status(403).json({ error: "Invalid or missing CSRF token" });
  }
  next();
}

function setCsrfToken(req, res, next) {
  const token = generateCsrfToken();
  res.setHeader("X-CSRF-Token", token);
  next();
}

module.exports = { csrfProtection, setCsrfToken, generateCsrfToken };
