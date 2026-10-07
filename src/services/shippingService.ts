import { settingsRepository } from '../repositories/settingsRepository.js';

export class ShippingService {
  async getShippingFee(city?: string): Promise<number> {
    // Configurable via system_settings table, defaults to 4.98
    const fee = await settingsRepository.getNumber('SHIPPING_FEE', 4.98);
    return fee;
  }

  async isCityCovered(city: string, state: string): Promise<boolean> {
    const allowedCity = (await settingsRepository.getByKey('STORE_CITY')) || 'Ribeirão Branco';
    const allowedState = (await settingsRepository.getByKey('STORE_STATE')) || 'SP';

    const normalize = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const normalizedCity = normalize(city);
    const normalizedAllowed = normalize(allowedCity);

    const normalizedState = state.trim().toUpperCase();
    const normalizedAllowedState = allowedState.trim().toUpperCase();

    return normalizedCity === normalizedAllowed && normalizedState === normalizedAllowedState;
  }
}

export const shippingService = new ShippingService();
