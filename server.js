// server.js
// A small Express backend that audits a URL: fetches the page and
// returns a JSON report (status, timing, title, meta description,
// H1 count, images missing alt text, approximate word count).

const path = require('path');
const express = require('express');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const FETCH_TIMEOUT_MS = 10000; // 10s timeout for the outbound fetch

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Validate that a string is a well-formed http/https URL.
 * Returns a URL object on success, or null on failure.
 */
function parseUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let candidate = raw.trim();
  if (!candidate) return null;

  // If the user forgot the protocol, assume https.
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch a URL with a timeout, returning the response and elapsed time.
 * Throws a tagged error ({ code }) on timeout or network failure so the
 * route handler can turn it into a clean HTTP response.
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Some sites block requests with no user agent.
        'User-Agent':
          'Mozilla/5.0 (compatible; URLAuditorBot/1.0; +https://example.com/bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const responseTimeMs = Date.now() - start;
    return { response, responseTimeMs };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    if (err.name === 'AbortError') {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutError.code = 'TIMEOUT';
      timeoutError.responseTimeMs = responseTimeMs;
      throw timeoutError;
    }
    const networkError = new Error(err.message || 'Network request failed');
    networkError.code = 'NETWORK_ERROR';
    networkError.responseTimeMs = responseTimeMs;
    throw networkError;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build the audit report from HTML text.
 */
function buildReport(html, meta) {
  const $ = cheerio.load(html);

  const title = $('title').first().text().trim() || null;

  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null;

  const h1Count = $('h1').length;

  const images = $('img');
  const imagesTotal = images.length;
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt.trim() === '') {
      imagesMissingAlt += 1;
    }
  });

  // Approximate word count: strip script/style tags, get visible text,
  // collapse whitespace, split on spaces.
  $('script, style, noscript').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText ? bodyText.split(' ').length : 0;

  return {
    url: meta.url,
    finalUrl: meta.finalUrl,
    httpStatus: meta.httpStatus,
    responseTimeMs: meta.responseTimeMs,
    title,
    metaDescription,
    h1Count,
    imagesTotal,
    imagesMissingAlt,
    wordCount,
  };
}

app.post('/api/audit', async (req, res) => {
  const rawUrl = req.body?.url;
  const parsedUrl = parseUrl(rawUrl);

  if (!parsedUrl) {
    return res.status(400).json({
      error: 'INVALID_URL',
      message: 'Please provide a valid http(s) URL, e.g. https://example.com',
    });
  }

  let fetchResult;
  try {
    fetchResult = await fetchWithTimeout(parsedUrl.toString(), FETCH_TIMEOUT_MS);
  } catch (err) {
    if (err.code === 'TIMEOUT') {
      return res.status(408).json({
        error: 'TIMEOUT',
        message: `The request to that URL timed out after ${FETCH_TIMEOUT_MS / 1000}s.`,
      });
    }
    return res.status(502).json({
      error: 'FETCH_FAILED',
      message: `Could not reach that URL: ${err.message}`,
    });
  }

  const { response, responseTimeMs } = fetchResult;
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return res.status(415).json({
      error: 'NOT_HTML',
      message: `That URL returned a non-HTML response (content-type: ${
        contentType || 'unknown'
      }).`,
      httpStatus: response.status,
      responseTimeMs,
    });
  }

  let html;
  try {
    html = await response.text();
  } catch (err) {
    return res.status(502).json({
      error: 'READ_FAILED',
      message: 'Could not read the response body from that URL.',
    });
  }

  try {
    const report = buildReport(html, {
      url: parsedUrl.toString(),
      finalUrl: response.url || parsedUrl.toString(),
      httpStatus: response.status,
      responseTimeMs,
    });
    return res.json(report);
  } catch (err) {
    return res.status(500).json({
      error: 'PARSE_FAILED',
      message: 'Fetched the page but failed to parse it.',
    });
  }
});

// Health check for deployment platforms.
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Catch-all: never let an unhandled error crash the process.
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' });
});

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled rejection:', reason);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`URL Auditor running on http://localhost:${PORT}`);
});
