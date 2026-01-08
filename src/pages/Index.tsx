import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import ReviewsSection from "@/components/ReviewsSection";
import ChatDemo from "@/components/ChatDemo";
import BusinessModelSection from "@/components/BusinessModelSection";
import Footer from "@/components/Footer";
import { ChatProvider } from "@/hooks/useChatState";

const Index = () => {
  return (
    <ChatProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <HeroSection />
          <FeaturesSection />
          <ReviewsSection />
          <ChatDemo />
          <BusinessModelSection />
        </main>
        <Footer />
      </div>
    </ChatProvider>
  );
};

export default Index;
