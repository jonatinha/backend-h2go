import { describe, it, expect } from 'vitest';
import { calculatePackage } from '../../src/utils/fardo.js';

describe('Regras de Identificação de Fardos (Informativo V1)', () => {
  it('Água 510 ml: 12 unidades = 1 fardo fechado', () => {
    const pkg12 = calculatePackage('AGUA-510ML', 12, 12, 'fardo');
    expect(pkg12.packages).toBe(1);
    expect(pkg12.package_description).toBe('1 fardo fechado');

    const pkg24 = calculatePackage('AGUA-510ML', 24, 12, 'fardo');
    expect(pkg24.packages).toBe(2);
    expect(pkg24.package_description).toBe('2 fardos fechados');
  });

  it('Água 510 ml com sobra: 15 unidades = 1 fardo fechado e 3 unidades avulsas', () => {
    const pkg15 = calculatePackage('AGUA-510ML', 15, 12, 'fardo');
    expect(pkg15.packages).toBe(1);
    expect(pkg15.package_description).toBe('1 fardo fechado e 3 unidades avulsas');
  });

  it('Água 510 ml com gás: 12 unidades = 1 fardo', () => {
    const pkg = calculatePackage('AGUA-510ML-GAS', 12, 12, 'fardo');
    expect(pkg.packages).toBe(1);
    expect(pkg.package_description).toBe('1 fardo fechado');
  });

  it('Água 1,5 L: 6 unidades = 1 fardo', () => {
    const pkg = calculatePackage('AGUA-15L', 6, 6, 'fardo');
    expect(pkg.packages).toBe(1);
    expect(pkg.package_description).toBe('1 fardo fechado');
  });

  it('Água 5 L: 2 unidades = 1 fardo', () => {
    const pkg = calculatePackage('AGUA-5L', 2, 2, 'fardo');
    expect(pkg.packages).toBe(1);
    expect(pkg.package_description).toBe('1 fardo fechado');
  });

  it('Produtos sem regra de fardo (ex: Galão 20 L) devem retornar 0 pacotes', () => {
    const pkg = calculatePackage('GALAO-20L-REFIL', 2, null, null);
    expect(pkg.packages).toBe(0);
    expect(pkg.package_description).toBeNull();
  });
});
