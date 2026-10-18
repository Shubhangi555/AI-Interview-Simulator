import { getProvider } from './ai.js';
import app from './app.js';

/** Local dev entry point (`npm run dev` / `npm run dev:api`). On Vercel, api/index.ts serves the same app. */
const PORT = Number(process.env.PORT ?? 8787);

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  try {
    const p = getProvider();
    console.log(`[api] AI provider: ${p.name} (${p.model})`);
  } catch (err) {
    console.error(`[api] ${(err as Error).message}`);
  }
});
