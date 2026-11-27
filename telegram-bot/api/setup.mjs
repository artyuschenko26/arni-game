import { createPublicKey, verify } from 'node:crypto';

const issuer = 'https://token.actions.githubusercontent.com';
const audience = 'arni-game-bot-webhook-setup';
const workflow = 'artyuschenko26/arni-game/.github/workflows/telegram-webhook.yml@refs/heads/main';

async function authorized(token) {
  const pieces = token.split('.');
  if (pieces.length !== 3 || token.length > 16000) return false;
  const [header, payload, signature] = pieces;
  const meta = JSON.parse(Buffer.from(header, 'base64url'));
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  const now = Math.floor(Date.now() / 1000);
  if (meta.alg !== 'RS256' || typeof meta.kid !== 'string' ||
      claims.iss !== issuer || claims.aud !== audience ||
      claims.repository_id !== '1470999236' || claims.repository_owner_id !== '357597473' ||
      claims.ref !== 'refs/heads/main' || claims.workflow_ref !== workflow ||
      !Number.isInteger(claims.exp) || claims.exp <= now ||
      !Number.isInteger(claims.nbf) || claims.nbf > now + 10) return false;

  const response = await fetch(issuer + '/.well-known/jwks', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return false;
  const { keys } = await response.json();
  const key = keys.find(candidate => candidate.kid === meta.kid && candidate.kty === 'RSA');
  return Boolean(key && verify('RSA-SHA256', Buffer.from(header + '.' + payload),
    createPublicKey({ key, format: 'jwk' }), Buffer.from(signature, 'base64url')));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const header = req.headers.authorization;
  try {
    if (typeof header !== 'string' || !header.startsWith('Bearer ') ||
        !await authorized(header.slice(7))) return res.status(401).end();
  } catch {
    return res.status(401).end();
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return res.status(503).end();
  return res.status(200).json({ secret });
}
