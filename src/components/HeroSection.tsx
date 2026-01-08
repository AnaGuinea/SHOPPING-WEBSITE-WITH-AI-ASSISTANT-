import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import heroBg from "@/assets/hero-bg.png";
import { useChatState } from "@/hooks/useChatState";

const HeroSection = () => {
  const [query, setQuery] = useState("");
  const { triggerSearch } = useChatState();

  const exampleQueries = [
    "Tricou 100% bumbac portocaliu de la un producător local",
    "Coș cu produse de la 3 brutării și ferme locale",
    "Ceramică tradițională din zona Sibiului",
  ];

  const handleSearch = () => {
    if (!query.trim()) return;
    triggerSearch(query);
    setQuery("");
    // Scroll to demo section
    const demoSection = document.getElementById("demo");
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 opacity-40"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 backdrop-blur-sm mb-8 animate-fade-up">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-secondary-foreground">
              Comerț Agentic pentru România
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Descoperă afaceri{" "}
            <span className="text-gradient">locale</span>{" "}
            cu puterea AI
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto font-body animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Spune ce ai nevoie, iar agentul nostru inteligent găsește cele mai bune produse de la afaceri mici și locale din România.
          </p>

          {/* Search Input */}
          <div className="relative max-w-2xl mx-auto mb-8 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Input
              variant="chat"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Descrie ce cauți... ex: 'miere de albine de la un apicultor local'"
              className="w-full"
            />
            <Button
              variant="chat"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              size="icon"
              onClick={handleSearch}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>

          {/* Example Queries */}
          <div className="flex flex-wrap justify-center gap-3 animate-fade-up" style={{ animationDelay: '0.4s' }}>
            {exampleQueries.map((example, index) => (
              <button
                key={index}
                onClick={() => setQuery(example)}
                className="px-4 py-2 rounded-full bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-card/80 transition-all duration-300 font-body"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute bottom-10 left-10 w-20 h-20 rounded-full bg-primary/10 animate-float hidden lg:block" />
      <div className="absolute top-40 right-20 w-16 h-16 rounded-full bg-accent/20 animate-float hidden lg:block" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-40 right-40 w-12 h-12 rounded-full bg-secondary animate-float hidden lg:block" style={{ animationDelay: '2s' }} />
    </section>
  );
};

export default HeroSection;
