const { parseJson, sendEmail } = require('../serverless/send-email-core');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload = parseJson(req.body && typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  if (!payload) {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  const response = await sendEmail(payload);
  res.status(response.statusCode).setHeader('Content-Type', 'application/json');
  res.send(response.body);
};
