import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { formatError, formatPaginated, formatSuccess } from '../utils/response.js';
import { receiptRepository } from '../repositories/receiptRepository.js';
import {
  getReceiptSessionStatus,
  receiptToPrintPayload,
  renderReceiptHtml,
  respondReceiptAcceptance,
} from '../services/receiptService.js';
import { RECEIPT_TERMS_TEXT } from '../types/receipt.js';
import { orderRepository } from '../repositories/orderRepository.js';

const respondSchema = z.object({
  accept: z.boolean(),
  terms_accepted: z.boolean(),
});

export class ReceiptController {
  async getPendingForOrder(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(formatError('UNAUTHORIZED', 'Não autenticado.', request.requestId));
    }
    const { id } = request.params as { id: string };
    const order = await orderRepository.findById(id);
    if (!order || order.user_id !== request.user.id) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Pedido não encontrado.', request.requestId));
    }
    const receipt = await receiptRepository.findPendingByOrderId(id);
    if (!receipt) {
      return reply.send(formatSuccess({ pending: false, receipt: null, terms: RECEIPT_TERMS_TEXT }));
    }
    return reply.send(
      formatSuccess({
        pending: true,
        terms: RECEIPT_TERMS_TEXT,
        receipt: receiptToPrintPayload(receipt),
        session_id: receipt.session_id,
      }),
    );
  }

  async respondForOrder(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(formatError('UNAUTHORIZED', 'Não autenticado.', request.requestId));
    }
    const { id } = request.params as { id: string };
    const body = respondSchema.parse(request.body);
    try {
      const receipt = await respondReceiptAcceptance({
        orderId: id,
        userId: request.user.id,
        accept: body.accept,
        termsAccepted: body.terms_accepted,
        ip: request.ip,
        userAgent: String(request.headers['user-agent'] ?? ''),
      });
      return reply.send(
        formatSuccess({
          status: receipt.status,
          receipt: receiptToPrintPayload(receipt),
        }),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível registrar o aceite.';
      const code = message.split(':')[0] || 'RECEIPT_FAILED';
      return reply.status(400).send(formatError(code, message.replace(/^[^:]+:\s*/, ''), request.requestId));
    }
  }

  async getSessionStatus(request: FastifyRequest, reply: FastifyReply) {
    const { sessionId } = request.params as { sessionId: string };
    const receipt = await getReceiptSessionStatus(sessionId);
    if (!receipt) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Sessão não encontrada.', request.requestId));
    }
    return reply.send(
      formatSuccess({
        status: receipt.status,
        order_id: receipt.order_id,
        receipt_id: receipt.id,
        message:
          receipt.status === 'pending_acceptance'
            ? 'Aguardando aceite do cliente.'
            : receipt.status === 'rejected'
              ? 'Cliente recusou os termos.'
              : 'Recibo aceito e entrega concluída.',
      }),
    );
  }

  async listAdmin(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { page?: string; limit?: string };
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const { receipts, total } = await receiptRepository.list({ page, limit });
    return reply.send(formatPaginated(receipts.map(receiptToPrintPayload), total, page, limit));
  }

  async getAdmin(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const receipt = await receiptRepository.findById(id);
    if (!receipt) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Recibo não encontrado.', request.requestId));
    }
    return reply.send(formatSuccess(receiptToPrintPayload(receipt)));
  }

  async printAdmin(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const receipt = await receiptRepository.findById(id);
    if (!receipt) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Recibo não encontrado.', request.requestId));
    }
    const html = renderReceiptHtml(receipt);
    return reply.type('text/html; charset=utf-8').send(html);
  }

  async getAcceptedReceiptForOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const order = await orderRepository.findById(id);
    if (!order) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Pedido não encontrado.', request.requestId));
    }
    const receipt = await receiptRepository.findLatestByOrderId(id);
    if (!receipt || receipt.status !== 'accepted') {
      return reply
        .status(404)
        .send(
          formatError(
            'NO_RECEIPT',
            'Não há recibo aceito para este pedido. Conclua a entrega com aceite do cliente no app.',
            request.requestId,
          ),
        );
    }
    return reply.send(
      formatSuccess({
        receipt_id: receipt.id,
        receipt_number: receipt.receipt_number,
      }),
    );
  }
}

export const receiptController = new ReceiptController();
