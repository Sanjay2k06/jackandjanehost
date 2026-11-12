const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const contentFixture = require("../data/content.json");
const branchesFixture = require("../data/branches.json");
const galleryFixture = require("../data/gallery.json");
const {
  createSession,
  validateBranches,
  validateContent,
  validateGallery,
  validateImageBytes,
  verifySession,
} = require("../api/_lib");
const loginHandler = require("../api/auth/login");
const contentHandler = require("../api/admin/content");
const deploymentHandler = require("../api/admin/deployment");

const originalFetch = global.fetch;
const previousEnvironment = {
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET: process.env.SESSION_SECRET,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_OWNER: process.env.GITHUB_OWNER,
  GITHUB_REPO: process.env.GITHUB_REPO,
  GITHUB_BRANCH: process.env.GITHUB_BRANCH,
  VERCEL_ENV: process.env.VERCEL_ENV,
};

function configureEnvironment() {
  process.env.ADMIN_USERNAME = "centre-admin";
  process.env.ADMIN_PASSWORD = "long-private-password";
  process.env.SESSION_SECRET = "test-session-secret-with-at-least-thirty-two-characters";
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_OWNER = "example-owner";
  process.env.GITHUB_REPO = "example-site";
  process.env.GITHUB_BRANCH = "main";
  delete process.env.VERCEL_ENV;
}

function makeResponse(value, status = 200) {
  return new Response(value === null ? null : JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createMockResponse() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value; },
    json() { return JSON.parse(this.body); },
  };
}

function adminRequest(body) {
  const token = createSession(process.env.ADMIN_USERNAME);
  return {
    method: "PUT",
    headers: {
      cookie: `jj_admin_session=${encodeURIComponent(token)}`,
      origin: "https://example.test",
      host: "example.test",
      "x-forwarded-proto": "https",
    },
    body,
  };
}

function mockGitHub(currentFiles, changedShas = false, assetShaOverrides = {}) {
  const headSha = "a".repeat(40);
  const latestShas = {
    "data/content.json": changedShas ? "d".repeat(40) : "1".repeat(40),
    "data/branches.json": "2".repeat(40),
    "data/gallery.json": "3".repeat(40),
  };
  const assetPaths = Array.from(new Set([
    ...currentFiles["data/gallery.json"].map((image) => image.src),
    ...currentFiles["data/branches.json"].map((branch) => branch.image),
  ])).filter((path) => path && path.startsWith("assets/gallery/"));
  const assetShas = Object.fromEntries(assetPaths.map((path, index) => [
    path,
    assetShaOverrides[path] || (String(index + 4).repeat(40)).slice(0, 40),
  ]));
  const calls = [];
  global.fetch = async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ url, options });
    if (url.pathname.endsWith("/git/ref/heads/main")) return makeResponse({ object: { sha: headSha } });
    if (url.pathname.endsWith(`/git/commits/${headSha}`)) return makeResponse({ tree: { sha: "b".repeat(40) } });
    if (url.pathname.endsWith(`/git/trees/${"b".repeat(40)}`)) {
      return makeResponse({
        tree: Object.entries(assetShas).map(([path, sha]) => ({ path, sha, type: "blob" })),
        truncated: false,
      });
    }
    const contentMatch = url.pathname.match(/\/contents\/(data\/(?:content|branches|gallery)\.json)$/);
    if (contentMatch) {
      const path = contentMatch[1];
      return makeResponse({
        sha: latestShas[path],
        content: Buffer.from(JSON.stringify(currentFiles[path])).toString("base64"),
      });
    }
    if (url.pathname.endsWith("/git/blobs")) return makeResponse({ sha: crypto.randomBytes(20).toString("hex") });
    if (url.pathname.endsWith("/git/trees") && options.method === "POST") return makeResponse({ sha: "c".repeat(40) });
    if (url.pathname.endsWith("/git/commits")) return makeResponse({ sha: "e".repeat(40) });
    if (url.pathname.endsWith("/git/refs/heads/main") && options.method === "PATCH") return makeResponse({ ref: "refs/heads/main" });
    throw new Error(`Unexpected GitHub request: ${options.method || "GET"} ${url.pathname}`);
  };
  return { calls, latestShas, assetShas };
}

