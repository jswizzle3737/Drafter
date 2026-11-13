import crypto from 'node:crypto';
import http from 'node:http';
import {
  analyzeWritingSamples,
  buildSandboxDraft,
  MODEL_CATALOG,
  splitSubjectAndBody,
  SUBSCRIPTION_PLANS,
  type ManagedUser,
  type SubscriptionTierId,
  type VaultPayload,
} from '@drafter/shared';
import { renderCheckoutSandboxHtml } from './checkoutHtml.js';
import { CompanionStore, type StoredUserRecord } from './store.js';

export interface DrafterServerOptions {
  port?: number;
  host?: string;
  dataFile?: string;
  jwtSecret?: string;
  stripeWebhookSecret?: string;
  openRouterApiKey?: string;
}

export interface DrafterServerInstance {
  server: http.Server;
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function signToken(userId: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, iat: Date.now() }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string, secret: string): { sub: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );
    return typeof parsed?.sub === 'string' ? { sub: parsed.sub } : null;
  } catch {
    return null;
  }
}

export function signStripeWebhookPayload(
  payload: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  let timestamp = '';
  const v1Sigs: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v ?? '';
    if (k === 'v1' && v) v1Sigs.push(v);
  }
  if (!timestamp || v1Sigs.length === 0) return false;

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  return v1Sigs.some((candidate) => {
    try {
      const candBuf = Buffer.from(candidate, 'hex');
      return (
        candBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(candBuf, expectedBuf)
      );
    } catch {
      return false;
    }
  });
}

function toPublicUser(user: StoredUserRecord): ManagedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tier: user.tier,
    status: user.status,
    monthlyQuotaTokens: user.monthlyQuotaTokens,
    usedTokens: user.usedTokens,
    pendingCheckoutUrl: user.pendingCheckoutUrl,
    pendingSessionId: user.pendingSessionId,
  };
}

function getPlan(tier: SubscriptionTierId) {
  return (
    SUBSCRIPTION_PLANS.find((p) => p.id === tier) ?? SUBSCRIPTION_PLANS[0]
  );
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, Stripe-Signature',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  });
  res.end(json);
}

