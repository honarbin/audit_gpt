RA Audit - Vercel single catch-all API fix

Changes:
- Replaced multiple/competing API entrypoints with one api/[...path].ts function.
- Removed rewrite-based /api routing and custom runtime configuration from vercel.json.
- Added GET /api/health health-check route in server.ts.
- Existing Express API routes remain in server.ts.

After replacing files in the existing GitHub repository, deploy to Vercel. Verify:
1) GET https://YOUR-DOMAIN/api/health returns {"ok":true}
2) In DevTools Network, POST /api/v1/auth/login should no longer return a platform-level 404.
3) POST /api/v1/realtime/broadcast is the Express route; opening it in a browser sends GET and is not a valid test. Test it with a POST request.

Important: this source patch has not been built or tested on the user's Vercel deployment. Keep the existing environment variables in Vercel; do not commit secrets.
