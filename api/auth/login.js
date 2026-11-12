const {
  ApiError,
  createSession,
  ensureSameOrigin,
  methodNotAllowed,
  parseJsonBody,
  sendJson,
  setSessionCookie,
} = require("../_lib");
const crypto = require("node:crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    ensureSameOrigin(req);
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password || password.length < 12
      || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      throw new ApiError(500, "Admin authentication is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET.");
    }
    const body = parseJsonBody(req, 2048);
    const suppliedUsername = typeof body.username === "string" ? body.username : "";
    const suppliedPassword = typeof body.password === "string" ? body.password : "";
    const usernameMatches = safeEqual(suppliedUsername, username);
    const passwordMatches = safeEqual(suppliedPassword, password);
    if (!usernameMatches || !passwordMatches) {
      return sendJson(res, 401, { error: "The username or password is incorrect." });
    }
    setSessionCookie(req, res, createSession(username), 8 * 60 * 60);
    return sendJson(res, 200, { authenticated: true });
  } catch (error) {
    if (error instanceof ApiError) return sendJson(res, error.status, { error: error.message });
    console.error("Admin login failed.", error);
    return sendJson(res, 500, { error: "Admin login could not be completed." });
  }
};

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
