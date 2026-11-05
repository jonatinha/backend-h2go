export type PrintRequestQueueStatus = 'active' | 'archived';

export type PrintRequest = {
  id: string;
  receipt_id: string;
  order_id: string;
  queue_status: PrintRequestQueueStatus;
  printed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PrintRequestListItem = PrintRequest & {
  order_number: string;
  order_status: string;
  receipt_number: string;
  payer_name: string;
  amount: number;
};
