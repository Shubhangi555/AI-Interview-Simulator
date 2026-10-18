/**
 * Vercel serverless entry point: the same Express app as local dev, as one function.
 * vercel.json rewrites every /api/* request here; Express routes on the original path.
 *
 * Only used in live mode (VITE_AI_MODE=live). In demo/mock mode the frontend never calls /api.
 * Configure the key in Vercel → Project → Settings → Environment Variables, never in code.
 */
import app from '../server/app.js';

export default app;
