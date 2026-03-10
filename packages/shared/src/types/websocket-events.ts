/**
 * WebSocket event types shared between backend and frontend.
 * Discriminated union enables type-safe routing in consumers.
 */

export type ChangeType =
  | 'messages-added'
  | 'tool-calls-added'
  | 'tokens-updated'
  | 'plan-updated'
  | 'status-changed'
  | 'metadata-changed';

export interface ConversationChangedEvent {
  type: 'conversation:changed';
  seq: number;
  conversationId: string;
  changes: ChangeType[];
  timestamp: string;
}

export interface ConversationCreatedEvent {
  type: 'conversation:created';
  seq: number;
  conversationId: string;
  summary: {
    title: string | null;
    agent: string;
    project: string | null;
    createdAt: string;
  };
  timestamp: string;
}

export interface SystemFullRefreshEvent {
  type: 'system:full-refresh';
  seq: number;
  timestamp: string;
}

export type WebSocketEvent =
  | ConversationChangedEvent
  | ConversationCreatedEvent
  | SystemFullRefreshEvent;

export type WebSocketEventType = WebSocketEvent['type'];

/** Distributive Omit that preserves discriminated union */
export type WebSocketEventPayload =
  | Omit<ConversationChangedEvent, 'seq'>
  | Omit<ConversationCreatedEvent, 'seq'>
  | Omit<SystemFullRefreshEvent, 'seq'>;

// Type guards
export function isConversationChanged(e: WebSocketEvent): e is ConversationChangedEvent {
  return e.type === 'conversation:changed';
}

export function isConversationCreated(e: WebSocketEvent): e is ConversationCreatedEvent {
  return e.type === 'conversation:created';
}

export function isSystemFullRefresh(e: WebSocketEvent): e is SystemFullRefreshEvent {
  return e.type === 'system:full-refresh';
}
