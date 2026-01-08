import { Brain, Filter, MessageSquare, ShoppingCart, Heart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const features = [
  {
    icon: Brain,
    title: "Înțelegere Inteligentă",
    description: "Agentul înțelege cerințe complexe - materiale specifice, locații, preferințe etice.",
  },
  {
    icon: Filter,
    title: "Filtrare Avansată",
    description: "Exclude automat produsele de masă și evidențiază produsele cu valoare socială ridicată.",
  },
  {
    icon: MessageSquare,
    title: "Conversație Naturală",
    description: "Rafinează rezultatele prin dialog - 'Asta nu e ce am vrut, vreau ceva mai...'",
  },
  {
    icon: ShoppingCart,
    title: "Coș Agregat",
    description: "Combină produse de la mai mulți vânzători într-o singură comandă simplificată.",
  },
  {
    icon: Filter,
    title: "Filtru Etic",
    description: "Exclude automat marile lanțuri și promovează producătorii locali responsabili.",
  },
  {
    icon: Heart,
    title: "Suport Comunitar",
    description: "Conectează cumpărătorii direct cu producătorii locali și artizanii români.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
            Funcționalități Agentice
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-body">
            Mai mult decât un chatbot - un agent care acționează în numele tău
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              variant="feature"
              className="animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
