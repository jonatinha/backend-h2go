import { FastifyRequest, FastifyReply } from 'fastify';
import { addressRepository } from '../repositories/addressRepository.js';
import { shippingService } from '../services/shippingService.js';
import {
  createAddressSchema,
  updateAddressSchema,
  addressIdParamSchema,
} from '../schemas/address.schema.js';
import { formatSuccess, formatError } from '../utils/response.js';

export class AddressController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const addresses = await addressRepository.findByUserId(request.user.id);
    return reply.send(formatSuccess(addresses));
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const { id } = addressIdParamSchema.parse(request.params);
    const address = await addressRepository.findById(id, request.user.id);

    if (!address) {
      return reply.status(404).send(
        formatError('ADDRESS_NOT_FOUND', 'Endereço não encontrado.', request.requestId)
      );
    }

    return reply.send(formatSuccess(address));
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const body = createAddressSchema.parse(request.body);

    const isCovered = await shippingService.isCityCovered(body.city, body.state);
    if (!isCovered) {
      return reply.status(422).send(
        formatError(
          'OUT_OF_COVERAGE',
          `Atualmente as entregas são realizadas apenas na região de Ribeirão Branco - SP. O endereço informado pertence a ${body.city} - ${body.state}.`,
          request.requestId
        )
      );
    }

    const address = await addressRepository.create({
      user_id: request.user.id,
      name: body.name,
      phone: body.phone,
      cep: body.cep,
      street: body.street,
      number: body.number,
      complement: body.complement || null,
      neighborhood: body.neighborhood,
      city: body.city,
      state: body.state,
      reference: body.reference || null,
      is_default: body.is_default,
    });

    return reply.status(201).send(formatSuccess(address));
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const { id } = addressIdParamSchema.parse(request.params);
    const body = updateAddressSchema.parse(request.body);

    if (body.city && body.state) {
      const isCovered = await shippingService.isCityCovered(body.city, body.state);
      if (!isCovered) {
        return reply.status(422).send(
          formatError(
            'OUT_OF_COVERAGE',
            `Entregas atendem apenas Ribeirão Branco - SP.`,
            request.requestId
          )
        );
      }
    }

    const updated = await addressRepository.update(id, request.user.id, body);
    if (!updated) {
      return reply.status(404).send(
        formatError('ADDRESS_NOT_FOUND', 'Endereço não encontrado para atualização.', request.requestId)
      );
    }

    return reply.send(formatSuccess(updated));
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const { id } = addressIdParamSchema.parse(request.params);
    const deleted = await addressRepository.delete(id, request.user.id);

    if (!deleted) {
      return reply.status(404).send(
        formatError('ADDRESS_NOT_FOUND', 'Endereço não encontrado para remoção.', request.requestId)
      );
    }

    return reply.send(formatSuccess({ message: 'Endereço removido com sucesso.' }));
  }
}

export const addressController = new AddressController();
