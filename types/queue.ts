export type OrderStatus = 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  orderNumber: string;
  customerName?: string;
  notes?: string;
  status: OrderStatus;
  estimatedMinutes: number;
  createdAt: string; // ISO string
  readyAt?: string; // ISO string
  completedAt?: string; // ISO string
  rePingCount: number;
  lastPingAt?: string; // ISO string
}

export type QueueEventType =
  | 'ORDER_ADDED'
  | 'ORDER_UPDATED'
  | 'ORDER_READY'
  | 'ORDER_REPING'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'QUEUE_SYNC'
  | 'QUEUE_RESET';

export interface QueueRealtimeEvent {
  type: QueueEventType;
  orderId?: string;
  orderNumber?: string;
  order?: Order;
  orders?: Order[];
  timestamp: number;
  sourceTabId?: string;
}
