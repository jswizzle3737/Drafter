import http from 'node:http';
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
export declare function signStripeWebhookPayload(payload: string, secret: string, timestamp?: number): string;
export declare function createDrafterServer(options?: DrafterServerOptions): Promise<DrafterServerInstance>;
//# sourceMappingURL=server.d.ts.map