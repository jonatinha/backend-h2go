# Graph Report - h2go-api  (2026-10-27)

## Corpus Check
- 139 files · ~521,697 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 696 nodes · 1376 edges · 61 communities (26 shown, 34 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1c0f23ea`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- formatSuccess
- app.ts
- agencyController.ts
- package.json
- authController.ts
- Order
- adminController.ts
- 🌊 H2GO SMART — Backend API
- dependencies
- supabaseClient.ts
- compilerOptions
- paymentController.ts
- Product
- paymentService.ts
- Supabase
- isSupabaseConfigured
- Changelog
- Changelog
- Writing Guidelines for Postgres References
- cartController.ts
- addressController.ts
- productController.ts
- orderService.ts
- types/index.ts
- Section Definitions
- Supabase Postgres Best Practices
- LogsRepository
- vercel.json
- advanced-full-text-search.md
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- conn-limits.md
- conn-pooling.md
- conn-prepared-statements.md
- data-batch-inserts.md
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- query-missing-indexes.md
- query-partial-indexes.md
- schema-constraints.md
- schema-data-types.md
- schema-foreign-key-indexes.md
- schema-lowercase-identifiers.md
- schema-partitioning.md
- schema-primary-keys.md
- security-privileges.md
- security-rls-basics.md
- security-rls-performance.md
- _template.md

## God Nodes (most connected - your core abstractions)
1. `isSupabaseConfigured()` - 70 edges
2. `formatSuccess()` - 62 edges
3. `formatError()` - 54 edges
4. `fastify` - 28 edges
5. `buildApp()` - 21 edges
6. `Product` - 19 edges
7. `Order` - 19 edges
8. `AdminController` - 18 edges
9. `OrderRepository` - 15 edges
10. `ProductService` - 15 edges

## Surprising Connections (you probably didn't know these)
- `handler()` --calls--> `buildApp()`  [EXTRACTED]
  api/index.ts → src/app.ts
- `buildApp()` --indirect_call--> `errorHandler()`  [INFERRED]
  src/app.ts → src/middlewares/errorHandler.ts
- `buildApp()` --indirect_call--> `requestIdMiddleware()`  [INFERRED]
  src/app.ts → src/middlewares/requestId.ts
- `buildApp()` --indirect_call--> `requestLoggerHook()`  [INFERRED]
  src/app.ts → src/middlewares/requestLogger.ts
- `buildApp()` --indirect_call--> `addressRoutes()`  [INFERRED]
  src/app.ts → src/routes/addressRoutes.ts

## Import Cycles
- None detected.

## Communities (61 total, 34 thin omitted)

### Community 0 - "formatSuccess"
Cohesion: 0.06
Nodes (12): AddressController, AdminController, AgencyController, AuthController, CartController, OpsController, OrderController, PaymentController (+4 more)

### Community 1 - "app.ts"
Cohesion: 0.09
Nodes (32): handler(), fastify, buildApp(), __dirname, __filename, env, envSchema, parsed (+24 more)

### Community 2 - "agencyController.ts"
Cohesion: 0.10
Nodes (15): AgencyRepository, mapAgency(), agencyIdParamSchema, agencySlugParamSchema, CreateAgencyInput, createAgencySchema, ListAgenciesQuery, listAgenciesQuerySchema (+7 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (32): author, description, devDependencies, pino-pretty, tsx, @types/node, typescript, vitest (+24 more)

### Community 4 - "authController.ts"
Cohesion: 0.12
Nodes (15): supabaseAnon, ensureSupabase(), UserRepository, ForgotPasswordInput, forgotPasswordSchema, LoginInput, loginSchema, RefreshInput (+7 more)

### Community 5 - "Order"
Cohesion: 0.16
Nodes (10): OrderRepository, OrderService, FulfillmentType, Order, OrderStatus, addMoney(), formatMoney(), multiplyMoney() (+2 more)

### Community 6 - "adminController.ts"
Cohesion: 0.10
Nodes (14): HealthController, baseCreateOrderSchema, CreateOrderInput, createOrderSchema, ListOrdersQuery, listOrdersQuerySchema, orderIdParamSchema, orderStatusSchema (+6 more)

### Community 7 - "🌊 H2GO SMART — Backend API"
Cohesion: 0.07
Nodes (27): 1. Clonar e instalar dependências, 2. Configurar variáveis de ambiente, 3. Executar em modo desenvolvimento, 4. Compilar e executar em produção, 🛠️ Arquitetura e Stack, Autenticação (`/api/v1/auth`), Carrinho de Compras (`/api/v1/cart`), 📦 Catálogo Oficial V1 e Regras de Negócio (+19 more)

### Community 8 - "dependencies"
Cohesion: 0.07
Nodes (27): decimal.js, dotenv, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/static (+19 more)

### Community 9 - "supabaseClient.ts"
Cohesion: 0.16
Nodes (13): memoryAddresses, memoryAgencies, memoryCategories, INITIAL_CATEGORY, INITIAL_PRODUCTS, INITIAL_SETTINGS, memoryLogs, memoryOrderItems (+5 more)

### Community 10 - "compilerOptions"
Cohesion: 0.09
Nodes (22): dist, ES2022, node_modules, src/**/*, tests, compilerOptions, declaration, esModuleInterop (+14 more)

### Community 11 - "paymentController.ts"
Cohesion: 0.12
Nodes (6): CreatePaymentInput, createPaymentSchema, paymentIdParamSchema, PaymentProvider, PaymentService, PendingPaymentProvider

### Community 12 - "Product"
Cohesion: 0.20
Nodes (4): ProductService, PackageCalculation, Product, calculatePackage()

### Community 13 - "paymentService.ts"
Cohesion: 0.20
Nodes (8): memoryPaymentEvents, memoryPayments, PaymentRepository, CreatePaymentInput, PaymentResult, Payment, PaymentMethod, PaymentStatus

### Community 14 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 15 - "isSupabaseConfigured"
Cohesion: 0.18
Nodes (5): CartRepository, CategoryRepository, ProductRepository, isSupabaseConfigured(), Category

### Community 16 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 17 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 18 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 19 - "cartController.ts"
Cohesion: 0.20
Nodes (7): AddCartItemInput, addCartItemSchema, cartItemParamSchema, UpdateCartItemInput, updateCartItemSchema, CartService, Cart

### Community 20 - "addressController.ts"
Cohesion: 0.21
Nodes (7): AddressRepository, addressIdParamSchema, CreateAddressInput, createAddressSchema, UpdateAddressInput, updateAddressSchema, Address

### Community 21 - "productController.ts"
Cohesion: 0.20
Nodes (12): CreateProductInput, createProductSchema, getProductBySlugSchema, getProductParamsSchema, ListProductsQuery, listProductsQuerySchema, UpdateProductInput, UpdateProductPriceInput (+4 more)

### Community 22 - "orderService.ts"
Cohesion: 0.20
Nodes (4): SettingsRepository, CreateOrderPayload, ShippingService, SystemSetting

### Community 23 - "types/index.ts"
Cohesion: 0.22
Nodes (9): memoryCartItems, memoryCarts, ApiErrorDetail, CartItem, CartStatus, fastify, FastifyRequest, OrderItem (+1 more)

### Community 24 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 25 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

## Knowledge Gaps
- **212 isolated node(s):** `name`, `version`, `description`, `main`, `dev` (+207 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 271 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastify` connect `app.ts` to `agencyController.ts`, `package.json`, `authController.ts`, `adminController.ts`, `paymentController.ts`, `cartController.ts`, `addressController.ts`, `productController.ts`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `keywords` connect `package.json` to `app.ts`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `isSupabaseConfigured()` connect `isSupabaseConfigured` to `formatSuccess`, `app.ts`, `agencyController.ts`, `authController.ts`, `Order`, `adminController.ts`, `supabaseClient.ts`, `Product`, `paymentService.ts`, `addressController.ts`, `orderService.ts`, `types/index.ts`, `LogsRepository`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `buildApp()` (e.g. with `errorHandler()` and `requestIdMiddleware()`) actually correct?**
  _`buildApp()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _212 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `formatSuccess` be split into smaller, more focused modules?**
  _Cohesion score 0.05886708626434654 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09427609427609428 - nodes in this community are weakly interconnected._