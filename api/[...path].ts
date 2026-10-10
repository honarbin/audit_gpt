import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server';

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!appPromise) appPromise = createApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API] handler failure:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
