import { buildApp } from './app.js';
import { env } from './config/env.js';

async function bootstrap() {
  try {
    const app = await buildApp();

    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    console.log(`
============================================================
🌊 H2GO SMART API - BACKEND INICIALIZADO COM SUCESSO!
============================================================
🚀 Servidor:      http://localhost:${env.PORT}
📖 Swagger Docs:  http://localhost:${env.PORT}/docs
🎛️ Painel /ops:   http://localhost:${env.PORT}/ops
💓 Health Check:  http://localhost:${env.PORT}/health
🌍 Ambiente:      ${env.NODE_ENV}
📍 Região:        Ribeirão Branco - SP (Frete: R$ ${env.SHIPPING_FEE_RIBEIRAO_BRANCO.toFixed(2)})
============================================================
`);
  } catch (err) {
    console.error('❌ Falha fatal ao iniciar o servidor:', err);
    process.exit(1);
  }
}

bootstrap();
