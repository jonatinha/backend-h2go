import { describe, it, expect } from 'vitest';
import { multiplyMoney, addMoney, subtractMoney, roundMoney, formatMoney } from '../../src/utils/decimal.js';

describe('Cálculos Financeiros e Precisão Decimal (Sem Float Errors)', () => {
  it('deve somar valores monetários com exatidão', () => {
    // 0.1 + 0.2 em ponto flutuante padrão daria 0.30000000000000004
    const res = addMoney(0.1, 0.2);
    expect(res).toBe(0.3);
  });

  it('deve calcular exatamente o exemplo do carrinho da especificação: 2x 1.59 + 4.98 = 8.16', () => {
    const subtotal = multiplyMoney(1.59, 2);
    expect(subtotal).toBe(3.18);

    const frete = 4.98;
    const total = addMoney(subtotal, frete);
    expect(total).toBe(8.16);
  });

  it('deve subtrair valores monetários corretamente', () => {
    const res = subtractMoney(10.0, 4.98);
    expect(res).toBe(5.02);
  });

  it('deve formatar valor com 2 casas decimais', () => {
    expect(formatMoney(1.5)).toBe('1.50');
    expect(formatMoney(34.9)).toBe('34.90');
    expect(formatMoney(0.99)).toBe('0.99');
  });

  it('deve arredondar com ROUND_HALF_UP', () => {
    expect(roundMoney(1.594)).toBe(1.59);
    expect(roundMoney(1.595)).toBe(1.60);
  });
});
