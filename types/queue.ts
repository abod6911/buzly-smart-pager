export type OrderStatus = 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName?: string;
  notes?: string;
  status: OrderStatus;
  estimatedMinutes: number; // mapped from DB estimated_mins
  pushSubscription?: PushSubscriptionData | null; // mapped from DB push_subscription
  rePingCount: number; // mapped from DB ping_count
  createdAt: string; // ISO string
  readyAt?: string; // ISO string
  completedAt?: string; // ISO string
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
  | 'QUEUE_RESET'
  | 'PUSH_REGISTERED';

export interface QueueRealtimeEvent {
  type: QueueEventType;
  orderId?: string;
  orderNumber?: string;
  order?: Order;
  orders?: Order[];
  timestamp: number;
  sourceTabId?: string;
}
