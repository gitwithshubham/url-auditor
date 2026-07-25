const form = document.getElementById('audit-form');
const input = document.getElementById('url-input');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');
const reportEl = document.getElementById('report');

function setStatus(message, type) {
  statusEl.textContent = message || '';
  statusEl.className = `status ${type || ''}`.trim();
}

function clearReport() {
  reportEl.innerHTML = '';
  reportEl.classList.add('hidden');
}

function metricClass(value, goodMax, warnMax) {
  // Lower is better (used for "images missing alt").
  if (value <= goodMax) return 'good';
  if (value <= warnMax) return 'warn';
  return 'bad';
}

function statusClass(status) {
  if (status >= 200 && status < 300) return 'good';
  if (status >= 300 && status < 400) return 'warn';
  return 'bad';
}

function renderReport(data) {
  const {
    url,
    finalUrl,
    httpStatus,
    responseTimeMs,
    title,
    metaDescription,
    h1Count,
    imagesTotal,
    imagesMissingAlt,
    wordCount,
  } = data;

  const redirected = finalUrl && finalUrl !== url;

  reportEl.innerHTML = `
    <h2>${escapeHtml(url)}</h2>
    <div class="report-meta">
      ${redirected ? `Redirected to ${escapeHtml(finalUrl)}<br/>` : ''}
      Audited just now
    </div>

    <div class="grid">
      <div class="metric">
        <div class="label">HTTP Status</div>
        <div class="value ${statusClass(httpStatus)}">${httpStatus}</div>
      </div>
      <div class="metric">
        <div class="label">Response Time</div>
        <div class="value">${responseTimeMs} ms</div>
      </div>
      <div class="metric">
        <div class="label">H1 Count</div>
        <div class="value ${h1Count === 1 ? 'good' : 'warn'}">${h1Count}</div>
      </div>
      <div class="metric">
        <div class="label">Images Missing Alt</div>
        <div class="value ${metricClass(imagesMissingAlt, 0, 2)}">
          ${imagesMissingAlt} / ${imagesTotal}
        </div>
      </div>
      <div class="metric">
        <div class="label">Word Count (approx.)</div>
        <div class="value">${wordCount.toLocaleString()}</div>
      </div>
    </div>

    <div class="text-block">
      <div class="label">Page Title</div>
      <div class="value ${title ? '' : 'empty'}">${
        title ? escapeHtml(title) : 'Missing'
      }</div>
    </div>

    <div class="text-block">
      <div class="label">Meta Description</div>
      <div class="value ${metaDescription ? '' : 'empty'}">${
        metaDescription ? escapeHtml(metaDescription) : 'Missing'
      }</div>
    </div>
  `;
  reportEl.classList.remove('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = input.value.trim();
  if (!url) return;

  clearReport();
  setStatus('Auditing…', 'loading');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus(data.message || 'Something went wrong.', 'error');
      return;
    }

    setStatus('', '');
    renderReport(data);
  } catch (err) {
    setStatus('Network error — could not reach the audit server.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
