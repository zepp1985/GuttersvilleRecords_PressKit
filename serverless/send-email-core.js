const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function parseJson(input) {
  try {
    return JSON.parse(input || '{}');
  } catch (error) {
    return null;
  }
}

function validatePayload(payload) {
  const errors = [];
  if (!payload.to) errors.push('Recipient email is required.');
  if (!payload.subject) errors.push('Email subject is required.');
  if (!payload.pdfBase64) errors.push('PDF attachment is required.');
  if (!process.env.RESEND_API_KEY) errors.push('Missing RESEND_API_KEY environment variable.');
  if (!process.env.RESEND_FROM_ADDRESS) errors.push('Missing RESEND_FROM_ADDRESS environment variable.');
  return errors;
}

function buildEmailHtml({ message, artistName, streamingUrl, website, socialLinks, contactEmail, contactPhone }) {
  const lines = [];
  if (message) {
    lines.push(`<p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>`);
  } else {
    lines.push('<p>Hi there,</p>');
    lines.push('<p>Please find the Guttersville Records press kit attached.</p>');
  }

  const detailRows = [];
  if (artistName) detailRows.push(`<li><strong>Artist:</strong> ${escapeHtml(artistName)}</li>`);
  const safeStreaming = streamingUrl ? normaliseUrl(streamingUrl) : null;
  if (safeStreaming) detailRows.push(`<li><strong>Streaming:</strong> <a href="${safeStreaming}">${safeStreaming}</a></li>`);
  const safeWebsite = website ? normaliseUrl(website) : null;
  if (safeWebsite) detailRows.push(`<li><strong>Website:</strong> <a href="${safeWebsite}">${safeWebsite}</a></li>`);
  if (Array.isArray(socialLinks) && socialLinks.length) {
    const links = socialLinks
      .map((link) => normaliseUrl(link))
      .filter(Boolean)
      .map((link) => `<a href="${link}">${link}</a>`)
      .join(', ');
    if (links) {
      detailRows.push(`<li><strong>Socials:</strong> ${links}</li>`);
    }
  }
  if (contactEmail) detailRows.push(`<li><strong>Email:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></li>`);
  if (contactPhone) detailRows.push(`<li><strong>Phone:</strong> ${escapeHtml(contactPhone)}</li>`);

  if (detailRows.length) {
    lines.push('<ul>' + detailRows.join('') + '</ul>');
  }

  lines.push('<p>— Guttersville Records</p>');
  return `<!doctype html><html><body style="font-family: Arial, sans-serif; color:#0f0f0f;">${lines.join('')}</body></html>`;
}

function normaliseUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch (error) {
    return null;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
}

async function sendEmail(payload) {
  const errors = validatePayload(payload);
  if (errors.length) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: errors.join(' ') }),
    };
  }

  const body = {
    from: process.env.RESEND_FROM_ADDRESS,
    to: [payload.to],
    subject: payload.subject,
    html: buildEmailHtml(payload),
    attachments: [
      {
        filename: payload.filename || 'guttersville-press-kit.pdf',
        content: payload.pdfBase64,
        contentType: 'application/pdf',
      },
    ],
  };

  if (payload.cc) {
    body.cc = [payload.cc];
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      const message = errorPayload?.message || errorPayload?.error || `Email provider error (${response.status})`;
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: message }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Unexpected error sending email.' }),
    };
  }
}

module.exports = {
  parseJson,
  sendEmail,
};
