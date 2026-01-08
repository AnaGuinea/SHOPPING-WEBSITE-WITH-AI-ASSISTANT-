import { MapPin, Heart } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-heading text-xl font-bold text-foreground">LocalAgent</span>
          </div>

          <p className="text-muted-foreground font-body text-center">
            Agentic Commerce pentru afaceri mici din România
          </p>

          <p className="text-sm text-muted-foreground font-body flex items-center gap-1">
            Făcut cu <Heart className="w-4 h-4 text-primary fill-primary" /> pentru comunități locale
          </p>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground font-body">
            © 2025 LocalAgent. Proiect pentru Hackathon - Agentic Commerce Challenge.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
