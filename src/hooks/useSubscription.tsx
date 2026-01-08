import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const FREE_MESSAGES_PER_DAY = 3;

interface SubscriptionContextType {
  isSubscribed: boolean;
  subscriptionEnd: string | null;
  isLoading: boolean;
  messagesUsedToday: number;
  canSendMessage: boolean;
  remainingMessages: number;
  checkSubscription: () => Promise<void>;
  refreshMessageCount: () => Promise<void>;
  openCheckout: () => Promise<void>;
  openCustomerPortal: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user, session } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messagesUsedToday, setMessagesUsedToday] = useState(0);

  // Fetch message count from database
  const refreshMessageCount = useCallback(async () => {
    if (!user) {
      setMessagesUsedToday(0);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_message_count", {
        p_user_id: user.id,
      });

      if (error) {
        console.error("Error fetching message count:", error);
        return;
      }

      const count = data?.[0]?.message_count || 0;
      setMessagesUsedToday(count);
    } catch (err) {
      console.error("Error refreshing message count:", err);
    }
  }, [user]);

  // Load message count from database
  useEffect(() => {
    if (user) {
      refreshMessageCount();
    } else {
      setMessagesUsedToday(0);
    }
  }, [user, refreshMessageCount]);

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setIsSubscribed(false);
      setSubscriptionEnd(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setIsSubscribed(data?.subscribed ?? false);
      setSubscriptionEnd(data?.subscription_end ?? null);
    } catch (err) {
      console.error("Error checking subscription:", err);
      setIsSubscribed(false);
      setSubscriptionEnd(null);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  // Check subscription on auth change
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Periodic refresh every minute
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      checkSubscription();
      refreshMessageCount();
    }, 60000);
    return () => clearInterval(interval);
  }, [session, checkSubscription, refreshMessageCount]);

  const canSendMessage = isSubscribed || messagesUsedToday < FREE_MESSAGES_PER_DAY;
  const remainingMessages = isSubscribed ? Infinity : Math.max(0, FREE_MESSAGES_PER_DAY - messagesUsedToday);

  const openCheckout = async () => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening checkout:", err);
    }
  };

  const openCustomerPortal = async () => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening customer portal:", err);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        subscriptionEnd,
        isLoading,
        messagesUsedToday,
        canSendMessage,
        remainingMessages,
        checkSubscription,
        refreshMessageCount,
        openCheckout,
        openCustomerPortal,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};
