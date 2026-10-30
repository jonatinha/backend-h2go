import { Order, OrderStatus, PaymentMethod, FulfillmentType } from '../types/index.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { cartRepository } from '../repositories/cartRepository.js';
import { addressRepository } from '../repositories/addressRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { paymentRepository } from '../repositories/paymentRepository.js';
import { shippingService } from './shippingService.js';
import { pickupService } from './pickupService.js';
import { productService } from './productService.js';
import { addMoney, multiplyMoney } from '../utils/decimal.js';
import { createDeliveryQrToken, DELIVERY_QR_PREFIX } from '../utils/deliveryQr.js';

export type CreateOrderPayload = {
  fulfillment_type?: FulfillmentType;
  address_id?: string;
  agency_id?: string;
  pickup_contact_name?: string;
  pickup_contact_phone?: string;
  pickup_scheduled_at?: string | null;
  payment_method?: PaymentMethod;
  notes?: string | null;
};

export class OrderService {
  async createOrder(
    userId: string,
    input: CreateOrderPayload,
    idempotencyKey?: string
  ): Promise<Order> {
    if (idempotencyKey) {
      const existing = await orderRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const fulfillmentType: FulfillmentType = input.fulfillment_type || 'delivery';
    const { orderItemsToCreate, subtotal } = await this.buildOrderItemsFromCart(userId);

    if (fulfillmentType === 'pickup') {
      return this.createPickupOrder(userId, input, orderItemsToCreate, subtotal, idempotencyKey);
    }

    return this.createDeliveryOrder(userId, input, orderItemsToCreate, subtotal, idempotencyKey);
  }

  private async buildOrderItemsFromCart(userId: string) {
    const shippingFee = await shippingService.getShippingFee();
    const cart = await cartRepository.getOrCreateActiveCart(userId, shippingFee);

    if (!cart.items || cart.items.length === 0) {
      throw new Error('CART_EMPTY: Não é possível finalizar um pedido com o carrinho vazio.');
    }

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

      const unitPrice = product.price;
      const itemSubtotal = multiplyMoney(unitPrice, item.quantity);
      subtotal = addMoney(subtotal, itemSubtotal);

      orderItemsToCreate.push({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
      });
    }

    return { cart, orderItemsToCreate, subtotal };
  }

  private async createDeliveryOrder(
    userId: string,
    input: CreateOrderPayload,
    orderItemsToCreate: Array<{
      product_id: string;
      product_name: string;
      sku: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>,
    subtotal: number,
    idempotencyKey?: string
  ): Promise<Order> {
    if (!input.address_id) {
      throw new Error('ADDRESS_REQUIRED: Endereço é obrigatório para entrega.');
    }

    const shippingFee = await shippingService.getShippingFee();
    const cart = await cartRepository.getOrCreateActiveCart(userId, shippingFee);

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

    const total = addMoney(subtotal, shippingFee);
    const paymentMethod: PaymentMethod = input.payment_method || 'cash';

    const order = await orderRepository.create(
      {
        user_id: userId,
        address_id: address.id,
        fulfillment_type: 'delivery',
        agency_id: null,
        pickup_contact_name: null,
        pickup_contact_phone: null,
        pickup_scheduled_at: null,
        ready_for_pickup_at: null,
        picked_up_at: null,
        status: 'pending',
        subtotal,
        shipping_fee: shippingFee,
        discount: 0,
        total,
        currency: 'BRL',
        notes: input.notes || null,
        idempotency_key: idempotencyKey || null,
        delivery_qr_token: createDeliveryQrToken(),
        latitude: address.latitude ?? null,
        longitude: address.longitude ?? null,
      },
      orderItemsToCreate
    );

    await cartRepository.convertCart(cart.id);

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
      metadata: { notes: input.notes || null, fulfillment_type: 'delivery' },
    });

