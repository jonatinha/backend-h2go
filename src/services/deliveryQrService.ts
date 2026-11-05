import type { DeliveryAssignmentStatus, Order } from '../types/index.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { deliveryAssignmentRepository } from '../repositories/deliveryRepository.js';
import { deliveryRunService } from './deliveryRunService.js';
import { deliveryQrCustomerName, parseDeliveryQrPayload } from '../utils/deliveryQr.js';
import { receiptRepository } from '../repositories/receiptRepository.js';
import { startReceiptAcceptance } from './receiptService.js';

export type DeliveryQrScanResult = {
  already_delivered: boolean;
  order_id: string;
  order_number: string;
  customer_name: string;
  status: 'delivered' | 'pending_acceptance' | 'rejected';
  receipt_id?: string;
  session_id?: string;
  message?: string;
};

const ACTIVE_ASSIGNMENT: DeliveryAssignmentStatus[] = [
  'accepted',
  'en_route_pickup',
  'picked_up',
  'en_route_delivery',
];

function summary(
  order: Order,
  status: DeliveryQrScanResult['status'],
  extra?: Partial<DeliveryQrScanResult>,
): DeliveryQrScanResult {
  return {
    already_delivered: status === 'delivered',
    order_id: order.id,
    order_number: order.id.slice(0, 8).toUpperCase(),
    customer_name: deliveryQrCustomerName(order),
    status,
    ...extra,
  };
}

export async function redeemDeliveryQr(
  rawPayload: string,
  actor: { role: 'admin'; profileId?: string | null } | { role: 'driver'; driverId: string; profileId?: string | null },
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
    const latest = await receiptRepository.findLatestByOrderId(order.id);
    return summary(order, 'delivered', {
      receipt_id: latest?.id,
      session_id: latest?.session_id,
      message: 'Pedido já entregue.',
    });
  }

  const assignment = await deliveryAssignmentRepository.findByOrderId(order.id);

  if (actor.role === 'driver') {
    if (!assignment || assignment.driver_id !== actor.driverId || assignment.status === 'cancelled') {
      throw new Error(
        'QR_NOT_ASSIGNED: Este pedido não está na sua rota. Aceite a corrida antes de dar baixa.',
      );
    }
  } else if (assignment && ACTIVE_ASSIGNMENT.includes(assignment.status)) {
    // admin can proceed while driver is active on route
  }

  const latest = await receiptRepository.findLatestByOrderId(order.id);
  if (latest?.status === 'rejected') {
    // allow a new scan attempt — fall through to create new session
  } else if (latest?.status === 'pending_acceptance') {
    return summary(order, 'pending_acceptance', {
      receipt_id: latest.id,
      session_id: latest.session_id,
      message: 'Aguardando o cliente confirmar o recibo no celular.',
    });
  } else if (latest?.status === 'accepted') {
    return summary(order, 'delivered', {
      receipt_id: latest.id,
      session_id: latest.session_id,
      message: 'Recibo já aceito.',
    });
  }

  const receipt = await startReceiptAcceptance(order, actor);
  return summary(order, 'pending_acceptance', {
    receipt_id: receipt.id,
    session_id: receipt.session_id,
    message: 'Peça ao cliente confirmar o recibo no app.',
  });
}
