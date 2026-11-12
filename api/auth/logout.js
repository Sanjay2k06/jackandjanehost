const {
  SESSION_COOKIE,
  ensureSameOrigin,
  methodNotAllowed,
  sendJson,
} = require("../_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    ensureSameOrigin(req);
    const secure = req.headers["x-forwarded-proto"] === "https" || process.env.VERCEL_ENV === "production";
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`);
    return sendJson(res, 200, { authenticated: false });
  } catch (error) {
    console.error("Admin logout failed.", error);
    return sendJson(res, 403, { error: error.message || "Logout could not be completed." });
  }
};
