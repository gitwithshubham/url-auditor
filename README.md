# URL Auditor

A small full-stack web tool that audits any URL and returns a quick health/SEO
report: HTTP status, response time, page title, meta description, H1 count,
images missing `alt` text, and approximate word count.

**Stack:** Node.js + Express (backend), vanilla HTML/CSS/JS (frontend), Cheerio
for HTML parsing. Single server, no database, no build step.

## Features

- `POST /api/audit` — accepts `{ "url": "..." }`, fetches the page, and
  returns a JSON report.
- Clean single-page frontend that calls the endpoint and renders the report.
- Robust error handling: invalid URLs, timeouts, non-HTML responses, and
  unreachable hosts all return sensible JSON errors (never a crash).

## Project structure

```
url-auditor/
├── server.js          # Express backend + audit logic
├── package.json
├── public/             # Static frontend, served by Express
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .gitignore
└── README.md
```

## Running locally

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## API

### `POST /api/audit`

Request body:

```json
{ "url": "https://example.com" }
```

Success response (`200`):

```json
{
  "url": "https://example.com",
  "finalUrl": "https://example.com/",
  "httpStatus": 200,
  "responseTimeMs": 123,
  "title": "Example Domain",
  "metaDescription": null,
  "h1Count": 1,
  "imagesTotal": 0,
  "imagesMissingAlt": 0,
  "wordCount": 28
}
```

Error responses:

| Status | Error code       | When                                       |
|--------|------------------|---------------------------------------------|
| 400    | `INVALID_URL`    | Missing or malformed URL                    |
| 408    | `TIMEOUT`        | Target site didn't respond within 10s       |
| 415    | `NOT_HTML`       | Response content-type isn't `text/html`     |
| 502    | `FETCH_FAILED`   | DNS/connection failure reaching the URL     |
| 500    | `PARSE_FAILED`   | Page fetched but failed to parse            |

## Deployment (free tier)

This project deploys well to **Render.com free tier** (recommended, since it
runs a persistent Node server, not serverless functions). Steps:

1. Push this repo to GitHub (see below).
2. Go to https://render.com → New → Web Service → connect your GitHub repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment:** Node
4. Deploy — Render gives you a public URL like
   `https://url-auditor.onrender.com`.

Alternative: Railway.app free tier works the same way (connect repo, it
auto-detects Node and runs `npm start`).

> Note: on free tiers the service may "sleep" after inactivity, so the first
> request after idling can take a few extra seconds.

## Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial commit: URL Auditor tool"
git branch -M main
git remote add origin https://github.com/<your-username>/url-auditor.git
git push -u origin main
```
