import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

interface WishlistItem {
  id: string;
  product_url: string;
  product_title: string | null;
  product_price: string | null;
  product_image: string | null;
  created_at: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  loading: boolean;
  addToWishlist: (item: { url: string; title?: string; price?: string; image?: string }) => Promise<boolean>;
  removeFromWishlist: (productUrl: string) => Promise<boolean>;
  isInWishlist: (productUrl: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("wishlist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching wishlist:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const extractTitleFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(Boolean);
      
      // Skip common non-descriptive segments like 'cautare', 'search', 'produs', 'p', etc.
      const skipWords = ['cautare', 'search', 'produs', 'product', 'p', 'item', 'pd', 'oferta', 'offer'];
      const meaningfulSegments = segments.filter(s => !skipWords.includes(s.toLowerCase()));
      
      // Get the last meaningful segment, or fallback to last segment
      const lastSegment = meaningfulSegments[meaningfulSegments.length - 1] || segments[segments.length - 1] || '';
      
      // Clean up the segment
      let cleaned = lastSegment
        .replace(/\.(html|htm|php|aspx?)$/i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\?.*$/, '')
        .replace(/[0-9]+$/, '') // Remove trailing numbers (often product IDs)
        .trim();
      
      // If still empty or too short, use domain name
      if (!cleaned || cleaned.length < 3) {
        const hostname = urlObj.hostname.replace('www.', '');
        cleaned = hostname.split('.')[0];
      }
      
      // Capitalize first letter
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    } catch {
      return 'Produs';
    }
  };

  const addToWishlist = async (item: { url: string; title?: string; price?: string; image?: string }) => {
    if (!user) {
      toast({
        title: "Autentificare necesară",
        description: "Trebuie să fii autentificat pentru a adăuga în wishlist",
        variant: "destructive",
      });
      return false;
    }

    // Use provided title, or extract from URL if not available
    const productTitle = item.title && item.title !== 'Produs' && item.title !== 'Vezi produs'
      ? item.title 
      : extractTitleFromUrl(item.url);

    const { error } = await supabase.from("wishlist").insert({
      user_id: user.id,
      product_url: item.url,
      product_title: productTitle,
      product_price: item.price || null,
      product_image: item.image || null,
    });

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Deja în wishlist",
          description: "Acest produs este deja în wishlist-ul tău",
        });
      } else {
        toast({
          title: "Eroare",
          description: "Nu s-a putut adăuga în wishlist",
          variant: "destructive",
        });
      }
      return false;
    }

    toast({
      title: "Adăugat în wishlist",
      description: "Produsul a fost adăugat în wishlist",
    });
    
    await fetchWishlist();
    return true;
  };

  const removeFromWishlist = async (productUrl: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", user.id)
      .eq("product_url", productUrl);

    if (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut elimina din wishlist",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Eliminat din wishlist",
      description: "Produsul a fost eliminat din wishlist",
    });
    
    await fetchWishlist();
    return true;
  };

  const isInWishlist = (productUrl: string) => {
    return items.some((item) => item.product_url === productUrl);
  };

  return (
    <WishlistContext.Provider value={{ items, loading, addToWishlist, removeFromWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
