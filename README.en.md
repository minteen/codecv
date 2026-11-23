# CodeCV · Resume Workspace

A local-first resume editor with Markdown / content editing, independent resume drafts, editable template management, and a local Chromium PDF service.

[中文说明](./README.md) · [This fork](https://github.com/minteen/codecv) · [Upstream](https://github.com/acmenlei/codecv) · [License](./LICENSE)

Based on CodeCV by coderlei. Required attribution is retained; donation buttons, payment codes, personal contacts, promotional notices, export counters, and retired community/upload integrations have been removed. Bundled resumes and thumbnails use fictional example data.

## What this fork adds

- Shared navigation: **My resumes / Template library / Syntax guide**.
- Independent drafts with create, edit, copy, rename, delete, search, and sorting.
- Per-resume margins, fonts, colors, and custom CSS, with scoped styles and navigation cleanup.
- Template creation, editing, explicit saving, deletion, and unsaved-change protection. Clicking a template edits it; a separate action creates a resume.
- Resume creation copies the template's content and appearance. Later template edits or deletion do not alter existing resumes.
- Persistent deletion markers prevent bundled templates or stale offline copies from reappearing after refresh.
- A local `pdf-service/` for PDF and PNG export, using installed Chromium instead of a paid third-party export endpoint.
- A4, landscape A4, Letter, or custom page dimensions in millimeters (50–2000 mm).
- Automatic page extension that preserves width and font size while fitting slightly overflowing content on one page.
- Shared print snapshots with embedded fonts and avatars for consistent direct export and browser printing.

## Quick start

Requires **Node.js 22.12+**, npm, and Chrome / Edge / Chromium for direct PDF export.

```sh
git clone https://github.com/minteen/codecv.git
cd codecv
npm ci
npm run pdf:install
```

Run in separate terminals:

```sh
npm run dev
```

```sh
npm run pdf:start
```

Open [the workspace](http://127.0.0.1:5173/#/). Use the actual address printed by Vite if port 5173 is occupied. The frontend binds to `127.0.0.1`; `/api/export` is proxied to the PDF service on port 3001.

Editing and browser print-to-PDF work without the PDF service. See [PDF service documentation](./pdf-service/README.md) for `CHROME_PATH`, `PORT`, `ASSET_ORIGINS`, API details, and service tests. Linux hosts should have suitable CJK fonts installed.

## Working with templates and resumes

Open a template card to edit the template's name, Markdown, margins, colors, font, and CSS. Click **Save template** to persist changes. **Add template** starts a new blank template. **Delete template** requires confirmation and leaves existing resumes intact.

Use the separate **Create resume from this template** button to create a draft. Draft edits save automatically. Copies inherit the current content and appearance and then evolve independently.

For PDF export, choose a preset or enter the width and height. Enable **Automatically extend the page** to fit content without shrinking the font. Short content retains the specified height; extended pages are limited to 2000 mm. A nonstandard long page may need scaling when printed on A4.

For comparable browser-print output, use the same page size, no margins, 100% scale, background graphics enabled, and headers/footers disabled.

## Data and privacy

- Development mode stores drafts in `drafts/<id>.json` and template overrides/deletion markers in `template-library/<type>.json`, falling back to browser storage if the API is unavailable.
- Pure static hosting uses browser storage. Storage is isolated by scheme, hostname, and port. Clearing browser data removes browser-only records.
- Drafts, template overrides, private media, build output, test output, and local environment files are excluded by `.gitignore`.
- Export output is downloaded by the browser; the PDF service does not store uploaded resumes or generated files.
- Defaults keep resume data on the browser/local machine. Google Fonts and the icon CDN are still external asset dependencies; fully offline use requires self-hosted assets.
- `VITE_EXPORT_URL` can override the export endpoint. Configuring a remote service sends resumes to that service. All `VITE_*` variables are public, so never place secrets in them.
- `.gitignore` does not sanitize files already tracked or historical commits. Inspect staged content before publishing, and back up important drafts separately.

Copy `.env.example` to `.env.local` only if you need optional configuration; default local startup needs no credentials.

## Validation and builds

```sh
npm run check
npm test
npm run pdf:test
npm run build
npm run preview
```

`npm test` runs regression tests only; it never commits or pushes. PDF tests require local Chromium and write ignored output under `tmp/pdfs/`. Frontend and PDF service use separate npm lockfiles.

The Dockerfile serves an existing `dist/` build:

```sh
npm run build
docker build -t codecv-local .
docker run --rm -p 8080:80 codecv-local
```

Static deployment does **not** include the Vite draft/template APIs or the PDF service. Run the PDF service separately and reverse-proxy same-origin `/api/export` to `127.0.0.1:3001/api/export`, removing the forwarded `Origin` header. These services target trusted local use; public deployments need authentication, rate limits, resource allowlists, and isolation. `npm run preview` is only a static preview and has no development API proxy.

The inherited dependency stack should be upgraded and tested separately. Check it with `npm audit` and `npm --prefix pdf-service audit`. Non-forced fixes were applied during this preparation, but the frontend still reports **7 findings (1 high, 6 moderate)** associated mainly with the old Vite/type-checking toolchain. Passing checks and builds does not resolve those findings; major upgrades remain follow-up work.

## Troubleshooting

- **Cannot open the page:** keep the development terminal running and use its actual `127.0.0.1` URL. `/#/home` redirects to `/#/`.
- **Port 3001 already in use:** a PDF service may already be running. Inspect with `lsof -nP -iTCP:3001 -sTCP:LISTEN` and stop the original process with `Ctrl+C` if a restart is needed.
- **PDF export fails:** check the PDF service, browser executable, and readable fonts/images; browser print is an alternative.
- **Missing drafts after switching ports:** browser storage is origin-specific. For development file storage, check the project directory and `drafts/` backup. Resetting content is not a recovery method.

## Attribution and license

Original work: coderlei, [acmenlei/codecv](https://github.com/acmenlei/codecv). Fork: [minteen/codecv](https://github.com/minteen/codecv).

The upstream [LICENSE](./LICENSE) is retained without relicensing. It contains a GPLv3 heading together with noncommercial and attribution clauses; the old README's MIT label did not match it. This fork therefore does not claim an MIT license. Refer to the included license text for its terms.
