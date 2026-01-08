import { MapPin, LogIn, LogOut, User, Crown, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import WishlistDrawer from "./WishlistDrawer";
import { Badge } from "./ui/badge";

const Header = () => {
  const { user, signOut, loading } = useAuth();
  const { isSubscribed, openCheckout, openCustomerPortal, remainingMessages } = useSubscription();
  const navigate = useNavigate();

  const handleAuthClick = () => {
    if (user) {
      signOut();
    } else {
      navigate("/auth");
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-xl font-bold text-foreground">LocalAgent</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors font-body">
            Funcționalități
          </a>
          <a href="#reviews" className="text-muted-foreground hover:text-foreground transition-colors font-body">
            Recenzii
          </a>
          <a href="#demo" className="text-muted-foreground hover:text-foreground transition-colors font-body">
            Demo
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <WishlistDrawer />
          
          {user && (
            <>
              {isSubscribed ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openCustomerPortal}
                  className="hidden md:flex items-center gap-2"
                >
                  <Crown className="w-4 h-4 text-accent" />
                  <span className="text-sm font-body">Pro</span>
                  <Settings className="w-3 h-3 text-muted-foreground" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCheckout}
                  className="hidden md:flex items-center gap-2"
                >
                  <Crown className="w-4 h-4" />
                  <span className="font-body">Upgrade</span>
                  <Badge variant="secondary" className="text-xs">
                    {remainingMessages} mesaje
                  </Badge>
                </Button>
              )}
              
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground font-body">
                <User className="w-4 h-4" />
                <span className="max-w-32 truncate">{user.email}</span>
              </div>
            </>
          )}
          
          <Button 
            variant={user ? "ghost" : "default"} 
            onClick={handleAuthClick}
            disabled={loading}
            size={user ? "icon" : "default"}
          >
            {user ? (
              <LogOut className="w-5 h-5" />
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Autentificare
              </>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
