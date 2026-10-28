import type {
  DeliveryAssignmentStatus,
  DeliveryDriver,
  DriverRunSummary,
  Order,
  OrderStatus,
} from '../types/index.js';
import {
  deliveryAssignmentRepository,
  deliveryDriverRepository,
  deliveryRegionRepository,
} from '../repositories/deliveryRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { orderService } from './orderService.js';
import {
  findMatchingRegion,
  haversineKm,
  resolveOrderCoordinates,
} from './deliveryGeoService.js';
import { getDrivingDistanceKm } from './mapboxService.js';

const DEFAULT_DISPATCH_STATUSES: OrderStatus[] = ['preparing'];

async function getDispatchStatuses(): Promise<OrderStatus[]> {
  const raw = await settingsRepository.getByKey('DRIVER_DISPATCH_STATUSES');
  if (!raw) return DEFAULT_DISPATCH_STATUSES;
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter(Boolean) as OrderStatus[];
  } catch {
    return DEFAULT_DISPATCH_STATUSES;
  }
}

async function getDispatchOrigin(): Promise<{ lat: number; lng: number } | null> {
  const latRaw = await settingsRepository.getByKey('DISPATCH_ORIGIN_LAT');
  const lngRaw = await settingsRepository.getByKey('DISPATCH_ORIGIN_LNG');
  if (!latRaw || !lngRaw) return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

function orderAddressText(order: Order): string {
  const a = order.address;
  if (!a) return '—';
  return [a.street, a.number, a.neighborhood, a.city].filter(Boolean).join(', ');
}

function customerLabel(order: Order): string {
  return order.address?.name || order.notes?.slice(0, 40) || 'Cliente';
}

async function buildRunSummary(
  order: Order,
  driver: DeliveryDriver,
  regionName: string | null,
  distanceKm: number | null
): Promise<DriverRunSummary> {
  const items = order.items ?? [];
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const productSummary =
    items.length === 0
      ? '—'
      : items.length === 1
        ? `${items[0].product_name} × ${items[0].quantity}`
        : `${items[0].product_name} + ${items.length - 1} item(ns)`;

  return {
    order_id: order.id,
    order_number: order.id.slice(0, 8).toUpperCase(),
    customer_name: customerLabel(order),
    address_text: orderAddressText(order),
    neighborhood: order.address?.neighborhood ?? '—',
    region_name: regionName,
    distance_km: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
    product_summary: productSummary,
    total_units: totalUnits,
    shipping_fee: order.shipping_fee,
    total: order.total,
    created_at: order.created_at,
    status: order.status,
  };
}

async function orderPassesRules(
  order: Order,
  driver: DeliveryDriver,
  coords: { lat: number; lng: number },
  regions: Awaited<ReturnType<typeof deliveryRegionRepository.findAllActive>>
): Promise<{ ok: boolean; regionName: string | null; distanceKm: number | null }> {
  const allowedRegionIds = driver.region_ids ?? [];
  const region =
    allowedRegionIds.length === 0
      ? findMatchingRegion(regions, coords.lat, coords.lng)
      : findMatchingRegion(regions, coords.lat, coords.lng, allowedRegionIds);

  if (!region) {
    return { ok: false, regionName: null, distanceKm: null };
  }

  const items = order.items ?? [];
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const maxUnits = driver.max_units;
  if (maxUnits != null && totalUnits > maxUnits) {
    return { ok: false, regionName: region.name, distanceKm: null };
  }

  const allowedCategories = driver.allowed_category_ids ?? [];
  if (allowedCategories.length > 0 && items.length > 0) {
    const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
    for (const pid of productIds) {
      const product = await productRepository.findById(pid);
      if (product?.category_id && !allowedCategories.includes(product.category_id)) {
        return { ok: false, regionName: region.name, distanceKm: null };
      }
    }
  }

  let distanceKm: number | null = null;
  const origin = await getDispatchOrigin();
  if (origin) {
    distanceKm = await getDrivingDistanceKm(origin, coords);
    if (distanceKm == null) {
      distanceKm = haversineKm(origin, coords);
    }
    const maxKm = driver.max_distance_km;
    if (maxKm != null && distanceKm > maxKm) {
      return { ok: false, regionName: region.name, distanceKm };
    }
  }

  return { ok: true, regionName: region.name, distanceKm };
}

export class DeliveryRunService {
  async listAvailable(driverId: string): Promise<DriverRunSummary[]> {
    const driver = await deliveryDriverRepository.findById(driverId);
    if (!driver || !driver.is_active) {
      throw new Error('DRIVER_INACTIVE: Entregador inativo ou não encontrado.');
    }

    const statuses = await getDispatchStatuses();
    const regions = await deliveryRegionRepository.findAllActive();
    const results: DriverRunSummary[] = [];

    for (const status of statuses) {
      const { orders } = await orderRepository.findAll({
        limit: 100,
        status,
        fulfillment_type: 'delivery',
        unassigned_only: true,
      });

      for (const order of orders) {
        const coords = resolveOrderCoordinates(order);
        if (!coords) continue;

        const check = await orderPassesRules(order, driver, coords, regions);
        if (!check.ok) continue;

        results.push(await buildRunSummary(order, driver, check.regionName, check.distanceKm));
      }
    }

    results.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return results;
  }

  async acceptRun(driverId: string, orderId: string): Promise<DriverRunSummary> {
    const driver = await deliveryDriverRepository.findById(driverId);
    if (!driver || !driver.is_active) {
      throw new Error('DRIVER_INACTIVE: Entregador inativo.');
    }

    const order = await orderRepository.findById(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND: Pedido não encontrado.');

    const statuses = await getDispatchStatuses();
    if (!statuses.includes(order.status)) {
      throw new Error('ORDER_NOT_AVAILABLE: Pedido não está disponível para aceite.');
    }
    if (order.fulfillment_type !== 'delivery' || order.driver_id) {
      throw new Error('ORDER_NOT_AVAILABLE: Corrida indisponível.');
    }

    const coords = resolveOrderCoordinates(order);
    if (!coords) throw new Error('ORDER_NO_LOCATION: Pedido sem localização de entrega.');

    const regions = await deliveryRegionRepository.findAllActive();
    const check = await orderPassesRules(order, driver, coords, regions);
    if (!check.ok) {
      throw new Error('ORDER_NOT_AUTHORIZED: Você não está autorizado para esta corrida.');
    }

    await deliveryAssignmentRepository.acceptAtomic(orderId, driverId);

    const profile = driver.profile;
    await orderRepository.updateOrder(orderId, {
      driver_name: profile?.full_name ?? profile?.email ?? null,
      driver_phone: profile?.phone ?? null,
    });

    return buildRunSummary(
      { ...order, driver_id: driverId },
      driver,
      check.regionName,
      check.distanceKm
    );
  }

  async listActive(driverId: string): Promise<DriverRunSummary[]> {
    const driver = await deliveryDriverRepository.findById(driverId);
    if (!driver) return [];
    const assignments = await deliveryAssignmentRepository.findActiveByDriver(driverId);
    const runs: DriverRunSummary[] = [];

    for (const assignment of assignments) {
      const order = await orderRepository.findById(assignment.order_id);
      if (!order) continue;
      const coords = resolveOrderCoordinates(order);
      let distanceKm: number | null = null;
      const origin = await getDispatchOrigin();
      if (origin && coords) {
        distanceKm =
          (await getDrivingDistanceKm(origin, coords)) ?? haversineKm(origin, coords);
      }
      const summary = await buildRunSummary(
        order,
        driver,
        null,
        distanceKm
      );
      summary.assignment_status = assignment.status;
      runs.push(summary);
    }

    return runs;
  }

  async updateAssignmentStatus(
    driverId: string,
    orderId: string,
    status: DeliveryAssignmentStatus
  ): Promise<void> {
    const assignment = await deliveryAssignmentRepository.findByOrderId(orderId);
    if (!assignment || assignment.driver_id !== driverId) {
      throw new Error('ASSIGNMENT_NOT_FOUND: Entrega não encontrada.');
    }

    const order = await orderRepository.findById(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');

    const nextOrderStatus = mapAssignmentToOrderStatus(status);
    if (nextOrderStatus) {
      await orderService.updateOrderStatus(orderId, nextOrderStatus);
    }

    const now = new Date().toISOString();
    const orderPatch: Partial<Order> = {};
    if (status === 'en_route_delivery') {
      orderPatch.delivery_started_at = now;
    }
    if (status === 'completed') {
      orderPatch.delivery_completed_at = now;
      await deliveryDriverRepository.incrementDeliveriesCount(driverId);
    }
    if (Object.keys(orderPatch).length) {
      await orderRepository.updateOrder(orderId, orderPatch);
    }

    await deliveryAssignmentRepository.updateStatus(assignment.id, status);
  }

  async listHistory(
    driverId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ runs: DriverRunSummary[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const driver = await deliveryDriverRepository.findById(driverId);
    if (!driver) return { runs: [], total: 0 };

    const { orders, total } = await orderRepository.findAll({
      page,
      limit,
      fulfillment_type: 'delivery',
      driver_id: driverId,
    });

    const terminal = orders.filter((o) => ['delivered', 'cancelled'].includes(o.status));
    const runs = await Promise.all(
      terminal.map((o) => buildRunSummary(o, driver, null, null))
    );
    return { runs, total: terminal.length || total };
  }
}

function mapAssignmentToOrderStatus(status: DeliveryAssignmentStatus): OrderStatus | null {
  switch (status) {
    case 'en_route_delivery':
    case 'picked_up':
      return 'out_for_delivery';
    case 'completed':
      return 'delivered';
    default:
      return null;
  }
}

export const deliveryRunService = new DeliveryRunService();
