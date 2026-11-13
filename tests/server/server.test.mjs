import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_PRECEDENTS,
  DEFAULT_VOICE_PROFILE,
  DEFAULT_WRITING_SAMPLES,
} from '@drafter/shared';
import {
  createDrafterServer,
  signStripeWebhookPayload,
} from '../../packages/server/dist/index.js';

test('Companion server full lifecycle: auth, sandbox checkout, Stripe webhook HMAC, AI quota & vault sync', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drafter-srv-'));
  const dataFile = path.join(tmpDir, 'store.json');
  const webhookSecret = 'whsec_test_hmac_123';

  const srv = await createDrafterServer({
    port: 0,
    host: '127.0.0.1',
    dataFile,
    stripeWebhookSecret: webhookSecret,
  });

  try {
    // 1. Health check
    const health = await fetch(`${srv.baseUrl}/health`);
    assert.equal(health.status, 200);
    const healthJson = await health.json();
    assert.equal(healthJson.ok, true);

    // 2. Register + login
    const regRes = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Rivera',
        email: 'alex@example.com',
        password: 'password123',
      }),
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.ok(regData.token);
    assert.equal(regData.user.tier, 'starter');

    const loginRes = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
      }),
    });
    assert.equal(loginRes.status, 200);
    const { token } = await loginRes.json();

    // Starter cannot draft on managed quota
    const blockedDraft = await fetch(`${srv.baseUrl}/api/ai/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ instruction: 'Hello' }),
    });
    assert.equal(blockedDraft.status, 403);

    // 3. Create sandbox checkout session & render checkout HTML
    const checkoutRes = await fetch(`${srv.baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tier: 'pro' }),
    });
    assert.equal(checkoutRes.status, 200);
    const { sessionId, checkoutUrl } = await checkoutRes.json();
    assert.ok(sessionId.startsWith('cs_sandbox_'));

    const pageRes = await fetch(checkoutUrl);
    assert.equal(pageRes.status, 200);
    const pageHtml = await pageRes.text();
    assert.ok(pageHtml.includes('Complete Subscription Payment'));

    // 4. Reject forged Stripe webhook HMAC
    const webhookPayload = JSON.stringify({
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, metadata: { tier: 'pro' } } },
    });
    const badWebhook = await fetch(`${srv.baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 't=12345,v1=deadbeef',
      },
      body: webhookPayload,
    });
    assert.equal(badWebhook.status, 400);

    // Accept valid Stripe webhook HMAC
    const validSig = signStripeWebhookPayload(webhookPayload, webhookSecret);
    const goodWebhook = await fetch(`${srv.baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': validSig,
      },
      body: webhookPayload,
    });
    assert.equal(goodWebhook.status, 200);

    const meRes = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meJson = await meRes.json();
    assert.equal(meJson.user.tier, 'pro');
    assert.equal(meJson.user.status, 'active');
    assert.equal(meJson.user.monthlyQuotaTokens, 2_000_000);

    // 5. Managed AI draft consumes quota & blocks Opus reasoning tier on Pro
    const opusDenied = await fetch(`${srv.baseUrl}/api/ai/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4.1',
        instruction: 'Draft reply',
      }),
    });
    assert.equal(opusDenied.status, 403);

    const draftRes = await fetch(`${srv.baseUrl}/api/ai/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        subject: 'Annual SaaS Renewal & Discount Request',
        instruction: 'Decline 25% discount and offer 10% for 24-month commitment.',
        appliedPrecedentTitles: ['SaaS Annual Renewal & Discount Pushback Policy'],
      }),
    });
    assert.equal(draftRes.status, 200);
    const draftJson = await draftRes.json();
    assert.ok(draftJson.totalTokens > 0);
    assert.ok(draftJson.quotaRemaining < 2_000_000);
    assert.ok(draftJson.body.length > 20);

    // 6. Vault cloud sync PUT + GET
    const putVault = await fetch(`${srv.baseUrl}/api/vault`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        precedents: DEFAULT_PRECEDENTS,
        writingSamples: DEFAULT_WRITING_SAMPLES,
        voiceProfile: DEFAULT_VOICE_PROFILE,
      }),
    });
    assert.equal(putVault.status, 200);

    const getVault = await fetch(`${srv.baseUrl}/api/vault`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(getVault.status, 200);
    const vaultJson = await getVault.json();
    assert.equal(vaultJson.vault.precedents.length, DEFAULT_PRECEDENTS.length);
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
