const crypto = require("node:crypto");

const SESSION_COOKIE = "jj_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const ICONS = new Set(["arrow-up-right", "sparkle", "speech", "play", "sensory", "home", "heart", "sun"]);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { error: "Method not allowed." });
}

function parseJsonBody(req, maxBytes = 4_000_000) {
  let value = req.body;
  if (typeof value === "string" || Buffer.isBuffer(value)) {
    if (Buffer.byteLength(value) > maxBytes) throw new ApiError(413, "Request body is too large.");
    try {
      value = JSON.parse(value.toString());
    } catch {
      throw new ApiError(400, "Request body must be valid JSON.");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Request body must be a JSON object.");
  }
  if (Buffer.byteLength(JSON.stringify(value)) > maxBytes) {
    throw new ApiError(413, "Request body is too large.");
  }
  return value;
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function ensureSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!origin || !host) throw new ApiError(403, "The request origin could not be verified.");
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new ApiError(403, "The request origin could not be verified.");
  }
  if (parsed.host.toLowerCase() !== String(host).toLowerCase()) {
    throw new ApiError(403, "Cross-origin administrative requests are not allowed.");
  }
  if (process.env.VERCEL_ENV === "production" && parsed.protocol !== "https:") {
    throw new ApiError(403, "Administrative requests must use HTTPS.");
  }
}

function getCookie(req, name) {
  const cookie = req.headers.cookie || "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!entry) return "";
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return "";
  }
}

function createSession(username) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(500, "Admin authentication is not configured.");
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  const token = getCookie(req, SESSION_COOKIE);
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest("base64url");
  if (!constantTimeEqual(parts[1], expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return payload.username === process.env.ADMIN_USERNAME
      && Number.isInteger(payload.exp)
      && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function setSessionCookie(req, res, value, maxAge) {
  const secure = req.headers["x-forwarded-proto"] === "https" || process.env.VERCEL_ENV === "production";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}

function requireAdmin(req, res) {
  if (!verifySession(req)) {
    sendJson(res, 401, { error: "Your admin session has expired. Please sign in again." });
    return false;
  }
  return true;
}

function requireText(value, label, maxLength, { optional = false } = {}) {
  if (optional && (value === "" || value === undefined)) return;
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new ApiError(400, `${label} must be a non-empty string of at most ${maxLength} characters.`);
  }
}

function requireKeys(value, label, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new ApiError(400, `${label} contains an unsupported field.`);
  }
}

function requireEmail(value, label) {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new ApiError(400, `${label} must be a valid email address.`);
  }
}

function requirePhone(value, label) {
  if (typeof value !== "string" || !/^[+()\d\s.-]{7,20}$/.test(value) || value.replace(/\D/g, "").length < 7) {
    throw new ApiError(400, `${label} must be a valid phone number.`);
  }
}

function requireHttpsOrEmpty(value, label) {
  if (value === "") return;
  try {
    if (new URL(value).protocol !== "https:") throw new Error();
  } catch {
    throw new ApiError(400, `${label} must be an HTTPS URL.`);
  }
}

function validatePath(path, label) {
  if (typeof path !== "string"
    || !/^(?:imagees\/[A-Za-z0-9._ ()-]+\.jpe?g|assets\/gallery\/[a-z0-9-]+\.(?:webp|jpe?g|png))$/i.test(path)
    || path.includes("..")) {
    throw new ApiError(400, `${label} is not an allowed image path.`);
  }
}

function validateContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new ApiError(400, "Website content is missing or invalid.");
  }
  requireKeys(content, "Website content", ["hero", "company", "about", "services", "contact", "footer"]);
  const { hero, company, about, services, contact, footer } = content;
  if (!hero || !company || !about || !contact || !footer) {
    throw new ApiError(400, "Required website content sections are missing.");
  }
  requireKeys(hero, "Hero content", ["heading", "emphasis", "description", "tagline"]);
  requireKeys(company, "Company content", ["name", "fullName", "location"]);
  requireKeys(about, "About content", ["eyebrow", "heading", "emphasis", "paragraphs", "values"]);
  requireKeys(contact, "Contact content", ["phone", "email", "whatsappNumber", "intro", "mapUrl", "mapEmbedUrl"]);
  requireKeys(footer, "Footer content", ["tagline", "beliefLines", "closing"]);
  requireText(hero.heading, "Hero heading", 120);
  requireText(hero.emphasis, "Hero highlighted heading", 120);
  requireText(hero.description, "Hero description", 1200);
  requireText(hero.tagline, "Hero tagline", 120);
  requireText(company.name, "Company name", 100);
  requireText(company.fullName, "Company full name", 160);
  requireText(company.location, "Company location", 120);
  requireText(about.eyebrow, "About eyebrow", 100);
  requireText(about.heading, "About heading", 160);
  requireText(about.emphasis, "About highlighted heading", 100);
  if (!Array.isArray(about.paragraphs) || about.paragraphs.length < 1 || about.paragraphs.length > 8) {
    throw new ApiError(400, "About content must contain between 1 and 8 paragraphs.");
  }
  about.paragraphs.forEach((value) => requireText(value, "About paragraph", 1200));
  if (!Array.isArray(about.values) || about.values.length > 12) throw new ApiError(400, "About values must be a list of at most 12 items.");
  about.values.forEach((value) => requireText(value, "About value", 100));
  if (!Array.isArray(services) || services.length < 1 || services.length > 30) {
    throw new ApiError(400, "Services must contain between 1 and 30 items.");
  }
  const serviceTitles = new Set();
  services.forEach((service) => {
    requireKeys(service, "Service", ["title", "description", "symbol"]);
    requireText(service.title, "Service title", 120);
    requireText(service.description, "Service description", 1500);
    if (!ICONS.has(service.symbol)) throw new ApiError(400, "A service contains an unsupported icon.");
    const normalized = service.title.trim().toLowerCase();
    if (serviceTitles.has(normalized)) throw new ApiError(400, "Service titles must be unique.");
    serviceTitles.add(normalized);
  });
  requireText(contact.phone, "Contact phone", 30);
  requirePhone(contact.phone, "Contact phone");
  requireEmail(contact.email, "Contact email");
  if (typeof contact.whatsappNumber !== "string" || !/^\d{7,20}$/.test(contact.whatsappNumber)) {
    throw new ApiError(400, "WhatsApp number must contain 7 to 20 digits.");
  }
  requireText(contact.intro, "Contact introduction", 1000);
  requireHttpsOrEmpty(contact.mapUrl, "Contact map link");
  requireHttpsOrEmpty(contact.mapEmbedUrl, "Contact map embed link");
  requireText(footer.tagline, "Footer tagline", 120);
  if (!Array.isArray(footer.beliefLines) || footer.beliefLines.length > 2) throw new ApiError(400, "Footer belief must contain at most two lines.");
  footer.beliefLines.forEach((value) => requireText(value, "Footer belief line", 120));
  requireText(footer.closing, "Footer closing", 160);
}

function validateBranches(branches) {
  if (!Array.isArray(branches) || branches.length > 30) throw new ApiError(400, "Branches must be a list of at most 30 items.");
  const ids = new Set();
  branches.forEach((branch) => {
    if (!branch || typeof branch !== "object" || !/^[a-z0-9-]{1,60}$/.test(branch.id || "")) {
      throw new ApiError(400, "A branch has an invalid ID.");
    }
    requireKeys(branch, "Branch", ["id", "name", "title", "address", "landmark", "phone", "email", "mapsUrl", "hours", "status", "description", "visible", "order", "featured", "comingSoon", "image", "imageGalleryId", "rating", "reviews"]);
    if (ids.has(branch.id)) throw new ApiError(400, "Branch IDs must be unique.");
    ids.add(branch.id);
    for (const [key, label, limit] of [
      ["name", "Branch name", 100], ["title", "Branch title", 160], ["address", "Branch address", 400],
      ["landmark", "Branch landmark", 200], ["phone", "Branch phone", 30], ["email", "Branch email", 254],
      ["mapsUrl", "Branch maps link", 1000], ["hours", "Branch opening hours", 200],
      ["status", "Branch status", 60], ["description", "Branch description", 800],
    ]) {
      requireText(branch[key], label, limit, { optional: true });
    }
    if (branch.email) requireEmail(branch.email, "Branch email");
    if (branch.phone) requirePhone(branch.phone, "Branch phone");
    requireHttpsOrEmpty(branch.mapsUrl, "Branch maps link");
    if (typeof branch.visible !== "boolean" || !Number.isSafeInteger(branch.order) || branch.order < 1) {
      throw new ApiError(400, "Branch visibility and display order are required.");
    }
    if (typeof branch.featured !== "boolean" || typeof branch.comingSoon !== "boolean") {
      throw new ApiError(400, "Branch display settings are invalid.");
    }
    if (branch.image) validatePath(branch.image, "Branch image");
    if (branch.imageGalleryId !== undefined && branch.imageGalleryId !== ""
      && !/^[a-z0-9-]{1,60}$/.test(branch.imageGalleryId)) {
      throw new ApiError(400, "A branch has an invalid gallery image reference.");
    }
  });
}

