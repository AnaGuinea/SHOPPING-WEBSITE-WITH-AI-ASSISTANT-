import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface ChatContextType {
  pendingQuery: string;
  setPendingQuery: (query: string) => void;
  triggerSearch: (query: string) => void;
  clearPendingQuery: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [pendingQuery, setPendingQuery] = useState("");

  const triggerSearch = useCallback((query: string) => {
    setPendingQuery(query);
  }, []);

  const clearPendingQuery = useCallback(() => {
    setPendingQuery("");
  }, []);

  return (
    <ChatContext.Provider value={{ pendingQuery, setPendingQuery, triggerSearch, clearPendingQuery }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatState = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatState must be used within a ChatProvider");
  }
  return context;
};
