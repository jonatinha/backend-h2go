import type { Order } from '../types/index.js';
import type { DeliveryReceipt } from '../types/receipt.js';
import { RECEIPT_TERMS_TEXT } from '../types/receipt.js';
import { receiptRepository } from '../repositories/receiptRepository.js';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { deliveryQrCustomerName } from '../utils/deliveryQr.js';
import { moneyToExtenso } from '../utils/moneyExtenso.js';
import { deliveryRunService } from './deliveryRunService.js';
import { orderService } from './orderService.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { deliveryAssignmentRepository } from '../repositories/deliveryRepository.js';
import { enqueueReceiptPrint } from './printRequestService.js';

function buildReference(order: Order): string {
  const items = (order.items ?? [])
    .map((item) => `${item.quantity}x ${item.product_name}`)
    .join(', ');
  const payment = order.payment?.method ? `Pagamento: ${order.payment.method}` : 'Pagamento na entrega';
  return `Recebimento de pedido H2GO (${items || 'produtos'}). ${payment}.`;
}

async function companyPayee() {
  const [legal, cnpj, city, state] = await Promise.all([
    settingsRepository.getByKey('COMPANY_LEGAL_NAME'),
    settingsRepository.getByKey('COMPANY_CNPJ'),
    settingsRepository.getByKey('STORE_CITY'),
    settingsRepository.getByKey('STORE_STATE'),
  ]);
  return {
    payee_name: legal?.trim() || 'H2GO',
    payee_document: cnpj?.trim() || '—',
    issue_city: city?.trim() || 'Ribeirão Branco',
    issue_state: (state?.trim() || 'SP').slice(0, 2).toUpperCase(),
  };
}

async function payerFromOrder(order: Order) {
  const profile = await userRepository.findById(order.user_id);
  return {
    payer_name: deliveryQrCustomerName(order),
    payer_document: profile?.phone?.trim() || null,
  };
}

export async function buildReceiptDraft(order: Order): Promise<Omit<DeliveryReceipt, 'id' | 'receipt_number' | 'created_at' | 'updated_at' | 'accepted_at' | 'rejected_at' | 'accepted_by_user_id' | 'acceptance_ip' | 'acceptance_user_agent'>> {
  const payee = await companyPayee();
  const payer = await payerFromOrder(order);
  const amount = Number(order.total) || 0;
  return {
    order_id: order.id,
    session_id: crypto.randomUUID(),
    status: 'pending_acceptance',
    amount,
    amount_extenso: moneyToExtenso(amount),
    payer_name: payer.payer_name,
    payer_document: payer.payer_document,
    payee_name: payee.payee_name,
    payee_document: payee.payee_document,
    reference_description: buildReference(order),
    issue_city: payee.issue_city,
    issue_state: payee.issue_state,
    issued_at: new Date().toISOString(),
    terms_version: '1',
    scanned_by_role: 'admin',
    scanned_by_profile_id: null,
    scanned_by_driver_id: null,
  };
}

async function completeDelivery(order: Order, driverId?: string | null): Promise<void> {
  if (order.status === 'delivered') return;
  const assignment = await deliveryAssignmentRepository.findByOrderId(order.id);
  if (assignment && assignment.status !== 'completed' && assignment.status !== 'cancelled') {
    await deliveryRunService.updateAssignmentStatus(assignment.driver_id, order.id, 'completed');
    return;
  }
  if (driverId && assignment && assignment.driver_id === driverId && assignment.status !== 'cancelled') {
    await deliveryRunService.updateAssignmentStatus(driverId, order.id, 'completed');
    return;
  }
  await orderService.updateOrderStatus(order.id, 'delivered');
  if (order.fulfillment_type === 'delivery') {
    await orderRepository.updateOrder(order.id, {
      delivery_completed_at: new Date().toISOString(),
    });
  }
}

export async function startReceiptAcceptance(
  order: Order,
  actor: { role: 'admin'; profileId?: string | null } | { role: 'driver'; driverId: string; profileId?: string | null },
): Promise<DeliveryReceipt> {
  const pending = await receiptRepository.findPendingByOrderId(order.id);
  if (pending) return pending;

  const draft = await buildReceiptDraft(order);
  draft.scanned_by_role = actor.role;
  draft.scanned_by_driver_id = actor.role === 'driver' ? actor.driverId : null;
  draft.scanned_by_profile_id = actor.profileId ?? null;
  return receiptRepository.create(draft);
}