function validateGallery(gallery) {
  if (!Array.isArray(gallery) || gallery.length > 50) throw new ApiError(400, "Gallery must be a list of at most 50 items.");
  const ids = new Set();
  const paths = new Set();
  gallery.forEach((image) => {
    if (!image || typeof image !== "object" || !/^[a-z0-9-]{1,60}$/.test(image.id || "")) {
      throw new ApiError(400, "A gallery image has an invalid ID.");
    }
    requireKeys(image, "Gallery image", ["id", "src", "title", "description", "visible", "order"]);
    if (ids.has(image.id)) throw new ApiError(400, "Gallery image IDs must be unique.");
    ids.add(image.id);
    validatePath(image.src, "Gallery image");
    if (image.src.startsWith("assets/gallery/")
      && image.src.replace(/^assets\/gallery\//, "").replace(/\.(?:webp|jpe?g|png)$/i, "") !== image.id) {
      throw new ApiError(400, "Uploaded gallery image filenames must match their image IDs.");
    }
    if (paths.has(image.src)) throw new ApiError(400, "Gallery image paths must be unique.");
    paths.add(image.src);
    requireText(image.title, "Gallery title", 160);
    requireText(image.description, "Gallery description", 500);
    if (typeof image.visible !== "boolean" || !Number.isSafeInteger(image.order) || image.order < 1) {
      throw new ApiError(400, "Gallery visibility and display order are required.");
    }
  });
}

function repositoryConfig() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_BRANCH) {
    throw new ApiError(500, "GitHub repository access is not configured.");
  }
  return { token: GITHUB_TOKEN, owner: GITHUB_OWNER, repo: GITHUB_REPO, branch: GITHUB_BRANCH };
}

async function githubRequest(config, route, options = {}) {
  let response;
  try {
    response = await fetch(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}${route}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    console.error("GitHub API request failed.", error);
    throw new ApiError(502, "GitHub could not be reached. No changes were committed.");
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error(`GitHub API returned ${response.status}: ${detail.slice(0, 1000)}`);
    if (response.status === 409 || response.status === 422) {
      throw new ApiError(409, "The GitHub branch changed during this save. Reload the latest content and try again.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(502, "GitHub rejected the configured token or repository permissions.");
    }
    if (response.status === 404) throw new ApiError(502, "The configured repository, branch, or content file could not be found.");
    throw new ApiError(502, "GitHub could not complete the repository operation.");
  }
  if (response.status === 204) return null;
  return response.json();
}

function githubRoute(path) {
  return `/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function readFile(config, path, ref) {
  const query = `?ref=${encodeURIComponent(ref)}`;
  const file = await githubRequest(config, `/contents${githubRoute(path)}${query}`);
  return {
    sha: file.sha,
    content: Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"),
  };
}

async function readAdminData() {
  const config = repositoryConfig();
  const ref = await githubRequest(config, `/git/ref/heads/${encodeURIComponent(config.branch)}`);
  const headSha = ref.object.sha;
  const paths = ["data/content.json", "data/branches.json", "data/gallery.json"];
  const files = await Promise.all(paths.map((path) => readFile(config, path, headSha)));
  let data;
  try {
    data = files.map((file) => JSON.parse(file.content));
  } catch {
    throw new ApiError(502, "A content JSON file in GitHub is not valid JSON.");
  }
  const headCommit = await githubRequest(config, `/git/commits/${encodeURIComponent(headSha)}`);
  const assetShas = await readGalleryAssetShas(config, headCommit.tree.sha);
  return {
    data,
    version: {
      ...Object.fromEntries(paths.map((path, index) => [path, files[index].sha])),
      ...assetShas,
    },
  };
}

async function readGalleryAssetShas(config, treeSha) {
  const tree = await githubRequest(config, `/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
  if (tree.truncated) throw new ApiError(502, "The GitHub repository tree is too large to validate safely.");
  return Object.fromEntries((tree.tree || [])
    .filter((entry) => entry.type === "blob"
      && /^assets\/gallery\/[a-z0-9-]+\.(?:webp|jpe?g|png)$/i.test(entry.path))
    .map((entry) => [entry.path, entry.sha]));
}

function validateImageBytes(data, path) {
  if (typeof data !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    throw new ApiError(400, "An uploaded image is not valid base64 data.");
  }
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.length > 1_200_000) throw new ApiError(413, "Each optimized image must be no larger than 1.2 MB.");
  const signature = bytes.subarray(0, 12);
  let extension = "";
  if (signature.length >= 12 && signature.toString("ascii", 0, 4) === "RIFF" && signature.toString("ascii", 8, 12) === "WEBP") {
    extension = "webp";
  } else if (signature.length >= 8 && signature.toString("hex", 0, 8) === "89504e470d0a1a0a") {
    extension = "png";
  } else if (signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
    extension = "jpg";
  }
  if (!extension || !path.toLowerCase().endsWith(`.${extension}`)) {
    throw new ApiError(400, "Only valid optimized JPEG, PNG, or WebP images are accepted.");
  }
  return bytes;
}

