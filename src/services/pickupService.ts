import { Agency } from '../types/index.js';
import { agencyRepository } from '../repositories/agencyRepository.js';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { shippingService } from './shippingService.js';

export class PickupService {
  async isPickupEnabled(): Promise<boolean> {
    const value = await settingsRepository.getByKey('PICKUP_ENABLED');
    return value === 'true' || value === '1';
  }

  async getPickupShippingFee(): Promise<number> {
    return settingsRepository.getNumber('PICKUP_SHIPPING_FEE', 0);
  }

  async getAgencyForPickup(agencyId: string): Promise<Agency> {
    const agency = await agencyRepository.findById(agencyId);
    if (!agency) {
      throw new Error('AGENCY_NOT_FOUND: Agência não encontrada.');
    }

    if (!agency.is_active || !agency.accepts_pickup) {
      throw new Error('AGENCY_UNAVAILABLE: Esta agência não está disponível para retirada.');
    }

    const isCovered = await shippingService.isCityCovered(agency.city, agency.state);
    if (!isCovered) {
      throw new Error(
        `OUT_OF_COVERAGE: Retirada disponível apenas na região de atendimento da loja. A agência está em ${agency.city} - ${agency.state}.`
      );
    }

    return agency;
  }
}

export const pickupService = new PickupService();
