export type UserRole = 'customer' | 'admin' | 'delivery';

export type DeliveryBoundaryType = 'polygon' | 'radius' | 'manual';

export type DeliveryAssignmentStatus =
  | 'accepted'
  | 'en_route_pickup'
  | 'picked_up'
  | 'en_route_delivery'
  | 'completed'
  | 'cancelled';

export interface DeliveryDriver {
  id: string;
  profile_id: string;
  vehicle_type: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  avatar_url: string | null;
  max_distance_km: number | null;
  max_units: number | null;
  allowed_category_ids: string[];
  rules_override: Record<string, unknown>;
  deliveries_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile?: UserProfile;
  region_ids?: string[];
  regions?: DeliveryRegion[];
}

export interface DeliveryRegion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  boundary_type: DeliveryBoundaryType;
  geometry: Record<string, unknown>;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
  neighborhoods: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  driver_id: string;
  status: DeliveryAssignmentStatus;
  accepted_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  order?: Order;
}

export interface DriverRunSummary {
  order_id: string;
  order_number: string;
  customer_name: string;
  address_text: string;
  neighborhood: string;
  region_name: string | null;
  distance_km: number | null;
  product_summary: string;
  total_units: number;
  shipping_fee: number;
  total: number;
  created_at: string;
  status: OrderStatus;
  assignment_status?: DeliveryAssignmentStatus;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  price: number; // decimal parsed to number for response, handled precisely in services
  unit: string;
  minimum_quantity: number;
  maximum_quantity: number | null;
  quantity_step: number;
  package_size: number | null;
  package_label: string | null;
  image_url: string | null;
  is_active: boolean;
  stock_control_enabled: boolean;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface PackageCalculation {
  package_size: number | null;
  package_label: string | null;
  packages: number;
  package_description: string | null;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
  package_info?: PackageCalculation;
  product?: Product;
  created_at: string;
  updated_at: string;
}

export type CartStatus = 'active' | 'converted' | 'abandoned';

export interface Cart {
  id: string;
  user_id: string;
  status: CartStatus;
  items: CartItem[];
  subtotal: number;
  shipping_fee: number;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  reference: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type FulfillmentType = 'delivery' | 'pickup';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface Agency {
  id: string;
  code: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
  pickup_instructions: string | null;
  opening_hours: Record<string, unknown>;
  accepts_pickup: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  package_info?: PackageCalculation;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  address_id: string | null;
  fulfillment_type: FulfillmentType;
  agency_id: string | null;
  pickup_contact_name: string | null;
  pickup_contact_phone: string | null;
  pickup_scheduled_at: string | null;
  ready_for_pickup_at: string | null;
  picked_up_at: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  currency: string;
  notes: string | null;
  idempotency_key: string | null;
  delivery_qr_token: string;
  driver_id?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accepted_at?: string | null;
  delivery_started_at?: string | null;
  delivery_completed_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  address?: Address;
  agency?: Agency;
  payment?: Payment;
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'other';

export interface Payment {
  id: string;
  order_id: string;
  provider: string;
  external_id: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paid_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiLog {
  id: string;
  request_id: string;
  user_id: string | null;
  method: string;
  route: string;
  status_code: number;
  duration: number;
  ip: string | null;
  user_agent: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
  requestId: string;
}

// Fastify Request Extension
declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    startTime: number;
    user?: {
      id: string;
      email: string;
      role: UserRole;
      full_name?: string | null;
      driver_id?: string;
    };
  }
}