test.beforeEach(configureEnvironment);
test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("validates the initial website data and supports more than three branches", () => {
  validateContent(contentFixture);
  validateGallery(galleryFixture);
  const branches = branchesFixture.concat({
    ...branchesFixture[0],
    id: "fourth-branch",
    name: "Fourth branch",
    order: 4,
  });
  validateBranches(branches);
});

test("rejects unsafe URLs and unsupported or mislabeled image data", () => {
  const invalidContent = structuredClone(contentFixture);
  invalidContent.contact.mapUrl = "javascript:alert(1)";
  assert.throws(() => validateContent(invalidContent), /HTTPS URL/);
  assert.throws(() => validateBranches([{ ...branchesFixture[0], mapsUrl: "http://example.test" }]), /HTTPS URL/);
  const webp = Buffer.from("RIFF0000WEBP", "ascii").toString("base64");
  assert.equal(validateImageBytes(webp, "assets/gallery/photo.webp").toString("ascii", 8, 12), "WEBP");
  assert.throws(() => validateImageBytes(webp, "assets/gallery/photo.jpg"), /valid optimized/);
});

test("creates a signed session cookie after same-origin login", async () => {
  const response = createMockResponse();
  await loginHandler({
    method: "POST",
    headers: { origin: "https://example.test", host: "example.test", "x-forwarded-proto": "https" },
    body: { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["Set-Cookie"], /HttpOnly/);
  assert.match(response.headers["Set-Cookie"], /SameSite=Strict/);
  assert.match(response.headers["Set-Cookie"], /Secure/);
  const cookie = response.headers["Set-Cookie"].split(";")[0];
  assert.equal(verifySession({ headers: { cookie } }), true);
});

test("rejects unauthenticated content writes before calling GitHub", async () => {
  global.fetch = async () => { throw new Error("GitHub must not be called."); };
  const response = createMockResponse();
  await contentHandler({ method: "GET", headers: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.match(response.json().error, /session/);
});

test("commits validated content as a single GitHub tree update", async () => {
  const files = {
    "data/content.json": contentFixture,
    "data/branches.json": branchesFixture,
    "data/gallery.json": galleryFixture,
  };
  const mock = mockGitHub(files);
  const content = structuredClone(contentFixture);
  content.hero.description = "Updated description from a test.";
  const response = createMockResponse();
  await contentHandler(adminRequest({
    content,
    branches: branchesFixture,
    gallery: galleryFixture,
    version: {
      "data/content.json": mock.latestShas["data/content.json"],
      "data/branches.json": mock.latestShas["data/branches.json"],
      "data/gallery.json": mock.latestShas["data/gallery.json"],
    },
  }), response);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().commit, "e".repeat(40));
  assert.equal(response.json().unchanged, false);
  assert.equal(mock.calls.filter((call) => call.url.pathname.endsWith("/git/trees")).length, 1);
  assert.equal(mock.calls.filter((call) => call.url.pathname.endsWith("/git/refs/heads/main") && call.options.method === "PATCH").length, 1);
});

test("rejects a stale dashboard version without creating a commit", async () => {
  const files = {
    "data/content.json": contentFixture,
    "data/branches.json": branchesFixture,
    "data/gallery.json": galleryFixture,
  };
  const mock = mockGitHub(files, true);
  const response = createMockResponse();
  await contentHandler(adminRequest({
    content: contentFixture,
    branches: branchesFixture,
    gallery: galleryFixture,
    version: {
      "data/content.json": "1".repeat(40),
      "data/branches.json": mock.latestShas["data/branches.json"],
      "data/gallery.json": mock.latestShas["data/gallery.json"],
    },
  }), response);
  assert.equal(response.statusCode, 409);
  assert.match(response.json().error, /changed in GitHub/);
  assert.equal(mock.calls.some((call) => call.url.pathname.endsWith("/git/trees")), false);
});

test("commits an optimized gallery upload with the matching JSON in one tree", async () => {
  const files = {
    "data/content.json": contentFixture,
    "data/branches.json": branchesFixture,
    "data/gallery.json": galleryFixture,
  };
  const mock = mockGitHub(files);
  const id = "photo-new";
  const imageBytes = Buffer.from("RIFF0000WEBP", "ascii");
  const gallery = galleryFixture.concat({
    id,
    src: `assets/gallery/${id}.webp`,
    title: "New activity",
    description: "A new activity at the centre.",
    visible: true,
    order: 5,
  });
  const response = createMockResponse();
  await contentHandler(adminRequest({
    content: contentFixture,
    branches: branchesFixture,
    gallery,
    uploads: [{ id, data: imageBytes.toString("base64") }],
    version: mock.latestShas && {
      "data/content.json": "1".repeat(40),
      "data/branches.json": "2".repeat(40),
      "data/gallery.json": "3".repeat(40),
    },
  }), response);
  assert.equal(response.statusCode, 200, response.body);
  const treeCall = mock.calls.find((call) => call.url.pathname.endsWith("/git/trees"));
  const tree = JSON.parse(treeCall.options.body);
  assert.equal(tree.tree.some((entry) => entry.path === `assets/gallery/${id}.webp`), true);
  assert.equal(tree.tree.length, 4);
});

test("removes a deleted gallery entry and its unreferenced upload asset in one commit", async () => {
  const imagePath = "assets/gallery/photo-to-remove.webp";
  const gallery = galleryFixture.concat({
    id: "photo-to-remove",
    src: imagePath,
    title: "Removed activity",
    description: "Activity staged for removal.",
    visible: true,
    order: 5,
  });
  const files = {
    "data/content.json": contentFixture,
    "data/branches.json": branchesFixture,
    "data/gallery.json": gallery,
  };
  const mock = mockGitHub(files, false, { [imagePath]: "5".repeat(40) });
  const response = createMockResponse();
  await contentHandler(adminRequest({
    content: contentFixture,
    branches: branchesFixture,
    gallery: galleryFixture,
    version: {
      ...mock.latestShas,
      [imagePath]: mock.assetShas[imagePath],
    },
  }), response);
  assert.equal(response.statusCode, 200, response.body);
  const treeCall = mock.calls.find((call) => call.url.pathname.endsWith("/git/trees"));
  const tree = JSON.parse(treeCall.options.body);
  assert.equal(tree.tree.some((entry) => entry.path === "data/gallery.json" && entry.sha), true);
  assert.deepEqual(tree.tree.find((entry) => entry.path === imagePath), {
    path: imagePath,
    mode: "100644",
    type: "blob",
    sha: null,
  });
});

test("reports the Vercel state for the exact committed GitHub SHA", async () => {
  process.env.VERCEL_TOKEN = "test-vercel-token";
  process.env.VERCEL_PROJECT_ID = "test-project";
  const commit = "f".repeat(40);
  global.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname === "/v6/deployments") {
      return makeResponse({ deployments: [{ uid: "deployment-1", meta: { githubCommitSha: commit }, url: "site.vercel.app" }] });
    }
    if (url.pathname === "/v13/deployments/deployment-1") {
      return makeResponse({ readyState: "READY", url: "site.vercel.app" });
    }
    throw new Error(`Unexpected Vercel request: ${url.pathname}`);
  };
  const response = createMockResponse();
  await deploymentHandler({
    method: "GET",
    query: { commit },
    headers: { cookie: `jj_admin_session=${encodeURIComponent(createSession(process.env.ADMIN_USERNAME))}` },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().state, "READY");
  assert.equal(response.json().url, "site.vercel.app");
});

test("rejects a stale gallery asset SHA before replacing an image", async () => {
  const imagePath = "assets/gallery/children-artwork.webp";
  const gallery = galleryFixture.map((image) => image.id === "children-artwork" ? {
    ...image,
    src: imagePath,
    title: "Uploaded artwork",
    description: "Artwork at the centre.",
  } : image);
  const files = {
    "data/content.json": contentFixture,
    "data/branches.json": branchesFixture,
    "data/gallery.json": gallery,
  };
  const mock = mockGitHub(files, false, { [imagePath]: "5".repeat(40) });
  const response = createMockResponse();
  await contentHandler(adminRequest({
    content: contentFixture,
    branches: branchesFixture,
    gallery,
    uploads: [{ id: "children-artwork", data: Buffer.from("RIFF0000WEBP", "ascii").toString("base64") }],
    version: {
      "data/content.json": mock.latestShas["data/content.json"],
      "data/branches.json": mock.latestShas["data/branches.json"],
      "data/gallery.json": mock.latestShas["data/gallery.json"],
      [imagePath]: "4".repeat(40),
    },
  }), response);
  assert.equal(response.statusCode, 409);
  assert.match(response.json().error, /changed in GitHub/);
  assert.equal(mock.calls.some((call) => call.url.pathname.endsWith("/git/trees") && call.options.method === "POST"), false);
});
