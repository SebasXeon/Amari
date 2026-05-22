export type ItemKind = 'message' | 'action';

export interface MessageItem {
  kind: 'message';
  role: 'user' | 'agent';
  text: string;
}

export interface SubAction {
  title: string;
  state: 'pending' | 'running' | 'done';
}

export interface ActionItem {
  kind: 'action';
  type: string;
  title: string;
  state: 'pending' | 'running' | 'done';
  content: SubAction[];
}

export type ChatItem = MessageItem | ActionItem;