export async function createDrafterServer(
  options: DrafterServerOptions = {}
): Promise<DrafterServerInstance> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 0;
  const jwtSecret =
    options.jwtSecret ??
    process.env.DRAFTER_JWT_SECRET ??
    'drafter-local-dev-jwt-secret';
  const stripeWebhookSecret =
    options.stripeWebhookSecret ??
    process.env.STRIPE_WEBHOOK_SECRET ??
    'whsec_drafter_sandbox_secret';
  const openRouterKey =
    options.openRouterApiKey ?? process.env.OPENROUTER_API_KEY ?? '';

  const store = new CompanionStore(options.dataFile);

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? `${host}:${port}`}`
    );
    const method = (req.method ?? 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, Stripe-Signature',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      });
      res.end();
      return;
    }

    if (reqUrl.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    const authenticate = (): StoredUserRecord | null => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) return null;
      const decoded = verifyToken(auth.slice(7).trim(), jwtSecret);
      if (!decoded) return null;
      return store.getUserById(decoded.sub) ?? null;
    };

    try {
      if (method === 'GET' && reqUrl.pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          mode: openRouterKey ? 'live' : 'sandbox',
          upstreamConfigured: Boolean(openRouterKey),
        });
        return;
      }

      if (method === 'POST' && reqUrl.pathname === '/api/auth/register') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const email = String(body.email ?? '').trim().toLowerCase();
        const name = String(body.name ?? '').trim() || email.split('@')[0] || 'User';
        const password = String(body.password ?? '');

        if (!email || !email.includes('@') || password.length < 6) {
          sendJson(res, 400, {
            error: 'Valid email and password (min 6 characters) are required.',
          });
          return;
        }
        if (store.getUserByEmail(email)) {
          sendJson(res, 409, { error: 'An account with this email already exists.' });
          return;
        }

        const user: StoredUserRecord = {
          id: `usr_${crypto.randomBytes(8).toString('hex')}`,
          name,
          email,
          passwordHash: hashPassword(password),
          tier: 'starter',
          status: 'inactive',
          monthlyQuotaTokens: 0,
          usedTokens: 0,
          createdAt: new Date().toISOString(),
        };
        store.saveUser(user);
        const token = signToken(user.id, jwtSecret);
        sendJson(res, 201, { token, user: toPublicUser(user) });
        return;
      }

      if (method === 'POST' && reqUrl.pathname === '/api/auth/login') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const email = String(body.email ?? '').trim().toLowerCase();
        const password = String(body.password ?? '');
        const user = store.getUserByEmail(email);
        if (!user || !verifyPassword(password, user.passwordHash)) {
          sendJson(res, 401, { error: 'Invalid email or password.' });
          return;
        }
        const token = signToken(user.id, jwtSecret);
        sendJson(res, 200, { token, user: toPublicUser(user) });
        return;
      }

      if (method === 'GET' && reqUrl.pathname === '/api/auth/me') {
        const user = authenticate();
        if (!user) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        sendJson(res, 200, { user: toPublicUser(user) });
        return;
      }

      if (method === 'POST' && reqUrl.pathname === '/api/billing/checkout') {
        const user = authenticate();
        if (!user) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        const body = JSON.parse((await readBody(req)) || '{}');
        const tier = body.tier === 'team' ? 'team' : body.tier === 'pro' ? 'pro' : null;
        if (!tier) {
          sendJson(res, 400, { error: 'Invalid tier; expected "pro" or "team".' });
          return;
        }

        const sessionId = `cs_sandbox_${crypto.randomBytes(8).toString('hex')}`;
        const forwardedProto =
          typeof req.headers['x-forwarded-proto'] === 'string'
            ? req.headers['x-forwarded-proto'].split(',')[0].trim()
            : '';
        const proto = forwardedProto === 'https' ? 'https' : 'http';
        const forwardedHost =
          typeof req.headers['x-forwarded-host'] === 'string'
            ? req.headers['x-forwarded-host'].split(',')[0].trim()
            : '';
        const reqHost = forwardedHost || req.headers.host || `${host}:${boundPort}`;
        const origin = `${proto}://${reqHost}`;
        const checkoutUrl = `${origin}/checkout-sandbox?session_id=${encodeURIComponent(sessionId)}`;

        store.saveCheckoutSession({
          sessionId,
          userId: user.id,
          tier,
          status: 'open',
          createdAt: new Date().toISOString(),
        });

        user.pendingCheckoutUrl = checkoutUrl;
        user.pendingSessionId = sessionId;
        store.saveUser(user);

        sendJson(res, 200, { sessionId, checkoutUrl, tier });
        return;
      }

      if (method === 'GET' && reqUrl.pathname === '/checkout-sandbox') {
        const sessionId = reqUrl.searchParams.get('session_id') ?? '';
        const session = store.getCheckoutSession(sessionId);
        if (!session) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Checkout session not found');
          return;
        }
        const user = store.getUserById(session.userId);
        const plan = getPlan(session.tier);
        const html = renderCheckoutSandboxHtml({
          sessionId: session.sessionId,
          email: user?.email ?? 'account@drafter.local',
          plan,
          completed: session.status === 'completed',
        });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (method === 'POST' && reqUrl.pathname === '/api/billing/sandbox-complete') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const sessionId = String(body.sessionId ?? '');
        const session = store.getCheckoutSession(sessionId);
        if (!session) {
          sendJson(res, 404, { error: 'Checkout session not found.' });
          return;
        }
        const user = store.getUserById(session.userId);
        if (!user) {
          sendJson(res, 404, { error: 'Account not found.' });
          return;
        }

        const plan = getPlan(session.tier);
        session.status = 'completed';
        store.saveCheckoutSession(session);

        user.tier = session.tier;
        user.status = 'active';
        user.monthlyQuotaTokens = plan.monthlyQuotaTokens;
        user.pendingCheckoutUrl = undefined;
        user.pendingSessionId = undefined;
        store.saveUser(user);

        sendJson(res, 200, { ok: true, user: toPublicUser(user) });
        return;
      }

      if (method === 'POST' && reqUrl.pathname === '/api/billing/webhook') {
        const rawBody = await readBody(req);
        const sigHeader = req.headers['stripe-signature'];
        const sigStr = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

        if (!verifyStripeSignature(rawBody, sigStr, stripeWebhookSecret)) {
          sendJson(res, 400, { error: 'Invalid Stripe-Signature header.' });
          return;
        }

        const event = JSON.parse(rawBody || '{}');
        const type = String(event.type ?? '');
        const obj = event.data?.object ?? {};

        if (type === 'checkout.session.completed') {
          const sessionId = String(obj.id ?? '');
          const session = store.getCheckoutSession(sessionId);
          const userId = session?.userId ?? String(obj.client_reference_id ?? '');
          const tier: SubscriptionTierId =
            obj.metadata?.tier === 'team'
              ? 'team'
              : session?.tier ?? 'pro';
          const user = userId ? store.getUserById(userId) : undefined;
          if (user) {
            const plan = getPlan(tier);
            user.tier = tier;
            user.status = 'active';
            user.monthlyQuotaTokens = plan.monthlyQuotaTokens;
            user.pendingCheckoutUrl = undefined;
            user.pendingSessionId = undefined;
            store.saveUser(user);
          }
          if (session) {
            session.status = 'completed';
            store.saveCheckoutSession(session);
          }
        } else if (type === 'customer.subscription.deleted') {
          const userId = String(obj.metadata?.userId ?? '');
          const user = userId ? store.getUserById(userId) : undefined;
          if (user) {
            user.tier = 'starter';
            user.status = 'canceled';
            user.monthlyQuotaTokens = 0;
            store.saveUser(user);
          }
        }

        sendJson(res, 200, { received: true });
        return;
      }

      if (method === 'POST' && reqUrl.pathname === '/api/billing/cancel') {
        const user = authenticate();
        if (!user) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        user.tier = 'starter';
        user.status = 'canceled';
        user.monthlyQuotaTokens = 0;
        user.pendingCheckoutUrl = undefined;
        user.pendingSessionId = undefined;
        store.saveUser(user);
        sendJson(res, 200, { user: toPublicUser(user) });
        return;
      }

      if (method === 'POST' && reqUrl.pathname === '/api/ai/draft') {
        const user = authenticate();
        if (!user) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        if (user.status !== 'active' || user.tier === 'starter') {
          sendJson(res, 403, {
            error: 'An active Drafter Pro or Team subscription is required for managed drafting.',
          });
          return;
        }

        const body = JSON.parse((await readBody(req)) || '{}');
        const model = String(body.model ?? 'anthropic/claude-sonnet-4.5');
        const modelMeta = MODEL_CATALOG.find((m) => m.id === model);
        if (modelMeta?.reasoningTier && user.tier !== 'team') {
          sendJson(res, 403, {
            error: `${modelMeta.shortLabel} requires a Drafter Team subscription.`,
          });
          return;
        }

        if (user.usedTokens >= user.monthlyQuotaTokens) {
          sendJson(res, 429, {
            error: 'Monthly managed token quota exceeded.',
          });
          return;
        }

        const start = performance.now();
        const systemPrompt = String(body.systemPrompt ?? '');
        const userPrompt = String(body.userPrompt ?? '');
        let rawContent = '';
        let totalTokens = 0;

        if (openRouterKey) {
          const upstream = await fetch(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openRouterKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                temperature: 0.4,
              }),
            }
          );
          if (!upstream.ok) {
            const errText = await upstream.text();
            sendJson(res, 502, {
              error: `Upstream OpenRouter error (${upstream.status}): ${errText.slice(0, 200)}`,
            });
            return;
          }
          const json = (await upstream.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { total_tokens?: number };
          };
          rawContent = json.choices?.[0]?.message?.content ?? '';
          totalTokens =
            json.usage?.total_tokens ??
            Math.max(
              320,
              Math.round(
                (systemPrompt.length + userPrompt.length + rawContent.length) / 4
              )
            );
        } else {
          rawContent = buildSandboxDraft({
            subject: String(body.subject ?? ''),
            recipient: body.recipient ? String(body.recipient) : undefined,
            instruction: String(body.instruction ?? ''),
            intent: String(body.intent ?? 'Email Reply'),
            model,
            refinement: body.refinementInstruction
              ? String(body.refinementInstruction)
              : undefined,
            previousDraft: body.previousDraft
              ? String(body.previousDraft)
              : undefined,
            authorName: String(body.authorName ?? user.name ?? 'Alex'),
            appliedPrecedentTitles: Array.isArray(body.appliedPrecedentTitles)
              ? body.appliedPrecedentTitles.map(String)
              : [],
            footerNote:
              'Drafter Managed Sandbox — configure OPENROUTER_API_KEY on companion server for live frontier models',
          });
          totalTokens = Math.max(
            480,
            Math.round(
              (systemPrompt.length + userPrompt.length + rawContent.length) / 3.4
            )
          );
        }

        const latencyMs = Math.max(1, Math.round(performance.now() - start));
        user.usedTokens = Math.min(
          user.monthlyQuotaTokens,
          user.usedTokens + totalTokens
        );
        store.saveUser(user);

        const parsed = splitSubjectAndBody(
          rawContent,
          String(body.subject ?? '')
        );
        sendJson(res, 200, {
          content: rawContent,
          subject: parsed.subject,
          body: parsed.body,
          model,
          provider: 'Drafter Managed Subscription',
          latencyMs,
          totalTokens,
          quotaRemaining: Math.max(0, user.monthlyQuotaTokens - user.usedTokens),
          user: toPublicUser(user),
          sandboxMode: !openRouterKey,
        });
        return;
      }

      if (method === 'POST' && reqUrl.pathname === '/api/ai/distill-voice') {
        const user = authenticate();
        if (!user) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        if (user.status !== 'active' || user.tier === 'starter') {
          sendJson(res, 403, {
            error: 'Active Drafter Pro or Team plan required.',
          });
          return;
        }
        const body = JSON.parse((await readBody(req)) || '{}');
        const samples = Array.isArray(body.samples) ? body.samples : [];
        const analysis = analyzeWritingSamples(samples);
        sendJson(res, 200, {
          summary: analysis.summary,
          analysis,
        });
        return;
      }

      if (method === 'PUT' && reqUrl.pathname === '/api/vault') {
        const user = authenticate();
        if (!user) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        if (user.status !== 'active' || user.tier === 'starter') {
          sendJson(res, 403, {
            error: 'Encrypted vault cloud sync requires Drafter Pro or Team.',
          });
          return;
        }
        const payload = JSON.parse((await readBody(req)) || '{}') as VaultPayload;
        const normalized: VaultPayload = {
          precedents: Array.isArray(payload.precedents) ? payload.precedents : [],
          writingSamples: Array.isArray(payload.writingSamples)
            ? payload.writingSamples
            : [],
          voiceProfile: payload.voiceProfile,
          sessions: Array.isArray(payload.sessions) ? payload.sessions : [],
          updatedAt: new Date().toISOString(),
        };
        store.saveVault(user.id, normalized);
        sendJson(res, 200, { ok: true, updatedAt: normalized.updatedAt });
        return;
      }

      if (method === 'GET' && reqUrl.pathname === '/api/vault') {
        const user = authenticate();
        if (!user) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        if (user.status !== 'active' || user.tier === 'starter') {
          sendJson(res, 403, {
            error: 'Encrypted vault cloud sync requires Drafter Pro or Team.',
          });
          return;
        }
        const vault = store.getVault(user.id) ?? null;
        sendJson(res, 200, { vault });
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  });

  let boundPort = port;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        boundPort = addr.port;
      }
      resolve();
    });
  });

  return {
    server,
    port: boundPort,
    baseUrl: `http://${host}:${boundPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
