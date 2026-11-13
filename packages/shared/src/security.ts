const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Strictly checks whether a URL (or bare hostname) targets a local loopback interface.
 * Prevents substring / suffix bypasses such as `http://localhost.evil.com` or `https://evil.com/127.0.0.1`.
 */
export function isLoopbackHostname(rawUrlOrHost: string): boolean {
  const input = rawUrlOrHost.trim();
  if (!input) return false;

  // Reject whitespace or credentials inside URL authority tricks early
  try {
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)
      ? input
      : `http://${input}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return LOOPBACK_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function normalizeBaseUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  return `${parsed.protocol}//${parsed.host}`;
}
