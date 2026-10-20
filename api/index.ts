import { buildApp } from '../src/app.js';

let appPromise: ReturnType<typeof buildApp> | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!appPromise) {
      appPromise = buildApp();
    }

    const app = await appPromise;
    await app.ready();
    app.server.emit('request', req, res);
  } catch (err: any) {
    console.error('VERCEL_HANDLER_ERROR:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: {
        code: 'HANDLER_ERROR',
        message: err?.message || 'Serverless invocation error',
        stack: err?.stack
      }
    }));
  }
}