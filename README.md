<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c52569c0-5c49-4a46-a0c8-833c5a4d4b90

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Vercel / Central Database

This build supports Vercel Serverless Functions through `api/[...path].ts` and the more-specific `api/v1/[...path].ts` route.

For durable cross-browser users/offices/passwords, configure these **server-only** Vercel Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then run `supabase_schema.sql` once in the Supabase SQL Editor. The server will use `app_users`, `offices`, and `office_managers` as the central source of truth when these variables are configured. Without them, the application falls back to its local development JSON store; that fallback is not durable on Vercel.

Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_*` variable.
