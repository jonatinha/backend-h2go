import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { formatError, formatSuccess } from '../utils/response.js';
import { printRequestRepository } from '../repositories/printRequestRepository.js';
import { enqueuePrintForOrder } from '../services/printRequestService.js';

const idsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

const registerSchema = z.object({
  order_id: z.string().uuid().optional(),
  receipt_id: z.string().uuid().optional(),
});

export class PrintRequestController {
  async listActive(request: FastifyRequest, reply: FastifyReply) {
    const rows = await printRequestRepository.listActive();
    return reply.send(formatSuccess(rows));
  }

  async listArchived(request: FastifyRequest, reply: FastifyReply) {
    const rows = await printRequestRepository.listArchived();
    return reply.send(formatSuccess(rows));
  }

  async markPrinted(request: FastifyRequest, reply: FastifyReply) {
    const body = idsSchema.parse(request.body);
    const count = await printRequestRepository.markPrinted(body.ids);
    return reply.send(formatSuccess({ updated: count }));
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const body = idsSchema.parse(request.body);
    const count = await printRequestRepository.deleteByIds(body.ids);
    return reply.send(formatSuccess({ deleted: count }));
  }

  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = registerSchema.parse(request.body ?? {});
    if (!body.order_id && !body.receipt_id) {
      return reply
        .status(400)
        .send(formatError('INVALID_BODY', 'Informe order_id ou receipt_id.', request.requestId));
    }
    if (body.receipt_id) {
      const { receiptRepository } = await import('../repositories/receiptRepository.js');
      const receipt = await receiptRepository.findById(body.receipt_id);
      if (!receipt || receipt.status !== 'accepted') {
        return reply
          .status(400)
          .send(formatError('INVALID_RECEIPT', 'Recibo aceito não encontrado.', request.requestId));
      }
      const row = await printRequestRepository.create(receipt.id, receipt.order_id);
      return reply.send(formatSuccess({ print_request_id: row.id, receipt_id: receipt.id }));
    }
    const result = await enqueuePrintForOrder(body.order_id!);
    if (!result.receipt_id) {
      return reply
        .status(400)
        .send(formatError('NO_RECEIPT', 'Não há recibo aceito para este pedido.', request.requestId));
    }
    return reply.send(formatSuccess({ receipt_id: result.receipt_id, created: result.created }));
  }
}

export const printRequestController = new PrintRequestController();
