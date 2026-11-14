/**
 * Strictly checks whether a URL (or bare hostname) targets a local loopback interface.
 * Prevents substring / suffix bypasses such as `http://localhost.evil.com` or `https://evil.com/127.0.0.1`.
 */
export declare function isLoopbackHostname(rawUrlOrHost: string): boolean;
export declare function normalizeBaseUrl(rawUrl: string): string;
//# sourceMappingURL=security.d.ts.map