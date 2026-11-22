'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { withKey } = require('./minddo-key');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);

function readFile(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

function getModel() {
  const notes = readFile('NOTES.md');
  const match = notes.match(/OpenAI model available:\s*([^\s]+)/i);
  return match ? match[1] : 'gpt-4o-mini';
}

function getSystemInstructions() {
  const brief = readFile('BRIEF.md');
  const start = brief.indexOf('## My AI’s instructions');
  const instructions = start >= 0 ? brief.slice(start) : brief;
  return `${instructions}\n\nSafety reminder: do not request passwords or private information. If facts are uncertain, say so and direct the student to the official college website.`;
}

function sendJson(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  response.end(text);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) reject(new Error('Request is too large.'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Please enter a major and try again.')); }
    });
    request.on('error', reject);
  });
}

function isOpenAiRejection(status, errorCode) {
  return status === 401 || status === 403 || errorCode === 'invalid_api_key' || errorCode === 'authentication_error';
}

async function askOpenAI({ major, filters }) {
  const userMessage = [
    `Find colleges for a high school student interested in this major: ${major}`,
    `Filters: state=${filters.state || 'Any'}, cost=${filters.cost || 'Any'}, size=${filters.size || 'Any'}.`,
    'Return JSON only in this shape: {"summary":"short summary","colleges":[{"name":"","location":"","major":"","cost":"","size":"","officialUrl":"","bullets":["recommendation reason","major/program fact","important thing to verify"]}]}. Include two or three options when possible, put recommendations first, and use bullet points inside each college object. Do not invent facts; use "Needs checking" when unsure.',
  ].join('\n');

  return withKey(async (apiKey) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          { role: 'system', content: getSystemInstructions() },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || 'The AI could not answer right now.');
      error.status = response.status;
      error.code = body?.error?.code;
      if (isOpenAiRejection(response.status, error.code)) error.code = 'invalid_api_key';
      throw error;
    }
    return body?.choices?.[0]?.message?.content || 'The AI did not return an answer. Please try again.';
  });
}

function serveStatic(request, response) {
  const requested = request.url === '/' ? '/index.html' : request.url;
  const safePath = path.normalize(requested.split('?')[0]).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(response, 404, { error: 'Not found' });
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  if (!types[ext] || !fs.existsSync(filePath)) return sendJson(response, 404, { error: 'Not found' });
  response.writeHead(200, { 'Content-Type': `${types[ext]}; charset=utf-8` });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/api/ask') {
    try {
      const body = await readJson(request);
      const major = String(body.major || '').trim();
      if (!major) return sendJson(response, 400, { error: 'Type a major first.' });
      const answer = await askOpenAI({ major, filters: body.filters || {} });
      return sendJson(response, 200, { answer });
    } catch (error) {
      const message = error.screenMessage || error.message || 'Please check the internet and try again.';
      return sendJson(response, 502, { error: message });
    }
  }
  if (request.method === 'GET') return serveStatic(request, response);
  return sendJson(response, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`College made easy is running at http://localhost:${PORT}`);
});
