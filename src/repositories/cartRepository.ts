import { Cart, CartItem, CartStatus } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';
import { productRepository } from './productRepository.js';
import { multiplyMoney, addMoney } from '../utils/decimal.js';
import { calculatePackage } from '../utils/fardo.js';

let memoryCarts: {
  id: string;
  user_id: string;
  status: CartStatus;
  created_at: string;
  updated_at: string;
}[] = [];

let memoryCartItems: {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}[] = [];

export class CartRepository {
  async getOrCreateActiveCart(userId: string, shippingFee: number = 4.98): Promise<Cart> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        let { data: cartData, error } = await supabaseAdmin
          .from('carts')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (!cartData && !error) {
          const { data: newCart, error: createError } = await supabaseAdmin
            .from('carts')
            .insert({ user_id: userId, status: 'active' })
            .select()
            .single();

          if (!createError && newCart) {
            cartData = newCart;
          }
        }

        if (cartData) {
          const { data: itemsData } = await supabaseAdmin
            .from('cart_items')
            .select('*, product:products(*)')
            .eq('cart_id', cartData.id);

          const items: CartItem[] = [];
          let subtotal = 0;

          if (itemsData) {
            for (const item of itemsData) {
              const prod = item.product ? { ...item.product, price: Number(item.product.price) } : undefined;
              const unitPrice = prod ? prod.price : Number(item.unit_price);
              const itemSubtotal = multiplyMoney(unitPrice, item.quantity);
              subtotal = addMoney(subtotal, itemSubtotal);

              const pkg = prod
                ? calculatePackage(prod.sku, item.quantity, prod.package_size, prod.package_label)
                : undefined;

              items.push({
                id: item.id,
                cart_id: item.cart_id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: unitPrice,
                subtotal: itemSubtotal,
                package_info: pkg,
                product: prod,
                created_at: item.created_at,
                updated_at: item.updated_at,
              });
            }
          }

          const effectiveShipping = items.length > 0 ? shippingFee : 0;
          const total = addMoney(subtotal, effectiveShipping);

          return {
            id: cartData.id,
            user_id: cartData.user_id,
            status: cartData.status,
            items,
            subtotal,
            shipping_fee: effectiveShipping,
            total,
            created_at: cartData.created_at,
            updated_at: cartData.updated_at,
          };
        }
      } catch (err) {
        console.warn('Supabase cart query error, using local fallback:', err);
      }
    }

    // Local fallback
    let cart = memoryCarts.find((c) => c.user_id === userId && c.status === 'active');
    if (!cart) {
      cart = {
        id: crypto.randomUUID(),
        user_id: userId,
        status: 'active',
        created_at: now,
        updated_at: now,
      };
      memoryCarts.push(cart);
    }

    const rawItems = memoryCartItems.filter((i) => i.cart_id === cart.id);
    const items: CartItem[] = [];
    let subtotal = 0;

    for (const item of rawItems) {
      const prod = await productRepository.findById(item.product_id);
      const unitPrice = prod ? prod.price : item.unit_price;
      const itemSubtotal = multiplyMoney(unitPrice, item.quantity);
      subtotal = addMoney(subtotal, itemSubtotal);

      const pkg = prod
        ? calculatePackage(prod.sku, item.quantity, prod.package_size, prod.package_label)
        : undefined;

      items.push({
        id: item.id,
        cart_id: item.cart_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
        package_info: pkg,
        product: prod || undefined,
        created_at: item.created_at,
        updated_at: item.updated_at,
      });
    }

    const effectiveShipping = items.length > 0 ? shippingFee : 0;
    const total = addMoney(subtotal, effectiveShipping);

    return {
      id: cart.id,
      user_id: cart.user_id,
      status: cart.status,
      items,
      subtotal,
      shipping_fee: effectiveShipping,
      total,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
    };
  }

  async addItem(cartId: string, productId: string, quantity: number, unitPrice: number): Promise<void> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('cart_items')
          .select('id, quantity')
          .eq('cart_id', cartId)
          .eq('product_id', productId)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from('cart_items')
            .update({
              quantity: existing.quantity + quantity,
              unit_price: unitPrice,
              updated_at: now,
            })
            .eq('id', existing.id);
          return;
        } else {
          await supabaseAdmin.from('cart_items').insert({
            cart_id: cartId,
            product_id: productId,
            quantity,
            unit_price: unitPrice,
          });
          return;
        }
      } catch (err) {
        console.warn('Supabase cart addItem error, using fallback:', err);
      }
    }

    const existingIndex = memoryCartItems.findIndex(
      (i) => i.cart_id === cartId && i.product_id === productId
    );

    if (existingIndex >= 0) {
      memoryCartItems[existingIndex].quantity += quantity;
      memoryCartItems[existingIndex].unit_price = unitPrice;
      memoryCartItems[existingIndex].updated_at = now;
    } else {
      memoryCartItems.push({
        id: crypto.randomUUID(),
        cart_id: cartId,
        product_id: productId,
        quantity,
        unit_price: unitPrice,
        created_at: now,
        updated_at: now,
      });
    }
  }

  async updateItemQuantity(itemId: string, cartId: string, quantity: number): Promise<boolean> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabaseAdmin
          .from('cart_items')
          .update({ quantity, updated_at: now })
          .eq('id', itemId)
          .eq('cart_id', cartId);

        if (!error) return true;
      } catch (err) {
        console.warn('Supabase cart updateItem error, using fallback:', err);
      }
    }

    const item = memoryCartItems.find((i) => i.id === itemId && i.cart_id === cartId);
    if (!item) return false;
    item.quantity = quantity;
    item.updated_at = now;
    return true;
  }

  async removeItem(itemId: string, cartId: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabaseAdmin
          .from('cart_items')
          .delete()
          .eq('id', itemId)
          .eq('cart_id', cartId);

        if (!error) return true;
      } catch (err) {
        console.warn('Supabase cart removeItem error, using fallback:', err);
      }
    }

    const initialLength = memoryCartItems.length;
    memoryCartItems = memoryCartItems.filter((i) => !(i.id === itemId && i.cart_id === cartId));
    return memoryCartItems.length < initialLength;
  }

  async clearCart(cartId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabaseAdmin.from('cart_items').delete().eq('cart_id', cartId);
      } catch (err) {
        console.warn('Supabase clearCart error, using fallback:', err);
      }
    }

    memoryCartItems = memoryCartItems.filter((i) => i.cart_id !== cartId);
  }

  async convertCart(cartId: string): Promise<void> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        await supabaseAdmin
          .from('carts')
          .update({ status: 'converted', updated_at: now })
          .eq('id', cartId);
      } catch (err) {
        console.warn('Supabase convertCart error, using fallback:', err);
      }
    }

    const cart = memoryCarts.find((c) => c.id === cartId);
    if (cart) {
      cart.status = 'converted';
      cart.updated_at = now;
    }
  }
}

export const cartRepository = new CartRepository();
