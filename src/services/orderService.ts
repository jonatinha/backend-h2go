import { Order, OrderStatus, PaymentMethod } from '../types/index.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { cartRepository } from '../repositories/cartRepository.js';
import { addressRepository } from '../repositories/addressRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { paymentRepository } from '../repositories/paymentRepository.js';
import { shippingService } from './shippingService.js';
import { productService } from './productService.js';
import { addMoney, multiplyMoney } from '../utils/decimal.js';

export class OrderService {
  async createOrder(
    userId: string,
    input: {
      address_id: string;
      payment_method?: PaymentMethod;
      notes?: string | null;
    },
    idempotencyKey?: string
  ): Promise<Order> {
    // 1. Check idempotency
    if (idempotencyKey) {
      const existing = await orderRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    // 2. Fetch and validate cart
    const shippingFee = await shippingService.getShippingFee();
    const cart = await cartRepository.getOrCreateActiveCart(userId, shippingFee);

    if (!cart.items || cart.items.length === 0) {
      throw new Error('CART_EMPTY: Não é possível finalizar um pedido com o carrinho vazio.');
    }

    // 3. Fetch and validate address
    const address = await addressRepository.findById(input.address_id, userId);
    if (!address) {
      throw new Error('ADDRESS_NOT_FOUND: Endereço selecionado não encontrado ou inválido.');
    }

    const isCovered = await shippingService.isCityCovered(address.city, address.state);
    if (!isCovered) {
      throw new Error(
        `OUT_OF_COVERAGE: Entregas disponíveis apenas para Ribeirão Branco - SP. O endereço selecionado é em ${address.city} - ${address.state}.`
      );
    }

    // 4. Validate products and calculate exact monetary totals from DB prices
    let subtotal = 0;
    const orderItemsToCreate = [];

    for (const item of cart.items) {
      const product = await productRepository.findById(item.product_id);
      if (!product) {
        throw new Error(`PROD_NOT_FOUND: Produto "${item.product_id}" não encontrado.`);
      }
      if (!product.is_active) {
        throw new Error(`PROD_INACTIVE: O produto "${product.name}" não está ativo.`);
      }

      const qtyCheck = productService.validateQuantityRules(product, item.quantity);
      if (!qtyCheck.valid) {
        throw new Error(`INVALID_QTY: ${qtyCheck.error}`);
      }

      const unitPrice = product.price; // authoritative DB price
      const itemSubtotal = multiplyMoney(unitPrice, item.quantity);
      subtotal = addMoney(subtotal, itemSubtotal);

      // Snapshot of the product for the order item
      orderItemsToCreate.push({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
      });
    }

    const total = addMoney(subtotal, shippingFee);
    const paymentMethod: PaymentMethod = input.payment_method || 'cash';

    // 5. Create Order & Items
    const order = await orderRepository.create(
      {
        user_id: userId,
        address_id: address.id,
        status: 'pending',
        subtotal,
        shipping_fee: shippingFee,
        discount: 0,
        total,
        currency: 'BRL',
        notes: input.notes || null,
        idempotency_key: idempotencyKey || null,
      },
      orderItemsToCreate
    );

    // 6. Convert Cart to 'converted'
    await cartRepository.convertCart(cart.id);

    // 7. Create Pending Payment Record
    const payment = await paymentRepository.create({
      order_id: order.id,
      provider: 'mock',
      external_id: null,
      method: paymentMethod,
      status: 'pending',
      amount: total,
      currency: 'BRL',
      paid_at: null,
      expires_at: null,
      metadata: { notes: input.notes || null },
    });

    return {
      ...order,
      address,
      payment,
    };
  }

  async getOrderById(orderId: string, userId?: string): Promise<Order | null> {
    return orderRepository.findById(orderId, userId);
  }

  async listUserOrders(
    userId: string,
    options?: { page?: number; limit?: number; status?: OrderStatus }
  ): Promise<{ orders: Order[]; total: number }> {
    return orderRepository.findByUserId(userId, options);
  }

  async cancelOrder(orderId: string, userId: string): Promise<Order> {
    const order = await orderRepository.findById(orderId, userId);
    if (!order) {
      throw new Error('ORDER_NOT_FOUND: Pedido não encontrado.');
    }

    if (order.status !== 'pending' && order.status !== 'confirmed') {
      throw new Error(
        `CANNOT_CANCEL: Pedido em status "${order.status}" não pode ser cancelado pelo cliente.`
      );
    }

    const updated = await orderRepository.updateStatus(orderId, 'cancelled');
    if (!updated) {
      throw new Error('FAIL_CANCEL: Não foi possível cancelar o pedido.');
    }

    // Also cancel associated payment if pending
    const payment = await paymentRepository.findByOrderId(orderId);
    if (payment && payment.status === 'pending') {
      await paymentRepository.updateStatus(payment.id, 'cancelled');
    }

    return updated;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const updated = await orderRepository.updateStatus(orderId, status);
    if (!updated) {
      throw new Error('ORDER_NOT_FOUND: Pedido não encontrado.');
    }
    return updated;
  }
}

export const orderService = new OrderService();
