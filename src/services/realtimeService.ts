import { IssueVoucherDocument, LPBDocument, AppNotification } from '../types/inventory';
import { soundService } from './soundService';

export type RealtimeEventType = 
  | 'VOUCHER_APPROVED'
  | 'VOUCHER_REJECTED'
  | 'VOUCHER_CREATED'
  | 'STOCK_RECEIVED'
  | 'STORAGE_SYNC';

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  data: unknown;
  timestamp: string;
  sourceTabId: string;
}

type EventListenerCallback = (payload: RealtimeEventPayload) => void;

class RealtimeService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<EventListenerCallback> = new Set();
  public tabId: string = Math.random().toString(36).substring(2, 9);

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('stock_inventory_realtime');
        this.channel.onmessage = (event: MessageEvent<RealtimeEventPayload>) => {
          this.handleIncomingEvent(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported or restricted', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'inventory_broadcast_sync' && e.newValue) {
          try {
            const payload = JSON.parse(e.newValue) as RealtimeEventPayload;
            if (payload.sourceTabId !== this.tabId) {
              this.handleIncomingEvent(payload);
            }
          } catch {
            // ignore JSON parse error
          }
        }
      });
    }
  }

  private handleIncomingEvent(payload: RealtimeEventPayload) {
    if (payload.type === 'VOUCHER_APPROVED') {
      soundService.playApprovalChime();
    } else if (payload.type === 'VOUCHER_CREATED') {
      soundService.playAlertChime();
    }
    this.listeners.forEach((callback) => {
      try {
        callback(payload);
      } catch (err) {
        console.error('Error in realtime event listener:', err);
      }
    });
  }

  public subscribe(callback: EventListenerCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public broadcast(type: RealtimeEventType, data: unknown) {
    const payload: RealtimeEventPayload = {
      type,
      data,
      timestamp: new Date().toISOString(),
      sourceTabId: this.tabId,
    };

    // Play chime locally too if approval
    if (type === 'VOUCHER_APPROVED') {
      soundService.playApprovalChime();
    } else if (type === 'VOUCHER_CREATED') {
      soundService.playAlertChime();
    }

    // Call local listeners
    this.listeners.forEach((cb) => cb(payload));

    // Send through BroadcastChannel for other tabs
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (e) {
        console.warn('BroadcastChannel postMessage failed', e);
      }
    }

    // Also fallback via localStorage for older browsers or cross-context
    try {
      localStorage.setItem('inventory_broadcast_sync', JSON.stringify(payload));
    } catch {
      // storage quota or private mode
    }
  }

  public notifyVoucherApproved(voucher: IssueVoucherDocument) {
    this.broadcast('VOUCHER_APPROVED', voucher);
  }

  public notifyVoucherCreated(voucher: IssueVoucherDocument) {
    this.broadcast('VOUCHER_CREATED', voucher);
  }

  public notifyVoucherRejected(voucher: IssueVoucherDocument) {
    this.broadcast('VOUCHER_REJECTED', voucher);
  }

  public notifyStockReceived(lpb: LPBDocument) {
    this.broadcast('STOCK_RECEIVED', lpb);
  }
}

export const realtimeService = new RealtimeService();
