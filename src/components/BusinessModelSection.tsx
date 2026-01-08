import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CreditCard, Building2, TrendingUp, Users } from "lucide-react";

const models = [
  {
    icon: CreditCard,
    title: "Vizibilitate pentru afacerile mici",
    description: "Promovăm afacerile locale și le oferim expunere către clienți noi din comunitate",
  },
  {
    icon: Building2,
    title: "Model SaaS",
    description: "Abonament lunar pentru magazine care vor vizibilitate și acces la platforma AI",
  },
  {
    icon: TrendingUp,
    title: "Premium Features",
    description: "Analize avansate, promovare prioritară și integrări personalizate pentru vendori",
  },
  {
    icon: Users,
    title: "Parteneriate",
    description: "Colaborări cu cooperative locale și asociații de producători",
  },
];

const BusinessModelSection = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-6">
              Model de Afacere <span className="text-gradient">Viabil</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 font-body leading-relaxed">
              LocalAgent nu este doar o idee - este o platformă cu potențial real de monetizare și scalabilitate.
              Creăm valoare atât pentru cumpărători, cât și pentru vânzătorii locali.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <h4 className="font-heading font-semibold text-foreground mb-1">Scalabilitate</h4>
                  <p className="text-muted-foreground font-body">
                    Poate fi extins de la nivel de cartier la nivel național și chiar regional (Europa de Est).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-accent mt-2" />
                <div>
                  <h4 className="font-heading font-semibold text-foreground mb-1">Diferențiere</h4>
                  <p className="text-muted-foreground font-body">
                    Focus exclusiv pe afaceri mici și locale - nu competăm cu Amazon, ci oferim o alternativă etică.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-secondary-foreground mt-2" />
                <div>
                  <h4 className="font-heading font-semibold text-foreground mb-1">Impact Social</h4>
                  <p className="text-muted-foreground font-body">
                    Ajutăm comunitățile locale să prospere și creăm conexiuni autentice între producători și consumatori.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {models.map((model, index) => (
              <Card 
                key={index} 
                variant="feature"
                className="animate-fade-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader className="pb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <model.icon className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{model.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground font-body">
                    {model.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BusinessModelSection;
