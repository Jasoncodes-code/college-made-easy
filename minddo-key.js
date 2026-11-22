'use strict';

const fs = require('node:fs');
const path = require('node:path');

let cachedKey;
let pendingRequest;

class MindDoKeyError extends Error {
  constructor(message, fix) {
    super(message);
    this.name = 'MindDoKeyError';
    this.fix = fix;
    // A server route can send this to the screen without exposing the key.
    this.screenMessage = message;
  }
}

function loadLocalEnv() {
  // Vercel has no committed .env file; online values must come from its settings.
  if (process.env.VERCEL === '1') return {};
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};

  const localValues = {};

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) {
      const value = match[2].replace(/^['"]|['"]$/g, '');
      localValues[match[1]] = value;
      if (process.env[match[1]] === undefined || process.env[match[1]] === 'paste-here') {
        process.env[match[1]] = value;
      }
    }
  }

  return localValues;
}

function getConfig() {
  const localValues = loadLocalEnv();
  const urlValue = process.env.VERCEL === '1' ? process.env.KEYGEN_URL : (localValues.KEYGEN_URL || process.env.KEYGEN_URL);
  const tokenValue = process.env.VERCEL === '1' ? process.env.KEYGEN_TOKEN : (localValues.KEYGEN_TOKEN || process.env.KEYGEN_TOKEN);
  const url = (urlValue || '').replace(/\/+$/, '');
  const token = tokenValue || '';

  if (!url || url === 'paste-here' || !token || token === 'paste-here') {
    throw new MindDoKeyError(
      'AI connection is not configured yet.',
      'Put KEYGEN_URL and KEYGEN_TOKEN in the server .env file.'
    );
  }

  return { url, token };
}

function isUsable(cached) {
  return cached && cached.apiKey && Number.isFinite(cached.expiresAt) && Date.now() < cached.expiresAt;
}

async function requestNewKey() {
  const { url, token } = getConfig();
  let response;
  let body;

  try {
    response = await fetch(`${url}/api/lookup-key`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    body = await response.json();
  } catch (error) {
    const message = 'The AI key service could not be reached.';
    const fix = `Check KEYGEN_URL and the server network connection. ${error.message}`;
    console.error(fix);
    throw new MindDoKeyError(message, fix);
  }

  if (!response.ok || body?.error) {
    const message = body?.error?.message || 'The AI key service returned an error.';
    const fix = body?.error?.fix || 'Check the MindDo configuration and try again.';
    console.error(fix);
    throw new MindDoKeyError(message, fix);
  }

  const expiresAt = Date.parse(body?.expiresAt || '');
  if (!body?.apiKey || !Number.isFinite(expiresAt)) {
    const message = 'The AI key service returned an invalid response.';
    const fix = 'MindDo must return apiKey and a valid expiresAt value.';
    console.error(fix);
    throw new MindDoKeyError(message, fix);
  }

  return { apiKey: body.apiKey, expiresAt };
}

// Server-only: callers should pass the returned key directly to their AI client.
// Set forceRefresh after OpenAI rejects a key; the wrapper below does this for you.
async function getKey({ forceRefresh = false } = {}) {
  if (!forceRefresh && isUsable(cachedKey)) return cachedKey.apiKey;
  if (pendingRequest) return pendingRequest;

  pendingRequest = requestNewKey()
    .then((nextKey) => {
      cachedKey = nextKey;
      return nextKey.apiKey;
    })
    .finally(() => {
      pendingRequest = undefined;
    });

  return pendingRequest;
}

function isOpenAIKeyRejection(error) {
  return error?.status === 401 || error?.status === 403 ||
    error?.code === 'invalid_api_key' || error?.code === 'authentication_error';
}

// Run one server-side AI call and refresh the MindDo key once if OpenAI rejects it.
async function withKey(callOpenAI) {
  let key = await getKey();

  try {
    return await callOpenAI(key);
  } catch (error) {
    if (!isOpenAIKeyRejection(error)) throw error;
    cachedKey = undefined;
    key = await getKey({ forceRefresh: true });
    return callOpenAI(key);
  }
}

module.exports = { getKey, withKey, MindDoKeyError };