    return {
      ...order,
      address,
      payment,
    };
  }

  private async createPickupOrder(
    userId: string,
    input: CreateOrderPayload,
    orderItemsToCreate: Array<{
      product_id: string;
      product_name: string;
      sku: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>,
    subtotal: number,
    idempotencyKey?: string
  ): Promise<Order> {
    const pickupEnabled = await pickupService.isPickupEnabled();
    if (!pickupEnabled) {
      throw new Error(
        'PICKUP_DISABLED: Retirada na agência ainda não está disponível. Tente novamente mais tarde.'
      );
    }

    if (!input.agency_id) {
      throw new Error('AGENCY_REQUIRED: Selecione a agência para retirada.');
    }

    const agency = await pickupService.getAgencyForPickup(input.agency_id);
    const shippingFee = await pickupService.getPickupShippingFee();
    const cart = await cartRepository.getOrCreateActiveCart(userId, shippingFee);
    const total = addMoney(subtotal, shippingFee);
    const paymentMethod: PaymentMethod = input.payment_method || 'cash';

    const order = await orderRepository.create(
      {
        user_id: userId,
        address_id: null,
        fulfillment_type: 'pickup',
        agency_id: agency.id,
        pickup_contact_name: input.pickup_contact_name!.trim(),
        pickup_contact_phone: input.pickup_contact_phone!.trim(),
        pickup_scheduled_at: input.pickup_scheduled_at ?? null,
        ready_for_pickup_at: null,
        picked_up_at: null,
        status: 'pending',
        subtotal,
        shipping_fee: shippingFee,
        discount: 0,
        total,
        currency: 'BRL',
        notes: input.notes || null,
        idempotency_key: idempotencyKey || null,
        delivery_qr_token: createDeliveryQrToken(),
        latitude: agency.latitude ?? null,
        longitude: agency.longitude ?? null,
      },
      orderItemsToCreate
    );

    await cartRepository.convertCart(cart.id);

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
      metadata: {
        notes: input.notes || null,
        fulfillment_type: 'pickup',
        agency_id: agency.id,
        agency_name: agency.name,
      },
    });

    return {
      ...order,
      agency,
      payment,
    };
  }

  async getOrderById(orderId: string, userId?: string): Promise<Order | null> {
    return orderRepository.findById(orderId, userId);
  }

  async getDeliveryQrForCustomer(
    orderId: string,
    userId: string
  ): Promise<{ order_id: string; delivery_qr_token: string; qr_payload: string }> {
    const order = await orderRepository.findById(orderId, userId);
    if (!order) {
      throw new Error('ORDER_NOT_FOUND: Pedido não encontrado.');
    }
    if (order.status === 'cancelled') {
      throw new Error('ORDER_CANCELLED: Pedido cancelado.');
    }

    const withToken = await orderRepository.ensureDeliveryQrToken(order);
    if (!withToken.delivery_qr_token) {
      throw new Error('QR_UNAVAILABLE: Não foi possível gerar o QR deste pedido.');
    }

    return {
      order_id: withToken.id,
      delivery_qr_token: withToken.delivery_qr_token,
      qr_payload: `${DELIVERY_QR_PREFIX}${withToken.delivery_qr_token}`,
    };
  }

  async listUserOrders(
    userId: string,
    options?: { page?: number; limit?: number; status?: OrderStatus; fulfillment_type?: FulfillmentType }
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

    const payment = await paymentRepository.findByOrderId(orderId);
    if (payment && payment.status === 'pending') {
      await paymentRepository.updateStatus(payment.id, 'cancelled');
    }

    return updated;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const current = await orderRepository.findById(orderId);
    if (!current) {
      throw new Error('ORDER_NOT_FOUND: Pedido não encontrado.');
    }

    this.assertStatusMatchesFulfillment(current.fulfillment_type, status);

    const updated = await orderRepository.updateStatus(orderId, status);
    if (!updated) {
      throw new Error('ORDER_NOT_FOUND: Pedido não encontrado.');
    }
    return updated;
  }

  private assertStatusMatchesFulfillment(fulfillmentType: FulfillmentType, status: OrderStatus): void {
    if (fulfillmentType === 'pickup' && status === 'out_for_delivery') {
      throw new Error(
        'INVALID_STATUS: Pedidos de retirada na agência não utilizam o status "out_for_delivery". Use "ready_for_pickup".'
      );
    }
    if (fulfillmentType === 'delivery' && status === 'ready_for_pickup') {
      throw new Error(
        'INVALID_STATUS: O status "ready_for_pickup" é exclusivo para retirada na agência.'
      );
    }
  }
}

export const orderService = new OrderService();
