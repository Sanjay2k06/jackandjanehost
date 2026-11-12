const { methodNotAllowed, sendJson, verifySession } = require("../_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return sendJson(res, 200, { authenticated: verifySession(req) });
};
