import type { SubscriptionPlan } from '@drafter/shared';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderCheckoutSandboxHtml(params: {
  sessionId: string;
  email: string;
  plan: SubscriptionPlan;
  completed: boolean;
}): string {
  const quotaMillions = (params.plan.monthlyQuotaTokens / 1_000_000).toFixed(1);
  const featuresHtml = params.plan.features
    .map((feat) => `<li>${escapeHtml(feat)}</li>`)
    .join('\n          ');

  const btnText = params.completed
    ? 'Subscribed!'
    : 'Complete Subscription Payment';
  const btnDisabled = params.completed ? 'disabled' : '';
  const statusDisplay = params.completed ? 'block' : 'none';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Subscribe to ${escapeHtml(params.plan.name)} — Drafter Checkout</title>
  <link rel="icon" href="data:," />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      background: #f3f5f8;
      color: #111827;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 470px;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.05);
      padding: 28px 30px;
      border: 1px solid #e5e7eb;
    }
    .pill {
      display: inline-block;
      background: #e6f6ee;
      color: #0b8043;
      font-size: 12px;
      font-weight: 600;
      padding: 5px 11px;
      border-radius: 999px;
      margin-bottom: 14px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 10px;
    }
    .price-row {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 18px;
    }
    .price {
      font-size: 32px;
      font-weight: 800;
      color: #0f172a;
    }
    .period {
      font-size: 15px;
      color: #6b7280;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 13px 15px;
      font-size: 13px;
      line-height: 1.65;
      color: #334155;
      margin-bottom: 18px;
    }
    .meta-box code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      color: #0f172a;
    }
    ul {
      margin: 0 0 22px 18px;
      color: #475569;
      font-size: 14px;
      line-height: 1.7;
    }
    li + li { margin-top: 4px; }
    .btn {
      width: 100%;
      padding: 13px 18px;
      border: none;
      border-radius: 10px;
      background: #119950;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn:hover:not(:disabled) { background: #0d7f42; }
    .btn:disabled { opacity: 0.92; cursor: default; }
    .success-msg {
      display: ${statusDisplay};
      margin-top: 14px;
      color: #0b8043;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.45;
    }
    .error-msg {
      display: none;
      margin-top: 12px;
      color: #dc2626;
      font-size: 13px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main class="card">
    <span class="pill">Stripe-Compatible Checkout Simulator</span>
    <h1>Subscribe to ${escapeHtml(params.plan.name)}</h1>
    <div class="price-row">
      <span class="price">${escapeHtml(params.plan.priceLabel)}</span>
      <span class="period">/month</span>
    </div>
    <div class="meta-box">
      <div><strong>Account:</strong> ${escapeHtml(params.email)}</div>
      <div><strong>Monthly Quota:</strong> ${quotaMillions}M tokens</div>
      <div><strong>Session:</strong> <code>${escapeHtml(params.sessionId)}</code></div>
    </div>
    <ul>
      ${featuresHtml}
    </ul>
    <button id="complete-btn" class="btn" type="button" ${btnDisabled}>${btnText}</button>
    <p id="success-msg" class="success-msg">Subscription active! You can return to the Drafter extension tab and click Refresh Account.</p>
    <p id="error-msg" class="error-msg"></p>
  </main>
  <script>
    const btn = document.getElementById('complete-btn');
    const successMsg = document.getElementById('success-msg');
    const errorMsg = document.getElementById('error-msg');
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'Processing...';
      errorMsg.style.display = 'none';
      try {
        const res = await fetch('/api/billing/sandbox-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: ${JSON.stringify(params.sessionId)} })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Payment failed');
        btn.textContent = 'Subscribed!';
        successMsg.style.display = 'block';
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Complete Subscription Payment';
        errorMsg.textContent = err.message || 'Unable to complete payment.';
        errorMsg.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
}
