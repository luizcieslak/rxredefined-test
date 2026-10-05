export type OrderType = 'dine_in' | 'takeout' | 'delivery';
export type OrderStatus = 'received' | 'preparing' | 'ready' | 'picked_up' | 'cancelled';
export type OrderAction = 'start' | 'ready' | 'pickup' | 'cancel';

/** Queue filter: the whole active queue, or one of its statuses. */
export type QueueFilter = 'active' | 'received' | 'preparing';

export interface OrderItem {
  menu_item_id: number;
  name: string;
  quantity: number;
}

export interface QueueOrder {
  id: number;
  customer_name: string;
  type: OrderType;
  is_vip: boolean;
  status: OrderStatus;
  placed_at: string;
  promised_at: string | null;
  items: OrderItem[];
  score: number;
  minutes_waiting: number;
  allowed_actions: OrderAction[];
}