export async function respondReceiptAcceptance(input: {
  orderId: string;
  userId: string;
  accept: boolean;
  termsAccepted: boolean;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<DeliveryReceipt> {
  const receipt = await receiptRepository.findPendingByOrderId(input.orderId);
  if (!receipt) {
    throw new Error('RECEIPT_NOT_PENDING: Não há recibo aguardando aceite para este pedido.');
  }
  const order = await orderRepository.findById(input.orderId);
  if (!order || order.user_id !== input.userId) {
    throw new Error('FORBIDDEN: Você não pode responder por este pedido.');
  }
  if (!input.accept) {
    const rejected = await receiptRepository.update(receipt.id, {
      status: 'rejected',
      rejected_at: new Date().toISOString(),
    });
    if (!rejected) throw new Error('RECEIPT_UPDATE_FAILED');
    return rejected;
  }
  if (!input.termsAccepted) {
    throw new Error('TERMS_REQUIRED: Marque que leu e concorda com os termos.');
  }
  await completeDelivery(order, receipt.scanned_by_driver_id);
  const accepted = await receiptRepository.update(receipt.id, {
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    accepted_by_user_id: input.userId,
    acceptance_ip: input.ip ?? null,
    acceptance_user_agent: input.userAgent ?? null,
  });
  if (!accepted) throw new Error('RECEIPT_UPDATE_FAILED');
  await enqueueReceiptPrint(accepted);
  return accepted;
}

export async function getReceiptSessionStatus(sessionId: string): Promise<DeliveryReceipt | null> {
  return receiptRepository.findBySessionId(sessionId);
}

export function receiptToPrintPayload(receipt: DeliveryReceipt) {
  return {
    id: receipt.id,
    status: receipt.status,
    title: 'RECIBO',
    receipt_number: receipt.receipt_number,
    amount: receipt.amount,
    amount_extenso: receipt.amount_extenso,
    payer_name: receipt.payer_name,
    payer_document: receipt.payer_document || 'Não informado',
    payee_name: receipt.payee_name,
    payee_document: receipt.payee_document,
    reference_description: receipt.reference_description,
    issue_city: receipt.issue_city,
    issue_state: receipt.issue_state,
    issued_at: receipt.issued_at,
    accepted_at: receipt.accepted_at,
    signature_label: receipt.accepted_at
      ? 'Assinatura eletrônica do pagador (aceite no app após leitura do QR)'
      : 'Aguardando aceite eletrônico',
    terms: RECEIPT_TERMS_TEXT,
  };
}

export function renderReceiptHtml(receipt: DeliveryReceipt): string {
  const data = receiptToPrintPayload(receipt);
  const issued = new Date(data.issued_at).toLocaleString('pt-BR');
  const accepted = data.accepted_at ? new Date(data.accepted_at).toLocaleString('pt-BR') : '—';
  const amount = data.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.35; color: #000; width: 72mm; margin: 0 auto; }
  h1 { text-align: center; font-size: 16px; margin: 0 0 8px; }
  .line { border-top: 1px dashed #000; margin: 8px 0; }
  .label { font-weight: 700; }
  .center { text-align: center; }
</style></head><body>
  <h1>${data.title}</h1>
  <p><span class="label">Nº do recibo:</span> ${data.receipt_number}</p>
  <p><span class="label">Valor recebido:</span> ${amount}</p>
  <p><span class="label">Por extenso:</span> ${data.amount_extenso}</p>
  <div class="line"></div>
  <p><span class="label">Pagador:</span> ${data.payer_name}</p>
  <p><span class="label">CPF/CNPJ pagador:</span> ${data.payer_document}</p>
  <p><span class="label">Beneficiário:</span> ${data.payee_name}</p>
  <p><span class="label">CPF/CNPJ beneficiário:</span> ${data.payee_document}</p>
  <div class="line"></div>
  <p><span class="label">Referente a:</span> ${data.reference_description}</p>
  <p><span class="label">Data e local:</span> ${issued} — ${data.issue_city}/${data.issue_state}</p>
  <div class="line"></div>
  <p><span class="label">Assinatura:</span> ${data.signature_label}</p>
  <p class="center">Aceite em: ${accepted}</p>
  <p style="font-size:9px;">${data.terms}</p>
</body></html>`;
}
