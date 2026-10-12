import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server';

// One Vercel function handles every /api/* request. Keep the original URL so
// Express can match routes such as /api/v1/auth/login and /api/v1/realtime/broadcast.
let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!appPromise) appPromise = createApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API catch-all] handler failure:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'خطای داخلی سرور',
        },
      });
    }
  }
}
