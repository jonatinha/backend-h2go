import type { DeliveryAssignmentStatus, Order } from '../types/index.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { deliveryAssignmentRepository } from '../repositories/deliveryRepository.js';
import { orderService } from './orderService.js';
import { deliveryRunService } from './deliveryRunService.js';
import { deliveryQrCustomerName, parseDeliveryQrPayload } from '../utils/deliveryQr.js';

export type DeliveryQrScanResult = {
  already_delivered: boolean;
  order_id: string;
  order_number: string;
  customer_name: string;
  status: 'delivered';
};

const ACTIVE_ASSIGNMENT: DeliveryAssignmentStatus[] = [
  'accepted',
  'en_route_pickup',
  'picked_up',
  'en_route_delivery',
];

function summary(order: Order, alreadyDelivered: boolean): DeliveryQrScanResult {
  return {
    already_delivered: alreadyDelivered,
    order_id: order.id,
    order_number: order.id.slice(0, 8).toUpperCase(),
    customer_name: deliveryQrCustomerName(order),
    status: 'delivered',
  };
}

async function markDeliveredWithoutAssignment(order: Order): Promise<void> {
  await orderService.updateOrderStatus(order.id, 'delivered');
  if (order.fulfillment_type === 'delivery') {
    await orderRepository.updateOrder(order.id, {
      delivery_completed_at: new Date().toISOString(),
    });
  }
}

export async function redeemDeliveryQr(
  rawPayload: string,
  actor: { role: 'admin' } | { role: 'driver'; driverId: string }
): Promise<DeliveryQrScanResult> {
  const token = parseDeliveryQrPayload(rawPayload);
  if (!token) {
    throw new Error('QR_INVALID: Este QR não é de um pedido H2GO.');
  }

  const order = await orderRepository.findByDeliveryQrToken(token);
  if (!order) {
    throw new Error('QR_INVALID: Pedido não encontrado para este QR.');
  }

  if (order.status === 'cancelled') {
    throw new Error('ORDER_CANCELLED: Este pedido foi cancelado.');
  }

  if (order.status === 'delivered') {
    return summary(order, true);
  }

  const assignment = await deliveryAssignmentRepository.findByOrderId(order.id);

  if (actor.role === 'driver') {
    if (!assignment || assignment.driver_id !== actor.driverId || assignment.status === 'cancelled') {
      throw new Error(
        'QR_NOT_ASSIGNED: Este pedido não está na sua rota. Aceite a corrida antes de dar baixa.'
      );
    }

    if (assignment.status === 'completed') {
      await orderService.updateOrderStatus(order.id, 'delivered');
      return summary(order, true);
    }

    await deliveryRunService.updateAssignmentStatus(actor.driverId, order.id, 'completed');
    return summary(order, false);
  }

  if (assignment && ACTIVE_ASSIGNMENT.includes(assignment.status)) {
    await deliveryRunService.updateAssignmentStatus(assignment.driver_id, order.id, 'completed');
    return summary(order, false);
  }

  await markDeliveredWithoutAssignment(order);
  return summary(order, false);
}
