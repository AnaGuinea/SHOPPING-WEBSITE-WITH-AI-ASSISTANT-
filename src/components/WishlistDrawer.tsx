import { Heart, Trash2, ExternalLink, ShoppingBag } from "lucide-react";
import { Button } from "./ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./ui/drawer";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const WishlistDrawer = () => {
  const { items, removeFromWishlist, loading } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();

  const extractTitleFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // First try to get a readable name from the hostname
      const hostname = urlObj.hostname.replace('www.', '');
      const siteName = hostname.split('.')[0];
      // Capitalize and clean up
      return siteName.charAt(0).toUpperCase() + siteName.slice(1);
    } catch {
      return 'Produs';
    }
  };

  const getDisplayTitle = (item: { product_title: string | null; product_url: string }) => {
    if (item.product_title && item.product_title.trim() !== '') {
      return item.product_title;
    }
    return extractTitleFromUrl(item.product_url);
  };

  const handleTriggerClick = () => {
    if (!user) {
      navigate("/auth");
    }
  };

  if (!user) {
    return (
      <Button variant="ghost" size="icon" onClick={handleTriggerClick}>
        <Heart className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Heart className="w-5 h-5" />
          {items.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
              {items.length}
            </span>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 font-heading">
              <Heart className="w-5 h-5 text-primary" />
              Wishlist-ul meu
            </DrawerTitle>
            <DrawerDescription className="font-body">
              {items.length === 0 
                ? "Nu ai produse salvate încă" 
                : `${items.length} produs${items.length > 1 ? "e" : ""} salvat${items.length > 1 ? "e" : ""}`}
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="px-4 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground font-body">
                  Explorează produse și adaugă-le în wishlist folosind butonul cu inimioară
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    {item.product_image && (
                      <img
                        src={item.product_image}
                        alt={getDisplayTitle(item)}
                        className="w-16 h-16 object-cover rounded-md border border-border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <a
                        href={item.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body text-sm font-medium text-foreground hover:text-primary transition-colors truncate block"
                      >
                        {getDisplayTitle(item)}
                      </a>
                      {item.product_price && (
                        <p className="text-sm text-primary font-semibold">
                          {item.product_price}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeFromWishlist(item.product_url)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Închide</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default WishlistDrawer;