async function commitFiles(updates, deletes, message, expectedVersion) {
  const config = repositoryConfig();
  const ref = await githubRequest(config, `/git/ref/heads/${encodeURIComponent(config.branch)}`);
  const headSha = ref.object.sha;
  const paths = Object.keys(expectedVersion || {}).filter((path) => !path.startsWith("assets/gallery/"));
  const latestFiles = await Promise.all(paths.map((path) => readFile(config, path, headSha)));
  paths.forEach((path, index) => {
    if (latestFiles[index].sha !== expectedVersion[path]) {
      throw new ApiError(409, "The website content changed in GitHub after you opened the dashboard. Reload before saving.");
    }
  });
  const headCommit = await githubRequest(config, `/git/commits/${encodeURIComponent(headSha)}`);
  const latestAssets = await readGalleryAssetShas(config, headCommit.tree.sha);
  const expectedAssetPaths = Object.keys(expectedVersion || {}).filter((path) => path.startsWith("assets/gallery/")).sort();
  const latestAssetPaths = Object.keys(latestAssets).sort();
  if (expectedAssetPaths.length !== latestAssetPaths.length
    || expectedAssetPaths.some((path, index) => path !== latestAssetPaths[index]
      || expectedVersion[path] !== latestAssets[path])) {
    throw new ApiError(409, "A gallery image changed in GitHub after you opened the dashboard. Reload before saving.");
  }
  const tree = [];
  const blobs = await Promise.all(updates.map((update) => githubRequest(config, "/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content: update.content.toString("base64"), encoding: "base64" }),
    })));
  updates.forEach((update, index) => {
    tree.push({ path: update.path, mode: "100644", type: "blob", sha: blobs[index].sha });
  });
  for (const path of deletes) tree.push({ path, mode: "100644", type: "blob", sha: null });
  const newTree = await githubRequest(config, "/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
  });
  const commit = await githubRequest(config, "/git/commits", {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
  });
  await githubRequest(config, `/git/refs/heads/${encodeURIComponent(config.branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return commit.sha;
}

function deploymentConfig() {
  const { VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID } = process.env;
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    throw new ApiError(503, "Deployment status is not configured. Set VERCEL_TOKEN and VERCEL_PROJECT_ID.");
  }
  return { token: VERCEL_TOKEN, projectId: VERCEL_PROJECT_ID, teamId: VERCEL_TEAM_ID || "" };
}

async function vercelRequest(config, route) {
  const suffix = config.teamId ? `${route.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(config.teamId)}` : "";
  const response = await fetch(`https://api.vercel.com${route}${suffix}`, {
    headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(`Vercel API returned ${response.status}: ${detail.slice(0, 1000)}`);
    throw new ApiError(502, "Vercel could not report deployment status.");
  }
  return response.json();
}

module.exports = {
  ApiError,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  commitFiles,
  createSession,
  deploymentConfig,
  ensureSameOrigin,
  getCookie,
  methodNotAllowed,
  parseJsonBody,
  readAdminData,
  requireAdmin,
  requireEmail,
  requireHttpsOrEmpty,
  requireText,
  sendJson,
  setSessionCookie,
  validateBranches,
  validateContent,
  validateGallery,
  validateImageBytes,
  verifySession,
  vercelRequest,
};
