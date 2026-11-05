export type DeliveryReceiptStatus = 'pending_acceptance' | 'accepted' | 'rejected' | 'void';

export interface DeliveryReceipt {
  id: string;
  receipt_number: string;
  order_id: string;
  session_id: string;
  status: DeliveryReceiptStatus;
  amount: number;
  amount_extenso: string;
  payer_name: string;
  payer_document: string | null;
  payee_name: string;
  payee_document: string;
  reference_description: string;
  issue_city: string;
  issue_state: string;
  issued_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  accepted_by_user_id: string | null;
  acceptance_ip: string | null;
  acceptance_user_agent: string | null;
  terms_version: string;
  scanned_by_role: 'admin' | 'driver';
  scanned_by_profile_id: string | null;
  scanned_by_driver_id: string | null;
  created_at: string;
  updated_at: string;
}

export const RECEIPT_TERMS_TEXT =
  'Declaro que recebi as informações referentes ao pagamento, valores, condições e obrigações descritas neste recibo digital e concordo com o recebimento do pedido conforme descrito.';
