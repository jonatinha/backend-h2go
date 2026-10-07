import { Product, PackageCalculation } from '../types/index.js';
import { productRepository } from '../repositories/productRepository.js';
import { calculatePackage } from '../utils/fardo.js';

export class ProductService {
  async listProducts(options?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    search?: string;
    isActive?: boolean;
  }): Promise<{ products: Product[]; total: number }> {
    return productRepository.findAll(options);
  }

  async getProductById(id: string): Promise<Product | null> {
    return productRepository.findById(id);
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    return productRepository.findBySlug(slug);
  }

  validateQuantityRules(product: Product, quantity: number): { valid: boolean; error?: string } {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { valid: false, error: 'A quantidade deve ser um número inteiro positivo.' };
    }

    if (quantity < product.minimum_quantity) {
      return {
        valid: false,
        error: `Quantidade mínima permitida para "${product.name}" é ${product.minimum_quantity}.`,
      };
    }

    if (product.maximum_quantity !== null && quantity > product.maximum_quantity) {
      return {
        valid: false,
        error: `Quantidade máxima permitida para "${product.name}" é ${product.maximum_quantity}.`,
      };
    }

    // Step validation (e.g. 200ml cup: step 4, min 4 -> only multiples of 4 allowed: 4, 8, 12, ..., 48)
    if (product.quantity_step > 1) {
      if (quantity % product.quantity_step !== 0) {
        return {
          valid: false,
          error: `A quantidade para "${product.name}" deve ser em múltiplos de ${product.quantity_step} (ex: ${product.quantity_step}, ${product.quantity_step * 2}, ${product.quantity_step * 3}).`,
        };
      }
    }

    return { valid: true };
  }

  getPackageInfo(product: Product, quantity: number): PackageCalculation {
    return calculatePackage(
      product.sku,
      quantity,
      product.package_size,
      product.package_label
    );
  }

  async createProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    return productRepository.create(data);
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product | null> {
    return productRepository.update(id, data);
  }

  async updatePrice(id: string, price: number): Promise<Product | null> {
    return productRepository.update(id, { price });
  }

  async updateStatus(id: string, isActive: boolean): Promise<Product | null> {
    return productRepository.update(id, { is_active: isActive });
  }

  async deleteProduct(id: string): Promise<boolean> {
    return productRepository.delete(id);
  }
}

export const productService = new ProductService();
