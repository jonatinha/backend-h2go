import { Cart } from '../types/index.js';
import { cartRepository } from '../repositories/cartRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { productService } from './productService.js';
import { shippingService } from './shippingService.js';

export class CartService {
  async getCart(userId: string): Promise<Cart> {
    const shippingFee = await shippingService.getShippingFee();
    return cartRepository.getOrCreateActiveCart(userId, shippingFee);
  }

  async addItem(userId: string, productId: string, quantity: number): Promise<Cart> {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error('PROD_NOT_FOUND: Produto não encontrado.');
    }
    if (!product.is_active) {
      throw new Error('PROD_INACTIVE: Produto indisponível no momento.');
    }

    const validation = productService.validateQuantityRules(product, quantity);
    if (!validation.valid) {
      throw new Error(`INVALID_QTY: ${validation.error}`);
    }

    const shippingFee = await shippingService.getShippingFee();
    const cart = await cartRepository.getOrCreateActiveCart(userId, shippingFee);

    // Always use product price from DB (never client-supplied)
    await cartRepository.addItem(cart.id, product.id, quantity, product.price);

    return cartRepository.getOrCreateActiveCart(userId, shippingFee);
  }

  async updateItemQuantity(userId: string, itemId: string, quantity: number): Promise<Cart> {
    const shippingFee = await shippingService.getShippingFee();
    const cart = await cartRepository.getOrCreateActiveCart(userId, shippingFee);

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new Error('ITEM_NOT_FOUND: Item do carrinho não encontrado.');
    }

    const product = await productRepository.findById(item.product_id);
    if (!product) {
      throw new Error('PROD_NOT_FOUND: Produto não encontrado.');
    }

    const validation = productService.validateQuantityRules(product, quantity);
    if (!validation.valid) {
      throw new Error(`INVALID_QTY: ${validation.error}`);
    }

    await cartRepository.updateItemQuantity(itemId, cart.id, quantity);
    return cartRepository.getOrCreateActiveCart(userId, shippingFee);
  }

  async removeItem(userId: string, itemId: string): Promise<Cart> {
    const shippingFee = await shippingService.getShippingFee();
    const cart = await cartRepository.getOrCreateActiveCart(userId, shippingFee);
    await cartRepository.removeItem(itemId, cart.id);
    return cartRepository.getOrCreateActiveCart(userId, shippingFee);
  }

  async clearCart(userId: string): Promise<Cart> {
    const shippingFee = await shippingService.getShippingFee();
    const cart = await cartRepository.getOrCreateActiveCart(userId, shippingFee);
    await cartRepository.clearCart(cart.id);
    return cartRepository.getOrCreateActiveCart(userId, shippingFee);
  }

  async validateCart(userId: string): Promise<{
    isValid: boolean;
    errors: string[];
    cart: Cart;
  }> {
    const cart = await this.getCart(userId);
    const errors: string[] = [];

    if (cart.items.length === 0) {
      errors.push('O carrinho está vazio.');
    }

    for (const item of cart.items) {
      const product = await productRepository.findById(item.product_id);
      if (!product) {
        errors.push(`Produto ID ${item.product_id} não encontrado.`);
        continue;
      }
      if (!product.is_active) {
        errors.push(`O produto "${product.name}" não está mais ativo.`);
      }

      const val = productService.validateQuantityRules(product, item.quantity);
      if (!val.valid) {
        errors.push(val.error || `Quantidade inválida para o produto "${product.name}".`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      cart,
    };
  }
}

export const cartService = new CartService();
