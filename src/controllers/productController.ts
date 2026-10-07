import { FastifyRequest, FastifyReply } from 'fastify';
import { productService } from '../services/productService.js';
import { categoryRepository } from '../repositories/categoryRepository.js';
import {
  listProductsQuerySchema,
  getProductParamsSchema,
  getProductBySlugSchema,
  createProductSchema,
  updateProductSchema,
  updateProductPriceSchema,
  updateProductStatusSchema,
} from '../schemas/product.schema.js';
import { formatSuccess, formatPaginated, formatError } from '../utils/response.js';

export class ProductController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listProductsQuerySchema.parse(request.query);
    const { products, total } = await productService.listProducts({
      page: query.page,
      limit: query.limit,
      categoryId: query.category_id,
      search: query.search,
      isActive: query.is_active ?? true,
    });

    const enriched = products.map((p) => ({
      ...p,
      package_info: productService.getPackageInfo(p, p.minimum_quantity),
    }));

    return reply.send(formatPaginated(enriched, total, query.page, query.limit));
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = getProductParamsSchema.parse(request.params);
    const product = await productService.getProductById(id);

    if (!product) {
      return reply.status(404).send(
        formatError('PRODUCT_NOT_FOUND', 'Produto não encontrado.', request.requestId)
      );
    }

    return reply.send(
      formatSuccess({
        ...product,
        package_info: productService.getPackageInfo(product, product.minimum_quantity),
      })
    );
  }

  async getBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = getProductBySlugSchema.parse(request.params);
    const product = await productService.getProductBySlug(slug);

    if (!product) {
      return reply.status(404).send(
        formatError('PRODUCT_NOT_FOUND', 'Produto não encontrado com este slug.', request.requestId)
      );
    }

    return reply.send(
      formatSuccess({
        ...product,
        package_info: productService.getPackageInfo(product, product.minimum_quantity),
      })
    );
  }

  async listCategories(_request: FastifyRequest, reply: FastifyReply) {
    const categories = await categoryRepository.findAll();
    return reply.send(formatSuccess(categories));
  }

  async listCategoryProducts(request: FastifyRequest, reply: FastifyReply) {
    const { id } = getProductParamsSchema.parse(request.params);
    const { products, total } = await productService.listProducts({
      categoryId: id,
      isActive: true,
    });
    return reply.send(formatPaginated(products, total, 1, total || 20));
  }

  // Admin Actions
  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createProductSchema.parse(request.body);
    const product = await productService.createProduct(body as any);
    return reply.status(201).send(formatSuccess(product));
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = getProductParamsSchema.parse(request.params);
    const body = updateProductSchema.parse(request.body);
    const updated = await productService.updateProduct(id, body as any);

    if (!updated) {
      return reply.status(404).send(
        formatError('PRODUCT_NOT_FOUND', 'Produto não encontrado para atualização.', request.requestId)
      );
    }

    return reply.send(formatSuccess(updated));
  }

  async updatePrice(request: FastifyRequest, reply: FastifyReply) {
    const { id } = getProductParamsSchema.parse(request.params);
    const body = updateProductPriceSchema.parse(request.body);
    const updated = await productService.updatePrice(id, body.price);

    if (!updated) {
      return reply.status(404).send(
        formatError('PRODUCT_NOT_FOUND', 'Produto não encontrado para atualização de preço.', request.requestId)
      );
    }

    return reply.send(formatSuccess(updated));
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = getProductParamsSchema.parse(request.params);
    const body = updateProductStatusSchema.parse(request.body);
    const updated = await productService.updateStatus(id, body.is_active);

    if (!updated) {
      return reply.status(404).send(
        formatError('PRODUCT_NOT_FOUND', 'Produto não encontrado para atualização de status.', request.requestId)
      );
    }

    return reply.send(formatSuccess(updated));
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = getProductParamsSchema.parse(request.params);
    const deleted = await productService.deleteProduct(id);

    if (!deleted) {
      return reply.status(404).send(
        formatError('PRODUCT_NOT_FOUND', 'Produto não encontrado para exclusão.', request.requestId)
      );
    }

    return reply.send(formatSuccess({ message: 'Produto excluído com sucesso.' }));
  }
}

export const productController = new ProductController();
