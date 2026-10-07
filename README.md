# 🌊 H2GO SMART — Backend API

API Backend profissional, escalável e segura para o ecossistema **H2GO SMART**, plataforma de e-commerce de águas minerais e produtos relacionados, inicialmente voltada para a região de **Ribeirão Branco - SP**.

Construída com **Node.js 22**, **TypeScript**, **Fastify**, **Supabase (PostgreSQL + Auth)**, **Zod**, **Swagger/OpenAPI**, **Vitest** e painel operacional visual **/ops**.

---

## 📋 Sumário
1. [Arquitetura e Stack](#-arquitetura-e-stack)
2. [Estrutura do Projeto](#-estrutura-do-projeto)
3. [Instalação e Execução Local](#-instalação-e-execução-local)
4. [Configuração do Supabase e Migrations](#-configuração-do-supabase-e-migrations)
5. [Catálogo Oficial V1 e Regras de Negócio](#-catálogo-oficial-v1-e-regras-de-negócio)
6. [Rotas e Endpoints da API](#-rotas-e-endpoints-da-api)
7. [Painel de Operação e Debug (/ops)](#-painel-de-operação-e-debug-ops)
8. [Documentação Swagger OpenAPI (/docs)](#-documentação-swagger-openapi-docs)
9. [Segurança e Row Level Security (RLS)](#-segurança-e-row-level-security-rls)
10. [Testes Automatizados](#-testes-automatizados)
11. [Execução via Docker](#-execução-via-docker)

---

## 🛠️ Arquitetura e Stack

- **Linguagem & Runtime:** Node.js (v22.x) com TypeScript 5 (Strict mode)
- **Framework Web:** Fastify 4 (Alto desempenho, baixo overhead, plugins nativos)
- **Banco de Dados & Autenticação:** Supabase (PostgreSQL 15+ & Supabase Auth)
- **Validação de Dados:** Zod (Validação rigorosa de payloads, query parameters e headers)
- **Precisão Monetária:** Decimal.js (Eliminação absoluta de erros de arredondamento IEEE 754)
- **Documentação Interativa:** Swagger UI / OpenAPI 3.0 em `/docs`
- **Observabilidade & Debug:** Painel visual exclusivo em `/ops` + Logs com Request ID único
- **Segurança:** CORS configurável, Helmet, Rate Limiting (600 req/min), Cookie seguro, Sanitização de logs
- **Testes Automatizados:** Vitest com 100% de aprovação em testes unitários e de integração

---

## 📁 Estrutura do Projeto

```text
h2go-api/
├── src/
│   ├── config/             # Configurações de ambiente tipadas com Zod (.env)
│   ├── controllers/        # Controladores REST com injeção de dependência
│   ├── routes/             # Definição e registro de rotas versionadas (/api/v1)
│   ├── services/           # Regras de negócio puras (carrinho, frete, pedidos, pagamentos)
│   ├── repositories/       # Abstração de dados Supabase com fallback inteligente
│   ├── schemas/            # Schemas Zod de entrada e saída
│   ├── middlewares/        # requireAuth, requireAdmin, requestId, errorHandler, requestLogger
│   ├── modules/            # Módulos desacoplados (auth, products, cart, orders, etc.)
│   ├── plugins/            # Plugins Fastify (Swagger, CORS, Helmet, Static)
│   ├── utils/              # Decimal money, cálculo de fardos, formatadores
│   ├── types/              # Tipos TypeScript do domínio
│   ├── public/ops/         # Interface SPA do Painel de Operação /ops (HTML/CSS/JS)
│   ├── app.ts              # Fábrica do Fastify (buildApp)
│   └── server.ts           # Inicialização e escuta da porta
│
├── supabase/
│   ├── migrations/         # 12 Migrations SQL completas e ordenadas
│   └── seed.sql            # Seed oficial dos produtos da V1
│
├── tests/
│   ├── unit/               # Testes de regras de negócio (copos, fardos, decimais)
│   └── integration/        # Testes de integração de rotas e fluxo completo
│
├── Dockerfile              # Imagem Docker multi-stage otimizada
├── docker-compose.yml      # Orquestração de containers
├── package.json
└── tsconfig.json
```

---

## 🚀 Instalação e Execução Local

### Pré-requisitos
- Node.js 22.x ou superior
- npm 10.x ou superior

### 1. Clonar e instalar dependências
```bash
cd h2go-api
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:
```ini
PORT=3000
NODE_ENV=development
API_PREFIX=/api/v1
CORS_ORIGIN=*

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-privada
DATABASE_URL=postgresql://postgres:sua-senha@db.seu-projeto.supabase.co:5432/postgres

# Autenticação
JWT_SECRET=sua-chave-secreta-jwt-de-alta-entropia-32-chars

# Painel /ops
OPS_ADMIN_USERNAME=admin
OPS_ADMIN_PASSWORD=admin-h2go-smart-change-me

# Configurações Padrão
STORE_NAME=H2GO Smart
STORE_CITY=Ribeirão Branco
STORE_STATE=SP
SHIPPING_FEE_RIBEIRAO_BRANCO=4.98
```

> **Nota de Resiliência:** Caso você inicie a API sem configurar o Supabase, ela entrará automaticamente em **Modo Fallback Local**, permitindo testar rotas, carrinho, cálculo de frete, painel `/ops` e catálogo sem falhar!

### 3. Executar em modo desenvolvimento
```bash
npm run dev
```

### 4. Compilar e executar em produção
```bash
npm run build
npm start
```

---

## 🗄️ Configuração do Supabase e Migrations

No painel do seu projeto Supabase (**SQL Editor**), execute as migrations localizadas na pasta `supabase/migrations/` na ordem numérica:

1. `001_extensions.sql` — Habilita `uuid-ossp` e `pgcrypto`.
2. `002_profiles.sql` — Cria tabela de perfis de usuário com trigger automático vinculado ao Supabase Auth.
3. `003_categories.sql` — Cria tabela de categorias.
4. `004_products.sql` — Cria tabela de produtos com colunas numéricas de precisão e regras de pacote/step.
5. `005_carts.sql` — Cria tabelas `carts` e `cart_items`.
6. `006_addresses.sql` — Cria tabela de endereços com suporte a endereço padrão.
7. `007_orders.sql` — Cria `orders` e `order_items` com snapshot permanente de preços.
8. `008_payments.sql` — Cria `payments` e `payment_events` para o motor de pagamentos desacoplado.
9. `009_logs.sql` — Cria `api_logs` com indexação para o monitor do painel `/ops`.
10. `010_settings.sql` — Cria tabela `system_settings` com valores iniciais da loja.
11. `011_seed_products.sql` — Popula a categoria `Águas` e os 7 produtos oficiais da V1.
12. `012_rls.sql` — Ativa e define políticas de Row Level Security (RLS) granulares para clientes e administradores.

---

## 📦 Catálogo Oficial V1 e Regras de Negócio

Os 7 produtos oficiais da V1 cadastrados no seed e validados pela API:

| # | Produto | Preço | SKU | Min Qty | Step | Fardo Fechado |
|---|---|---|---|---|---|---|
| 1 | **Água Cristal 510 ml** | R$ 1,59 | `AGUA-510ML` | 1 | 1 | 12 unidades = 1 fardo |
| 2 | **Água Cristal 510 ml com gás** | R$ 1,99 | `AGUA-510ML-GAS` | 1 | 1 | 12 unidades = 1 fardo |
| 3 | **Água 1,5 L** | R$ 2,49 | `AGUA-15L` | 1 | 1 | 6 unidades = 1 fardo |
| 4 | **Água 5 L** | R$ 7,49 | `AGUA-5L` | 1 | 1 | 2 unidades = 1 fardo |
| 5 | **Galão 20 L (refil)** | R$ 8,99 | `GALAO-20L-REFIL` | 1 | 1 | - |
| 6 | **Galão 20 L + casco** | R$ 34,90 | `GALAO-20L-CASCO` | 1 | 1 | - |
| 7 | **Água 200 ml (copo)** | R$ 0,99 | `AGUA-200ML-COPO` | **4** | **4** (máx 48) | - |

### Regras de Negócio Fundamentais:
1. **Regra Estrita do Copo 200 ml:** Venda exclusivamente em múltiplos de 4 unidades (mínimo 4, máximo 48). Quantidades como 3, 5, 6, 7, 9 ou 52 são imediatamente rejeitadas com erro `INVALID_QTY`.
2. **Identificação de Fardos:** Quando a quantidade atinge um fardo completo (ex: 24 unidades da água 510ml), a API calcula informativamente `packages: 2` e `package_description: "2 fardos fechados"`. Na V1, nenhum desconto é aplicado automaticamente.
3. **Frete Fixo Ribeirão Branco:** R$ 4,98 dinâmico gerenciado via `system_settings` (`SHIPPING_FEE`). Apenas endereços em Ribeirão Branco - SP são aceitos na V1.
4. **Proteção de Preços:** O frontend **NUNCA** informa o preço ou subtotal. A API consulta diretamente o banco de dados e calcula valores com precisão Decimal.
5. **Snapshot no Pedido:** O pedido salva uma cópia imutável de `product_name`, `sku`, `unit_price`, `quantity` e `subtotal`. Caso o preço do produto mude no futuro, os pedidos antigos permanecem inalterados.
6. **Idempotência de Pedidos:** Suporte ao cabeçalho `Idempotency-Key` no checkout. Se a rede oscilar e o cliente enviar a mesma chave, a API retorna o mesmo pedido sem duplicar compras.

---

## 🔌 Rotas e Endpoints da API

Todos os endpoints públicos utilizam o prefixo versionado `/api/v1/`:

### Autenticação (`/api/v1/auth`)
- `POST /register` — Cadastro de usuário
- `POST /login` — Autenticação via Supabase Auth
- `POST /logout` — Encerramento de sessão
- `POST /refresh` — Renovação de token
- `POST /forgot-password` — Solicitação de recuperação de senha
- `GET /me` — Perfil do usuário autenticado

### Produtos e Categorias (`/api/v1/products` e `/categories`)
- `GET /products` — Listagem paginada com filtros
- `GET /products/:id` — Detalhes do produto por ID
- `GET /products/slug/:slug` — Busca por slug amigável
- `GET /categories` — Listagem de categorias ativas
- `GET /categories/:id/products` — Produtos de uma categoria

### Carrinho de Compras (`/api/v1/cart`)
- `GET /cart` — Consulta carrinho ativo com subtotal, frete e total
- `POST /cart/items` — Adiciona produto (valida regras de múltiplos)
- `PATCH /cart/items/:itemId` — Atualiza quantidade
- `DELETE /cart/items/:itemId` — Remove item
- `DELETE /cart` — Esvazia o carrinho
- `POST /cart/validate` — Validação completa de preços e disponibilidade

### Endereços (`/api/v1/addresses`)
- `GET /addresses` — Lista endereços do usuário
- `POST /addresses` — Cadastra endereço (valida cobertura Ribeirão Branco)
- `GET /addresses/:id` — Detalhes do endereço
- `PATCH /addresses/:id` — Atualização de endereço
- `DELETE /addresses/:id` — Remoção de endereço

### Pedidos (`/api/v1/orders`)
- `POST /orders` — Checkout transacional (converte carrinho, cria itens e pagamento pendente)
- `GET /orders` — Lista histórico de pedidos do cliente autenticado
- `GET /orders/:id` — Detalhes do pedido (isolamento rigoroso por usuário)
- `POST /orders/:id/cancel` — Cancelamento pelo cliente (apenas pedidos pending/confirmed)

### Motor de Pagamentos (`/api/v1/payments`)
- `POST /payments/create` — Intenção de pagamento
- `GET /payments/:id` — Consulta de pagamento
- `POST /payments/webhook` — Webhook genérico desacoplado de gateway

### Área Administrativa (`/api/v1/admin`) — Requer `role = admin`
- `GET /admin/dashboard` — Métricas gerenciais completas
- `GET /admin/users` — Listagem de usuários
- `GET /admin/orders` — Listagem geral de pedidos
- `GET /admin/orders/:id` — Detalhes completos do pedido
- `PATCH /admin/orders/:id/status` — Atualização de status (preparing, out_for_delivery, delivered)
- `GET /admin/products` — Gestão de catálogo
- `POST /admin/products` — Criação de novo produto
- `PATCH /admin/products/:id` — Edição de produto
- `PATCH /admin/products/:id/price` — Atualização de preço
- `PATCH /admin/products/:id/status` — Ativação/Desativação
- `GET /admin/logs` — Consulta detalhada de logs com filtros
- `GET /admin/system` — Configurações do sistema
- `POST /admin/system` — Atualização de configurações
- `GET /admin/health` — Métricas avançadas de saúde do servidor

### Checagem de Saúde
- `GET /health` — Status da API, uptime e conectividade
- `GET /ready` — Verificação de prontidão para tráfego

---

## 🎛️ Painel de Operação e Debug (/ops)

Acesse no navegador:
👉 **`http://localhost:3000/ops`**

O painel `/ops` é uma interface visual profissional para monitoramento em tempo real:
- **Protegido por Autenticação Administrativa:** Nunca acessível publicamente ou via query string insegura.
- **Views integradas na SPA:**
  - 📊 **Dashboard:** Badges de API, Banco e Supabase, contadores de usuários, produtos, pedidos por status e tempo médio de resposta.
  - ⚡ **Requests:** Log de requisições com filtro por método HTTP e faixa de status (2xx, 4xx, 5xx), tempo em ms e Request ID.
  - 🚨 **Erros:** Lista detalhada de falhas com modal para inspecionar stack trace e payload.
  - 📦 **Produtos:** Ações rápidas de ativação/desativação e visualização de preços.
  - 🛒 **Pedidos:** Acompanhamento e alteração rápida de status do fluxo de entrega.
  - 👥 **Usuários:** Perfis e papéis cadastrados.
  - 🗄️ **Banco & Supabase:** Diagnóstico de conectividade e status dos serviços.
  - 💓 **Saúde:** Consumo de memória (RSS, Heap), uptime e versões.
  - ⚙️ **Configurações:** Edição ao vivo de frete e regras em `system_settings`.

---

## 📖 Documentação Swagger OpenAPI (/docs)

Acesse a documentação interativa Swagger:
👉 **`http://localhost:3000/docs`**

- Todos os endpoints documentados com schemas Zod.
- Botão **"Authorize"** com suporte a Bearer Token JWT para testar rotas autenticadas diretamente pelo navegador.
- Exemplos de requisição e resposta com códigos de erro descritivos.

---

## 🔒 Segurança e Row Level Security (RLS)

1. **Service Role Isolada:** A chave de serviço do Supabase é utilizada exclusivamente no backend Node.js.
2. **Políticas RLS Ativas:**
   - Usuários comuns acessam e modificam exclusivamente seus próprios dados (carrinhos, perfis, endereços e pedidos).
   - Administradores possuem políticas de gerenciamento em produtos, configurações e pedidos gerais.
3. **Logs Sanitizados:** Senhas, tokens JWT, Authorization headers e chaves sensíveis nunca são gravados nos logs.
4. **Tratamento de Erros:** Em ambiente de produção (`NODE_ENV=production`), mensagens internas e stack traces são ocultados do cliente.

---

## 🧪 Testes Automatizados

A API conta com suíte de testes no **Vitest** cobrindo cálculo financeiro, regras de pacotes, copo de 200ml, fluxos de carrinho, idempotência e permissões:

```bash
# Executar todos os testes
npm run test

# Executar testes em modo interativo (watch)
npm run test:watch
```

**Resultado dos testes:**
- ✅ `tests/unit/fardo.test.ts` (6 testes aprovados)
- ✅ `tests/unit/productRules.test.ts` (7 testes aprovados — regra dos copos 200ml)
- ✅ `tests/unit/decimal.test.ts` (5 testes aprovados — cálculos sem erro de float)
- ✅ `tests/integration/api.test.ts` (12 testes aprovados — fluxo e idempotência)
- **Total: 30 testes passando com 100% de sucesso!**

---

## 🐳 Execução via Docker

Para rodar a API encapsulada em container Docker:

```bash
# Construir e subir container em background
docker compose up -d --build

# Ver logs do container
docker compose logs -f api

# Parar container
docker compose down
```

---

Desenvolvido para o ecossistema **H2GO SMART**.
