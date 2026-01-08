import { useState, useEffect } from "react";
import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Review {
  id: string;
  email: string;
  rating: number;
  content: string;
  created_at: string;
}

const ReviewsSection = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, content: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reviews:", error);
    } else {
      setReviews(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Trebuie să fii autentificat pentru a lăsa o recenzie");
      return;
    }

    if (!newReview.content.trim()) {
      toast.error("Te rugăm să scrii o recenzie");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("reviews").insert({
      user_id: user.id,
      email: user.email || "Anonim",
      rating: newReview.rating,
      content: newReview.content.trim(),
    });

    if (error) {
      toast.error("Eroare la salvarea recenziei");
      console.error(error);
    } else {
      toast.success("Recenzie adăugată cu succes!");
      setNewReview({ rating: 5, content: "" });
      setShowForm(false);
      fetchReviews();
    }

    setSubmitting(false);
  };

  const renderStars = (rating: number, interactive = false, onSelect?: (r: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"
            } ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
            onClick={() => interactive && onSelect?.(star)}
          />
        ))}
      </div>
    );
  };

  const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const maskedLocal = local.length > 2 
      ? local[0] + "***" + local[local.length - 1]
      : local[0] + "***";
    return `${maskedLocal}@${domain}`;
  };

  return (
    <section id="reviews" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
            Ce spun utilizatorii
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-body">
            Experiențele comunității noastre cu platforma
          </p>
        </div>

        {/* Add Review Button */}
        <div className="text-center mb-12">
          {user ? (
            <Button 
              onClick={() => setShowForm(!showForm)}
              variant="default"
            >
              {showForm ? "Anulează" : "Adaugă o recenzie"}
            </Button>
          ) : (
            <p className="text-muted-foreground">
              <a href="/auth" className="text-primary hover:underline">Autentifică-te</a> pentru a lăsa o recenzie
            </p>
          )}
        </div>

        {/* Review Form */}
        {showForm && user && (
          <Card className="max-w-xl mx-auto mb-12 animate-fade-up">
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Rating</label>
                {renderStars(newReview.rating, true, (r) => setNewReview({ ...newReview, rating: r }))}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Recenzia ta</label>
                <Textarea
                  placeholder="Scrie despre experiența ta cu platforma..."
                  value={newReview.content}
                  onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
                  rows={4}
                />
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                {submitting ? "Se trimite..." : "Trimite recenzia"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Reviews Grid */}
        {loading ? (
          <div className="text-center text-muted-foreground">Se încarcă recenziile...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center text-muted-foreground">
            Nu există recenzii încă. Fii primul care lasă o recenzie!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review, index) => (
              <Card 
                key={review.id} 
                className="animate-fade-up relative"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="pt-6">
                  <Quote className="w-8 h-8 text-primary/20 absolute top-4 right-4" />
                  <div className="mb-4">
                    {renderStars(review.rating)}
                  </div>
                  <p className="text-foreground mb-4 leading-relaxed">
                    "{review.content}"
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="text-sm text-muted-foreground font-medium">
                      {maskEmail(review.email)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("ro-RO")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ReviewsSection;
