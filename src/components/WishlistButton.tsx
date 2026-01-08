import { Heart } from "lucide-react";
import { Button } from "./ui/button";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  url: string;
  title?: string;
  price?: string;
  image?: string;
  className?: string;
  size?: "sm" | "default";
}

const WishlistButton = ({ url, title, price, image, className, size = "sm" }: WishlistButtonProps) => {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const inWishlist = isInWishlist(url);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      navigate("/auth");
      return;
    }
    
    if (inWishlist) {
      await removeFromWishlist(url);
    } else {
      await addToWishlist({ url, title, price, image });
    }
  };

  return (
    <Button
      variant="ghost"
      size={size === "sm" ? "icon" : "default"}
      onClick={handleClick}
      className={cn(
        "transition-all",
        inWishlist ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500",
        className
      )}
      title={inWishlist ? "Elimină din wishlist" : "Adaugă în wishlist"}
    >
      <Heart className={cn("w-4 h-4", inWishlist && "fill-current")} />
    </Button>
  );
};

export default WishlistButton;
