import { Agency } from '../types/index.js';
import { agencyRepository } from '../repositories/agencyRepository.js';
import { CreateAgencyInput, UpdateAgencyInput } from '../schemas/agency.schema.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export class AgencyService {
  async listPublic(options: {
    page?: number;
    limit?: number;
    city?: string;
    state?: string;
  }) {
    return agencyRepository.findAll({
      ...options,
      activeOnly: true,
      pickupOnly: true,
    });
  }

  async listAdmin(options: {
    page?: number;
    limit?: number;
    city?: string;
    state?: string;
    activeOnly?: boolean;
  }) {
    return agencyRepository.findAll({
      ...options,
      activeOnly: options.activeOnly ?? false,
      pickupOnly: false,
    });
  }

  async getById(id: string): Promise<Agency | null> {
    return agencyRepository.findById(id);
  }

  async getPublicById(id: string): Promise<Agency | null> {
    const agency = await agencyRepository.findById(id);
    if (!agency || !agency.is_active || !agency.accepts_pickup) {
      return null;
    }
    return agency;
  }

  async getPublicBySlug(slug: string): Promise<Agency | null> {
    const agency = await agencyRepository.findBySlug(slug);
    if (!agency || !agency.is_active || !agency.accepts_pickup) {
      return null;
    }
    return agency;
  }

  async create(input: CreateAgencyInput): Promise<Agency> {
    const slug = input.slug || slugify(input.name);
    const existingSlug = await agencyRepository.findBySlug(slug);
    if (existingSlug) {
      throw new Error('AGENCY_SLUG_EXISTS: Já existe uma agência com este slug.');
    }

    return agencyRepository.create({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      slug,
      phone: input.phone ?? null,
      email: input.email && input.email !== '' ? input.email : null,
      cep: input.cep.trim(),
      street: input.street.trim(),
      number: input.number.trim(),
      complement: input.complement ?? null,
      neighborhood: input.neighborhood.trim(),
      city: input.city.trim(),
      state: input.state.trim().toUpperCase(),
      reference: input.reference ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      pickup_instructions: input.pickup_instructions ?? null,
      opening_hours: input.opening_hours ?? {},
      accepts_pickup: input.accepts_pickup ?? true,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 0,
    });
  }

  async update(id: string, input: UpdateAgencyInput): Promise<Agency> {
    const existing = await agencyRepository.findById(id);
    if (!existing) {
      throw new Error('AGENCY_NOT_FOUND: Agência não encontrada.');
    }

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await agencyRepository.findBySlug(input.slug);
      if (slugTaken && slugTaken.id !== id) {
        throw new Error('AGENCY_SLUG_EXISTS: Já existe uma agência com este slug.');
      }
    }

    const updated = await agencyRepository.update(id, {
      ...input,
      code: input.code ? input.code.trim().toUpperCase() : undefined,
      state: input.state ? input.state.trim().toUpperCase() : undefined,
      slug: input.slug || (input.name ? slugify(input.name) : undefined),
    });

    if (!updated) {
      throw new Error('AGENCY_NOT_FOUND: Agência não encontrada.');
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const success = await agencyRepository.delete(id);
    if (!success) {
      throw new Error('AGENCY_NOT_FOUND: Agência não encontrada.');
    }
  }
}

export const agencyService = new AgencyService();
