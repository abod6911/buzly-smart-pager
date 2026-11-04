export type OrderStatus = 'preparing' | 'ready' | 'completed' | 'cancelled';

export type ChimeSoundTheme = 'hospitality' | 'coffee-zen' | 'fast-casual' | 'buzzer-retro';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface OrderFeedback {
  rating: number; // 1 to 5
  tags?: string[];
  notes?: string;
  submittedAt: string;
}

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  themeColor: string;
  staffPin: string;
  whatsappFallbackEnabled: boolean;
  chimeTheme?: ChimeSoundTheme;
  voiceAnnounceEnabled?: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  restaurantSlug: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  status: OrderStatus;
  estimatedMinutes: number; // mapped from DB estimated_mins
  pushSubscription?: PushSubscriptionData | null; // mapped from DB push_subscription
  rePingCount: number; // mapped from DB ping_count
  createdAt: string; // ISO string
  readyAt?: string; // ISO string
  completedAt?: string; // ISO string
  lastPingAt?: string; // ISO string
  feedback?: OrderFeedback;
}

export type QueueEventType =
  | 'ORDER_ADDED'
  | 'ORDER_UPDATED'
  | 'ORDER_READY'
  | 'ORDER_REPING'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FEEDBACK'
  | 'QUEUE_SYNC'
  | 'QUEUE_RESET'
  | 'PUSH_REGISTERED'
  | 'RESTAURANT_CREATED'
  | 'RESTAURANT_UPDATED';

export interface QueueRealtimeEvent {
  type: QueueEventType;
  restaurantSlug?: string;
  orderId?: string;
  orderNumber?: string;
  order?: Order;
  orders?: Order[];
  restaurant?: Restaurant;
  feedback?: OrderFeedback;
  timestamp: number;
  sourceTabId?: string;
}
