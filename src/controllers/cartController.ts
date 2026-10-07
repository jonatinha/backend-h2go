import { FastifyRequest, FastifyReply } from 'fastify';
import { cartService } from '../services/cartService.js';
import {
  addCartItemSchema,
  updateCartItemSchema,
  cartItemParamSchema,
} from '../schemas/cart.schema.js';
import { formatSuccess, formatError } from '../utils/response.js';

export class CartController {
  async getCart(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const cart = await cartService.getCart(request.user.id);
    return reply.send(formatSuccess(cart));
  }

  async addItem(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const body = addCartItemSchema.parse(request.body);
    const cart = await cartService.addItem(request.user.id, body.product_id, body.quantity);
    return reply.status(201).send(formatSuccess(cart));
  }

  async updateItem(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const { itemId } = cartItemParamSchema.parse(request.params);
    const body = updateCartItemSchema.parse(request.body);
    const cart = await cartService.updateItemQuantity(request.user.id, itemId, body.quantity);
    return reply.send(formatSuccess(cart));
  }

  async removeItem(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const { itemId } = cartItemParamSchema.parse(request.params);
    const cart = await cartService.removeItem(request.user.id, itemId);
    return reply.send(formatSuccess(cart));
  }

  async clearCart(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const cart = await cartService.clearCart(request.user.id);
    return reply.send(formatSuccess(cart));
  }

  async validateCart(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const result = await cartService.validateCart(request.user.id);
    return reply.send(formatSuccess(result));
  }
}

export const cartController = new CartController();
