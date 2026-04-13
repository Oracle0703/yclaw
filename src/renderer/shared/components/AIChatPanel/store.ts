import { create } from 'zustand';
import type { ChatMessage } from '@shared/types';

interface AIChatState {
  messages: ChatMessage[];
  conversationId: string | null;
  isOpen: boolean;
  isLoading: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  addMessage: (message: ChatMessage) => void;
  setConversationId: (id: string) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAIChatStore = create<AIChatState>((set) => ({
  messages: [],
  conversationId: null,
  isOpen: false,
  isLoading: false,

  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setConversationId: (id) => set({ conversationId: id }),
  setLoading: (loading) => set({ isLoading: loading }),

  clear: () => set({ messages: [], conversationId: null }),
}));
