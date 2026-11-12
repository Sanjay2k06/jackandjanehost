const {
  ApiError,
  commitFiles,
  ensureSameOrigin,
  methodNotAllowed,
  parseJsonBody,
  readAdminData,
  requireAdmin,
  sendJson,
  validateBranches,
  validateContent,
  validateGallery,
  validateImageBytes,
} = require("../_lib");

const DATA_PATHS = ["data/content.json", "data/branches.json", "data/gallery.json"];
const MAX_UPLOAD_BYTES = 2_500_000;

module.exports = async function handler(req, res) {
  if (!["GET", "PUT"].includes(req.method)) return methodNotAllowed(res, ["GET", "PUT"]);
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") {
      const current = await readAdminData();
      return sendJson(res, 200, {
        content: current.data[0],
        branches: current.data[1],
        gallery: current.data[2],
        version: current.version,
      });
    }
    ensureSameOrigin(req);
    const body = parseJsonBody(req, 3_900_000);
    validateContent(body.content);
    validateBranches(body.branches);
    validateGallery(body.gallery);
    validateVersion(body.version);
    const uploads = normalizeUploads(body.uploads, body.gallery);

    const current = await readAdminData();
    ensureVersionMatches(body.version, current.version);
    const oldGallery = current.data[2];
    const oldBranches = current.data[1];
    const uploadedPaths = new Set(uploads.map((upload) => upload.path));
    for (const upload of uploads) {
      const previousImage = oldGallery.find((image) => image.id === upload.id);
      if (current.version[upload.path] && (!previousImage || previousImage.src !== upload.path)) {
        throw new ApiError(409, "That gallery image path already exists. Reload and choose a new photo ID.");
      }
    }
    const knownPaths = new Set([
      ...oldGallery.map((image) => image.src),
      ...oldBranches.map((branch) => branch.image).filter(Boolean),
    ]);
    const activePaths = new Set([
      ...body.gallery.map((image) => image.src),
      ...body.branches.map((branch) => branch.image).filter(Boolean),
    ]);
    for (const path of activePaths) {
      if (path.startsWith("assets/gallery/") && !knownPaths.has(path) && !uploadedPaths.has(path)) {
        throw new ApiError(400, "A new gallery asset must be uploaded before it can be published.");
      }
    }
    const deletes = Array.from(knownPaths).filter((path) => path.startsWith("assets/gallery/") && !activePaths.has(path));
    const updates = [
      { path: DATA_PATHS[0], content: jsonBuffer(body.content) },
      { path: DATA_PATHS[1], content: jsonBuffer(body.branches) },
      { path: DATA_PATHS[2], content: jsonBuffer(body.gallery) },
      ...uploads.map(({ path, bytes }) => ({ path, content: bytes })),
    ];

    if (uploads.length === 0 && deletes.length === 0
      && jsonBuffer(body.content).equals(jsonBuffer(current.data[0]))
      && jsonBuffer(body.branches).equals(jsonBuffer(current.data[1]))
      && jsonBuffer(body.gallery).equals(jsonBuffer(current.data[2]))) {
      return sendJson(res, 200, { unchanged: true, commit: null, message: "There are no changes to publish." });
    }

    const commit = await commitFiles(
      updates,
      deletes,
      `Update website content from admin dashboard`,
      body.version,
    );
    return sendJson(res, 200, { unchanged: false, commit, message: "GitHub confirmed the content commit." });
  } catch (error) {
    if (error instanceof ApiError) return sendJson(res, error.status, { error: error.message });
    console.error("Admin content update failed.", error);
    return sendJson(res, 500, { error: "The content update failed before it could be confirmed by GitHub." });
  }
};

function jsonBuffer(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validateVersion(version) {
  const keys = version && typeof version === "object" && !Array.isArray(version) ? Object.keys(version) : [];
  const assetPaths = keys.filter((path) => path.startsWith("assets/gallery/"));
  if (!version || typeof version !== "object" || Array.isArray(version)
    || DATA_PATHS.some((path) => typeof version[path] !== "string" || !/^[a-f0-9]{40}$/i.test(version[path]))
    || keys.some((path) => !DATA_PATHS.includes(path)
      && !/^assets\/gallery\/[a-z0-9-]+\.(?:webp|jpe?g|png)$/i.test(path))
    || assetPaths.some((path) => typeof version[path] !== "string" || !/^[a-f0-9]{40}$/i.test(version[path]))
    || keys.length !== DATA_PATHS.length + assetPaths.length) {
    throw new ApiError(400, "The dashboard content version is missing or invalid. Reload the page before saving.");
  }
}

function ensureVersionMatches(expected, actual) {
  const expectedPaths = Object.keys(expected).sort();
  const actualPaths = Object.keys(actual).sort();
  if (expectedPaths.length !== actualPaths.length
    || expectedPaths.some((path, index) => path !== actualPaths[index] || expected[path] !== actual[path])) {
    throw new ApiError(409, "The website content changed in GitHub after you opened the dashboard. Reload before saving.");
  }
}

function normalizeUploads(uploads, gallery) {
  if (uploads === undefined) uploads = [];
  if (!Array.isArray(uploads) || uploads.length > 10) {
    throw new ApiError(400, "Upload at most 10 optimized photos per save.");
  }
  const galleryById = new Map(gallery.map((image) => [image.id, image]));
  const seen = new Set();
  let totalBytes = 0;
  return uploads.map((upload) => {
    if (!upload || typeof upload.id !== "string" || !/^[a-z0-9-]{1,60}$/.test(upload.id) || seen.has(upload.id)) {
      throw new ApiError(400, "An uploaded image has an invalid or duplicate ID.");
    }
    seen.add(upload.id);
    const image = galleryById.get(upload.id);
    if (!image || !image.src.startsWith(`assets/gallery/${upload.id}.`)) {
      throw new ApiError(400, "Uploaded image data must match a gallery item in this save.");
    }
    const bytes = validateImageBytes(upload.data, image.src);
    totalBytes += bytes.length;
    if (totalBytes > MAX_UPLOAD_BYTES) throw new ApiError(413, "Optimized photos must total no more than 2.5 MB per save.");
    return { path: image.src, bytes };
  });
}
