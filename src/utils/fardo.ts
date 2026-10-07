import { PackageCalculation } from '../types/index.js';

export function calculatePackage(
  skuOrSlug: string,
  quantity: number,
  dbPackageSize?: number | null,
  dbPackageLabel?: string | null
): PackageCalculation {
  const normalized = skuOrSlug.toUpperCase();

  let packageSize: number | null = dbPackageSize ?? null;
  let packageLabel: string | null = dbPackageLabel ?? null;

  // Fallback / standard catalog detection if not set in DB
  if (!packageSize) {
    if (normalized.includes('510ML')) {
      packageSize = 12;
      packageLabel = 'fardo';
    } else if (normalized.includes('15L') || normalized.includes('1,5L') || normalized.includes('1.5L')) {
      packageSize = 6;
      packageLabel = 'fardo';
    } else if (normalized.includes('5L')) {
      packageSize = 2;
      packageLabel = 'fardo';
    }
  }

  if (!packageSize || packageSize <= 0) {
    return {
      package_size: null,
      package_label: null,
      packages: 0,
      package_description: null,
    };
  }

  const label = packageLabel || 'fardo';
  const fullPackages = Math.floor(quantity / packageSize);
  const remainder = quantity % packageSize;

  let description: string | null = null;

  if (fullPackages > 0 && remainder === 0) {
    description = fullPackages === 1 ? `1 ${label} fechado` : `${fullPackages} ${label}s fechados`;
  } else if (fullPackages > 0 && remainder > 0) {
    const pkgText = fullPackages === 1 ? `1 ${label} fechado` : `${fullPackages} ${label}s fechados`;
    const unitText = remainder === 1 ? '1 unidade avulsa' : `${remainder} unidades avulsas`;
    description = `${pkgText} e ${unitText}`;
  } else if (fullPackages === 0 && remainder > 0) {
    description = remainder === 1 ? '1 unidade avulsa' : `${remainder} unidades avulsas`;
  }

  return {
    package_size: packageSize,
    package_label: label,
    packages: fullPackages,
    package_description: description,
  };
}
