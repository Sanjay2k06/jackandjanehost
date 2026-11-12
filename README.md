# Jack & Jane Developmental Centre

The public website remains a static HTML, CSS and JavaScript site. Its editable content is stored in JSON files in this GitHub repository. The `/admin` dashboard uses Vercel Functions to authenticate an administrator and commit validated content changes to GitHub; GitHub then triggers the normal Vercel deployment.

## Project layout

```text
/
├── admin/                 # Separate admin interface
├── api/                   # Vercel serverless functions
│   ├── auth/               # Login, session check and logout
│   ├── admin/              # Content save and deployment status
│   └── _lib/               # Shared server-only helpers
├── assets/gallery/         # New optimized gallery uploads
├── data/
│   ├── content.json        # Brand, hero, about, services, contact and footer
│   ├── branches.json       # Branch details, order and visibility
│   └── gallery.json        # Photo paths, captions, order and visibility
├── imagees/                # Existing website photographs (preserved)
├── cartoon_image/          # Existing assets (preserved)
├── logo_stuffs/            # Existing logo assets (preserved)
├── index.html              # Existing single-page public website
├── script.js
├── styles.css
└── vercel.json
```

No frontend framework, database, separate server, or runtime package dependency is used. Newly uploaded gallery photos are optimized in the browser and committed under `assets/gallery/`. Existing photo files remain in their original directories.

## Deploy to Vercel

1. Create a private GitHub repository and push this project to its production branch. This workspace did not include Git repository metadata, so initialize and connect it before deploying:

   ```powershell
   git init -b main
   git add .
   git commit -m "Prepare Jack and Jane website"
   git remote add origin https://github.com/OWNER/REPOSITORY.git
   git push -u origin main
   ```

2. Import that repository into Vercel. Use the repository root as the project root and the **Other** framework preset. Do not configure a build command; the HTML, CSS, JavaScript and JSON are deployed as static files, while files under `api/` are Vercel Functions.
3. Add the environment variables below to the Vercel **Production** environment. The GitHub integration should watch the same branch set in `GITHUB_BRANCH`.
4. Deploy once, then open `https://YOUR-DOMAIN/admin`. The public website remains at `/`.
5. To run locally with the same serverless routes, install the Vercel CLI and run `vercel dev` from the project root. Opening `index.html` directly with `file://` does not load the JSON files or `/api` routes.

## Environment variables

Set these in Vercel Project Settings → Environment Variables. Keep all credentials server-side; do not add them to `index.html`, `admin.js`, public JSON, or a committed `.env` file.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_USERNAME` | Yes | The one administrator's sign-in name. |
| `ADMIN_PASSWORD` | Yes | Administrator password; at least 12 characters. Use a unique password. |
| `SESSION_SECRET` | Yes | Random signing key of at least 32 characters for expiring admin sessions. |
| `GITHUB_TOKEN` | Yes | Fine-grained GitHub token used only by the Vercel Functions. |
| `GITHUB_OWNER` | Yes | GitHub account or organization that owns the repository. |
| `GITHUB_REPO` | Yes | Repository name, without an owner prefix. |
| `GITHUB_BRANCH` | Yes | Branch that content changes should commit to, for example `main`. |
| `VERCEL_TOKEN` | Yes for deployment status | Vercel API token with permission to read deployments for this project. |
| `VERCEL_PROJECT_ID` | Yes for deployment status | Project ID from Vercel Project Settings → General. |
| `VERCEL_TEAM_ID` | Only for team projects | Team ID for the Vercel project. |

For the requested admin account, set `ADMIN_USERNAME` to `jasonjack`. Enter `ADMIN_PASSWORD` directly in Vercel Project Settings → Environment Variables; never put the password in source files or Git.

Generate a signing key locally without installing anything:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Create a **fine-grained personal access token** in GitHub and restrict it to this repository. Grant **Contents: Read and write**; repository metadata read access is required by GitHub and is normally included automatically. No organization, workflow, issue, or user permissions are needed. Do not put this token in a `NEXT_PUBLIC_*`-style variable or any client-side file.

Create a Vercel token limited to the project/team that can read deployment details. If the Vercel status token is not configured, saves can still be committed to GitHub, but the dashboard will clearly report that deployment status is unavailable.

## Admin workflow

- Sign in at `/admin` with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- Edit existing website copy, services, branch details and gallery captions/order/visibility. Additions and deletions remain drafts until saved.
- **Preview changes** loads the public site in a private preview frame and sends the current draft with `postMessage`; it does not write browser storage or create a GitHub commit.
- **Save changes** validates the complete draft and stages content JSON plus any image uploads/deletions as one Git tree and one GitHub commit. A success message appears only after GitHub confirms the branch update.
- The dashboard then checks Vercel for a deployment with that exact GitHub commit SHA and reports the deployment state. A GitHub commit can succeed even if a later Vercel build fails; the dashboard reports these as separate outcomes.
- Branch and photo deletion requires confirmation. Hiding an existing photo removes it from the public gallery but preserves the original file. Removing a newly uploaded gallery photo also removes its repository asset if it is no longer used.
- Admin sessions are HMAC-signed, expire after eight hours, and use `HttpOnly`, `SameSite=Strict`, and `Secure` cookies on HTTPS. Write requests also require a same-origin `Origin` header.

## Operational notes

- The admin reads the latest JSON and Git blob SHAs from GitHub. Saves compare the dashboard's starting SHAs with current GitHub SHAs and return a conflict instead of overwriting newer edits. The branch reference is updated without force; simultaneous commits are rejected for a reload/retry.
- Image input is restricted to JPEG, PNG and WebP, with a 12 MB source limit. The browser resizes and encodes images before upload; optimized images are capped at 1.2 MB each and 2.5 MB total per save. The API independently checks base64, image signatures, file extension and sizes.
- The public page loads `data/content.json`, `data/branches.json` and `data/gallery.json`. It retains its original HTML content as a fallback if those requests fail; on Vercel the JSON files are served from the same deployment.
- The admin interface and API do not contain a default password or a GitHub token. The public `/admin` page is only the sign-in shell; all content reads, writes and deployment queries require a valid session.
- Configure GitHub/Vercel branch protection and limit repository/Vercel project access to trusted administrators. The serverless functions do not provide a separate persistent login rate-limit store.
- Before production, add a Vercel Firewall rate-limit rule for `POST /api/auth/login`. A process-local counter is not reliable across serverless instances, and adding a database solely for rate limiting is intentionally avoided.

## API routes

| Route | Methods | Access |
| --- | --- | --- |
| `/api/auth/login` | `POST` | Same-origin sign-in; credentials are checked against Vercel environment variables. |
| `/api/auth/session` | `GET` | Returns only whether the current session is valid. |
| `/api/auth/logout` | `POST` | Same-origin session-cookie removal. |
| `/api/admin/content` | `GET`, `PUT` | Authenticated read and atomic JSON/image GitHub commit. |
| `/api/admin/deployment?commit=<sha>` | `GET` | Authenticated Vercel status lookup for a confirmed GitHub commit. |

## Verification

The focused, dependency-free API tests run with Node.js 20 or newer:

```powershell
node --test tests\admin-api.test.js
```
