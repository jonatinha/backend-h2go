import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Integração Completa da API H2GO Smart', () => {
  let app: FastifyInstance;
  let authToken: string;
  let createdAddressId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health deve responder com status ok e uptime', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('h2go-api');
    expect(body.version).toBe('1.0.0');
  });

  it('GET /ready deve responder com ready: true', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.ready).toBe(true);
  });

  it('POST /api/v1/auth/register deve cadastrar usuário com sucesso', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `teste_${Date.now()}@exemplo.com`,
        password: 'password123',
        full_name: 'Cliente Ribeirão Branco',
        phone: '15998887766',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.role).toBe('customer');
    expect(body.data.session.access_token).toBeDefined();

    authToken = body.data.session.access_token;
  });

  it('GET /api/v1/products deve listar os 7 produtos oficiais da V1', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(7);

    // Verify 510ml item has package info
    const p510 = body.data.find((p: any) => p.sku === 'AGUA-510ML');
    expect(p510).toBeDefined();
    expect(p510.price).toBe(1.59);
    expect(p510.package_size).toBe(12);
  });

  it('GET /api/v1/products/slug/:slug deve buscar produto pelo slug oficial', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products/slug/agua-15l' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.sku).toBe('AGUA-15L');
    expect(body.data.price).toBe(2.49);
  });

  it('POST /api/v1/cart/items deve adicionar 2x Água 510 ml e calcular frete e total', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        product_id: 'b1000001-0000-0000-0000-000000000001', // Água 510ml R$ 1.59
        quantity: 2,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.subtotal).toBe(3.18); // 2 * 1.59
    expect(body.data.shipping_fee).toBe(4.98); // Frete Ribeirão Branco
    expect(body.data.total).toBe(8.16); // 3.18 + 4.98 = 8.16
  });

  it('POST /api/v1/cart/items deve rejeitar copo 200ml com quantidade inválida (ex: 3 unidades)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        product_id: 'b1000001-0000-0000-0000-000000000007', // Copo 200ml min 4, step 4
        quantity: 3,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_QTY');
  });

  it('POST /api/v1/addresses deve cadastrar endereço em Ribeirão Branco - SP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Cliente Teste',
        phone: '15998887766',
        cep: '18430000',
        street: 'Rua Principal',
        number: '100',
        neighborhood: 'Centro',
        city: 'Ribeirão Branco',
        state: 'SP',
        reference: 'Próximo à praça',
        is_default: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.city).toBe('Ribeirão Branco');
    createdAddressId = body.data.id;
  });

  it('POST /api/v1/addresses deve rejeitar cidade fora da área de cobertura', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/addresses',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Cliente Outra Cidade',
        phone: '11999990000',
        cep: '01001000',
        street: 'Av Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        is_default: false,
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('OUT_OF_COVERAGE');
  });

  it('POST /api/v1/orders deve criar pedido e suportar Idempotency-Key', async () => {
    const idempotencyKey = `idemp_${Date.now()}`;

    // 1st call
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      payload: {
        address_id: createdAddressId,
        payment_method: 'cash',
        notes: 'Troco para 50 reais',
      },
    });

    expect(res1.statusCode).toBe(201);
    const body1 = JSON.parse(res1.payload);
    expect(body1.success).toBe(true);
    expect(body1.data.status).toBe('pending');
    expect(body1.data.subtotal).toBe(3.18);
    expect(body1.data.total).toBe(8.16);
    expect(body1.data.payment.status).toBe('pending');

    const createdOrderId = body1.data.id;

    // 2nd call with same idempotency key: should return exact same order without duplication
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      payload: {
        address_id: createdAddressId,
        payment_method: 'cash',
      },
    });

    const body2 = JSON.parse(res2.payload);
    expect(body2.data.id).toBe(createdOrderId);
  });

  it('GET /ops deve carregar o painel visual HTML', async () => {
    const res = await app.inject({ method: 'GET', url: '/ops' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.payload).toContain('H2GO SMART');
  });

  it('Acesso de admin ao dashboard deve bloquear usuário comum sem role admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
