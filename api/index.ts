import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server.js';

let appPromise: ReturnType<typeof createApp> | null = null;

/**
 * Single Vercel entry point for all /api/* requests.
 * vercel.json rewrites /api/<path> to /api/index?path=<path>.
 * Rebuild the original Express URL before handing the request to Express.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const rewrittenPath = req.query?.path;
    if (typeof rewrittenPath === 'string' && rewrittenPath.trim()) {
      const safePath = rewrittenPath.replace(/^\/+/, '').replace(/\\/g, '/');
      const parsed = new URL(req.url || '/api/index', 'http://vercel.internal');
      parsed.searchParams.delete('path');
      const remainingQuery = parsed.searchParams.toString();
      req.url = `/api/${safePath}${remainingQuery ? `?${remainingQuery}` : ''}`;
    }

    if (!appPromise) appPromise = createApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[Vercel API] handler failure:', error);
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
