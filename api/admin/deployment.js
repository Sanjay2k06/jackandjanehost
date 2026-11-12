const {
  ApiError,
  deploymentConfig,
  methodNotAllowed,
  requireAdmin,
  sendJson,
  vercelRequest,
} = require("../_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!requireAdmin(req, res)) return;
  try {
    const commit = typeof req.query.commit === "string" ? req.query.commit : "";
    if (!/^[a-f0-9]{40}$/i.test(commit)) throw new ApiError(400, "A valid GitHub commit SHA is required.");
    const config = deploymentConfig();
    const list = await vercelRequest(config, `/v6/deployments?projectId=${encodeURIComponent(config.projectId)}&limit=20`);
    const deployment = (list.deployments || []).find((item) => item.meta && item.meta.githubCommitSha === commit);
    if (!deployment) {
      return sendJson(res, 200, {
        commit,
        state: "WAITING",
        message: "GitHub confirmed the commit. Waiting for Vercel to start its deployment.",
      });
    }
    const details = await vercelRequest(config, `/v13/deployments/${encodeURIComponent(deployment.uid || deployment.id)}`);
    const state = details.readyState || details.state || deployment.readyState || deployment.state || "BUILDING";
    return sendJson(res, 200, {
      commit,
      state,
      url: details.url || deployment.url || "",
      message: deploymentMessage(state),
    });
  } catch (error) {
    if (error instanceof ApiError) return sendJson(res, error.status, { error: error.message });
    console.error("Vercel deployment status lookup failed.", error);
    return sendJson(res, 502, { error: "Vercel deployment status could not be retrieved." });
  }
};

function deploymentMessage(state) {
  if (state === "READY") return "The Vercel deployment is ready.";
  if (state === "ERROR") return "The Vercel deployment failed. Review the deployment logs in Vercel.";
  if (state === "CANCELED") return "The Vercel deployment was canceled.";
  if (state === "QUEUED") return "Vercel has queued the deployment.";
  if (state === "INITIALIZING" || state === "BUILDING") return "Vercel is building the updated website.";
  return `Vercel deployment status: ${state}.`;
}
