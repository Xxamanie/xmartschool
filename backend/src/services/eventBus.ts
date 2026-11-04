import { EventEmitter } from 'node:events';

export type MessageEvent = {
  type: 'staff-message' | 'private-message';
  schoolId: string;
  userIds?: string[];
  conversationId?: string;
};

const bus = new EventEmitter();
bus.setMaxListeners(0);
export const publishMessageEvent = (event: MessageEvent) => bus.emit('message', event);
export const subscribeMessageEvents = (listener: (event: MessageEvent) => void) => {
  bus.on('message', listener);
  return () => { bus.off('message', listener); };
};
