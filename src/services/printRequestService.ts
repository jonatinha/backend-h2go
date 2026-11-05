import type { DeliveryReceipt } from '../types/receipt.js';
import { printRequestRepository } from '../repositories/printRequestRepository.js';
import { receiptRepository } from '../repositories/receiptRepository.js';

export async function enqueueReceiptPrint(receipt: DeliveryReceipt): Promise<void> {
  if (receipt.status !== 'accepted') return;
  await printRequestRepository.create(receipt.id, receipt.order_id);
}

export async function enqueuePrintForOrder(orderId: string): Promise<{ created: boolean; receipt_id: string | null }> {
  const receipt = await receiptRepository.findLatestByOrderId(orderId);
  if (!receipt || receipt.status !== 'accepted') {
    return { created: false, receipt_id: null };
  }
  await printRequestRepository.create(receipt.id, orderId);
  return { created: true, receipt_id: receipt.id };
}

export async function archivePrintRequestsForOrder(orderId: string): Promise<void> {
  await printRequestRepository.archiveByOrderId(orderId);
}
