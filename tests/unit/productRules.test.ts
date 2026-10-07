import { describe, it, expect } from 'vitest';
import { productService } from '../../src/services/productService.js';
import { Product } from '../../src/types/index.js';

describe('Regras de Validação de Quantidade do Copo 200ml (Obrigatório)', () => {
  const copo200ml: Product = {
    id: 'b1000001-0000-0000-0000-000000000007',
    category_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Água 200 ml (copo)',
    slug: 'agua-200ml-copo',
    sku: 'AGUA-200ML-COPO',
    description: 'Copo 200ml',
    price: 0.99,
    unit: 'unidade',
    minimum_quantity: 4,
    maximum_quantity: 48,
    quantity_step: 4,
    package_size: null,
    package_label: null,
    image_url: null,
    is_active: true,
    stock_control_enabled: false,
    stock_quantity: 1000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('4 = válido (mínimo permitido)', () => {
    const res = productService.validateQuantityRules(copo200ml, 4);
    expect(res.valid).toBe(true);
  });

  it('8 = válido (múltiplo de 4)', () => {
    const res = productService.validateQuantityRules(copo200ml, 8);
    expect(res.valid).toBe(true);
  });

  it('48 = válido (máximo permitido)', () => {
    const res = productService.validateQuantityRules(copo200ml, 48);
    expect(res.valid).toBe(true);
  });

  it('3 = inválido (abaixo do mínimo 4)', () => {
    const res = productService.validateQuantityRules(copo200ml, 3);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('mínima permitida');
  });

  it('5 = inválido (não é múltiplo de 4)', () => {
    const res = productService.validateQuantityRules(copo200ml, 5);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('múltiplos de 4');
  });

  it('52 = inválido (acima do máximo 48)', () => {
    const res = productService.validateQuantityRules(copo200ml, 52);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('máxima permitida');
  });

  it('0, negativo ou decimal = inválido', () => {
    expect(productService.validateQuantityRules(copo200ml, 0).valid).toBe(false);
    expect(productService.validateQuantityRules(copo200ml, -4).valid).toBe(false);
    expect(productService.validateQuantityRules(copo200ml, 4.5).valid).toBe(false);
  });
});
