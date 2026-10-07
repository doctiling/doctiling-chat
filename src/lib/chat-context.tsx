import * as React from 'react';
import type { ChatApi } from './api';
import type { Paths } from './router';
import type { Language } from '../i18n';
import { DocumentsCacheProvider } from './documents';

/** Everything the screens need from the host (ChatApp props) plus the API client and the path builders. */
export type ChatContextValue = {
  basePath: string;
  locale: Language;
  signInHref: string;
  studioHref: string;
  signOutHref: string;
  version: string;
  api: ChatApi;
  paths: Paths;
};

const ChatContext = React.createContext<ChatContextValue | null>(null);

/** Host values plus the per-app in-memory caches (the documents of each base, for the list and the mention picker). */
export function ChatProvider({ value, children }: { value: ChatContextValue; children: React.ReactNode }) {
  return (
    <ChatContext.Provider value={value}>
      <DocumentsCacheProvider>{children}</DocumentsCacheProvider>
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = React.useContext(ChatContext);
  if (!ctx) throw new Error('useChat outside <ChatApp>');
  return ctx;
}
