import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_MESSAGES_PER_DAY = 3;

// Check subscription status from Stripe
async function checkUserSubscription(userId: string, supabase: any): Promise<boolean> {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) return false;

    // Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.email) return false;

    // Check Stripe for active subscription
    const customersRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(profile.email)}`,
      {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      }
    );
    const customers = await customersRes.json();
    
    if (!customers.data?.[0]?.id) return false;

    const subsRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customers.data[0].id}&status=active`,
      {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      }
    );
    const subscriptions = await subsRes.json();
    
    return subscriptions.data?.length > 0;
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
}

// Check and increment message count server-side
async function checkAndIncrementMessageCount(
  userId: string,
  isSubscribed: boolean,
  supabase: any
): Promise<{ allowed: boolean; count: number; remaining: number }> {
  // Subscribed users have unlimited messages
  if (isSubscribed) {
    return { allowed: true, count: 0, remaining: Infinity };
  }

  try {
    // Call the database function to increment message count
    const { data, error } = await supabase.rpc("increment_message_count", {
      p_user_id: userId,
    });

    if (error) {
      console.error("Error incrementing message count:", error);
      // Default to allowing if there's an error (fail open for UX, but log it)
      return { allowed: true, count: 0, remaining: FREE_MESSAGES_PER_DAY };
    }

    const messageCount = data?.[0]?.message_count || 0;
    const canSend = data?.[0]?.can_send ?? true;
    const remaining = Math.max(0, FREE_MESSAGES_PER_DAY - messageCount);

    console.log(`User ${userId}: message count = ${messageCount}, can_send = ${canSend}, remaining = ${remaining}`);

    return { allowed: canSend, count: messageCount, remaining };
  } catch (error) {
    console.error("Error in message count check:", error);
    return { allowed: true, count: 0, remaining: FREE_MESSAGES_PER_DAY };
  }
}

// Lista de domenii cunoscute pentru companii mari (non-IMM)
const LARGE_COMPANY_DOMAINS = [
  'emag.ro',
  'altex.ro',
  'flanco.ro',
  'dedeman.ro',
  'ikea.ro',
  'carrefour.ro',
  'kaufland.ro',
  'lidl.ro',
  'auchan.ro',
  'mediamarkt.ro'
];

// Lista de site-uri media/știri care nu sunt magazine (vor fi filtrate)
const MEDIA_SITE_PATTERNS = [
  'zf.ro',
  'digi24.ro',
  'stirileprotv.ro',
  'hotnews.ro',
  'mediafax.ro',
  'adevarul.ro',
  'libertatea.ro',
  'gandul.ro',
  'ziare.com',
  'antena3.ro',
  'romaniatv.net',
  'observatornews.ro',
  'realitatea.net',
  'capital.ro',
  'forbes.ro',
  'businessmagazin.ro',
  'wall-street.ro',
  'profit.ro',
  'economica.net',
  'startupcafe.ro',
  'g4media.ro',
  'wikipedia.org',
  'facebook.com',
  'instagram.com',
  'youtube.com',
  'tiktok.com',
  'reddit.com',
  'blog.',
  'blogspot.',
  'wordpress.com',
  'medium.com'
];

// Minimum rating threshold for filtering
const MIN_RATING_THRESHOLD = 3.5;

// Verifică dacă un domeniu aparține unei companii mari
function isLargeCompanyDomain(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return LARGE_COMPANY_DOMAINS.some(domain => lowerUrl.includes(domain));
}

// Extrage domeniul dintr-un URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Obține rating-ul de pe Google Places pentru un business
async function getGooglePlacesRating(businessName: string): Promise<{ rating: number | null; reviewCount: number | null; error?: string }> {
  const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
  
  if (!GOOGLE_PLACES_API_KEY) {
    console.log("GOOGLE_PLACES_API_KEY not configured");
    return { rating: null, reviewCount: null, error: "API key not configured" };
  }

  try {
    // Step 1: Search for the place
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(businessName + " Romania")}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total&key=${GOOGLE_PLACES_API_KEY}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (searchData.status !== "OK" || !searchData.candidates || searchData.candidates.length === 0) {
      console.log(`No Google Places results for: ${businessName}`);
      return { rating: null, reviewCount: null };
    }

    const place = searchData.candidates[0];
    console.log(`Google Places found: ${place.name} - Rating: ${place.rating}, Reviews: ${place.user_ratings_total}`);
    
    return {
      rating: place.rating || null,
      reviewCount: place.user_ratings_total || null
    };
  } catch (error) {
    console.error("Error fetching Google Places rating:", error);
    return { rating: null, reviewCount: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Caută firme IMM în baza de date locală
async function searchSMECompanies(query: string, limit = 10): Promise<any[]> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Căutare full-text în denumire pentru firmele IMM
    const { data, error } = await supabase
      .from("company_financials")
      .select("cui, denumire, caen, cifra_afaceri_neta, numar_mediu_salariati, is_sme")
      .eq("is_sme", true)
      .textSearch("denumire", query, { type: "websearch", config: "romanian" })
      .limit(limit);

    if (error) {
      console.log("SME search error, trying ilike:", error.message);
      // Fallback la căutare simplă
      const { data: fallbackData } = await supabase
        .from("company_financials")
        .select("cui, denumire, caen, cifra_afaceri_neta, numar_mediu_salariati, is_sme")
        .eq("is_sme", true)
        .ilike("denumire", `%${query}%`)
        .limit(limit);
      
      return fallbackData || [];
    }

    console.log(`Found ${data?.length || 0} SME companies for query: ${query}`);
    return data || [];
  } catch (error) {
    console.error("Error searching SME companies:", error);
    return [];
  }
}

// Verifică dacă un CUI aparține unei IMM
async function checkCompanyIsSME(cui: string): Promise<{ found: boolean; is_sme: boolean; company?: any }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("company_financials")
      .select("*")
      .eq("cui", cui)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error checking CUI:", error);
      return { found: false, is_sme: false };
    }

    return {
      found: !!data,
      is_sme: data?.is_sme || false,
      company: data
    };
  } catch (error) {
    console.error("Error checking company:", error);
    return { found: false, is_sme: false };
  }
}

async function searchProductsOnWeb(query: string): Promise<{ results: any[]; error?: string }> {
  const SERP_API_KEY = Deno.env.get("SERP_API_KEY");
  
  if (!SERP_API_KEY) {
    console.log("SERP_API_KEY not configured, skipping web search");
    return { results: [], error: "API key not configured" };
  }

  try {
    // Use regular Google Search (not Shopping) because Shopping API for Romania
    // returns internal Google links, not direct store URLs
    const searchQuery = `${query} cumpara online Romania`;
    const serpUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&location=Romania&hl=ro&gl=ro&num=15&api_key=${SERP_API_KEY}`;
    
    console.log("Searching with SerpAPI Google Search for:", searchQuery);
    
    const response = await fetch(serpUrl);
    const data = await response.json();
    
    console.log("SerpAPI response status:", response.status);
    
    if (data.error) {
      console.error("SerpAPI error:", data.error);
      return { results: [], error: data.error };
    }
    
    const organicResults = data.organic_results || [];
    console.log(`Found ${organicResults.length} organic results`);
    
    // Lista de site-uri IMM preferate (magazine mici locale)
    const smeEcommercePatterns = ['tricouriador.ro', 'fashionup.ro', 'molly.ro', 'bonami.ro', 'vivre.ro', 'noriel.ro', 'originals.ro', 'inart.ro'];
    
    // Lista de retaileri mari (non-IMM) - vor fi filtrați
    const largeRetailerPatterns = ['emag.ro', 'altex.ro', 'flanco.ro', 'dedeman.ro', 'ikea.ro', 'carrefour.ro', 'kaufland.ro', 'lidl.ro', 'auchan.ro', 'mediamarkt.ro'];
    
    // Filter out large retailers, Google links, and media sites
    const filteredResults = organicResults
      .filter((r: any) => {
        const link = r.link || '';
        if (link.includes('google.com')) return false;
        
        const isLargeRetailer = largeRetailerPatterns.some(pattern => link.toLowerCase().includes(pattern));
        if (isLargeRetailer) {
          console.log(`Filtered out large retailer: ${link}`);
          return false;
        }
        
        // Filter out media/news sites
        const isMediaSite = MEDIA_SITE_PATTERNS.some(pattern => link.toLowerCase().includes(pattern));
        if (isMediaSite) {
          console.log(`Filtered out media site: ${link}`);
          return false;
        }
        
        return true;
      })
      .slice(0, 12);
    
    // Fetch Google Reviews ratings for each result in parallel
    console.log("Fetching Google Reviews ratings for filtered results...");
    const resultsWithRatings = await Promise.all(
      filteredResults.map(async (r: any) => {
        const domain = extractDomain(r.link || '');
        const businessName = r.displayed_link?.split('/')[0] || domain;
        const { rating, reviewCount } = await getGooglePlacesRating(businessName);
        
        const isSMEEcommerce = smeEcommercePatterns.some(pattern => (r.link || '').toLowerCase().includes(pattern));
        
        return {
          title: r.title || 'Produs',
          url: r.link || '',
          description: r.snippet || '',
          source: r.displayed_link || '',
          images: r.thumbnail ? [r.thumbnail] : [],
          isSME: isSMEEcommerce,
          googleRating: rating,
          reviewCount: reviewCount
        };
      })
    );
    
    // Sort results: good ratings first, low ratings at end, no rating in middle
    const enrichedResults = resultsWithRatings
      .sort((a: any, b: any) => {
        // Category scores: good rating (>=3.5) = 2, no rating = 1, low rating (<3.5) = 0
        const getCategory = (r: any) => {
          if (r.googleRating === null) return 1; // No rating - middle priority
          if (r.googleRating >= MIN_RATING_THRESHOLD) return 2; // Good rating - top priority
          return 0; // Low rating - bottom priority
        };
        
        const aCat = getCategory(a);
        const bCat = getCategory(b);
        
        // First sort by category
        if (aCat !== bCat) return bCat - aCat;
        
        // Within same category, sort by rating value (if both have ratings)
        if (a.googleRating !== null && b.googleRating !== null) {
          if (b.googleRating !== a.googleRating) return b.googleRating - a.googleRating;
        }
        
        // Then SME preference
        return (b.isSME ? 1 : 0) - (a.isSME ? 1 : 0);
      })
      .slice(0, 8); // Show more results now that we include low-rated ones
    
    console.log("Sorted results:", enrichedResults.map((r: any) => 
      `${r.source}: ${r.googleRating !== null ? r.googleRating + '⭐' : 'N/A'} ${r.googleRating !== null && r.googleRating < MIN_RATING_THRESHOLD ? '(low)' : ''}`
    ));
    
    console.log("Final results with ratings:", enrichedResults.map((r: any) => `${r.source}: ${r.googleRating}⭐ (${r.reviewCount} reviews)`));
    
    return { results: enrichedResults };
  } catch (error) {
    console.error("Error searching web:", error);
    return { results: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

function formatSMECompaniesForAI(companies: any[]): string {
  if (companies.length === 0) {
    return "Nu am găsit firme IMM în baza de date.";
  }
  
  return companies.map((c, i) => {
    const employees = c.numar_mediu_salariati ? `${c.numar_mediu_salariati} angajați` : 'N/A';
    const turnover = c.cifra_afaceri_neta ? `${(c.cifra_afaceri_neta / 1000000).toFixed(1)}M RON` : 'N/A';
    return `${i + 1}. ${c.denumire || 'N/A'} (CUI: ${c.cui}, CAEN: ${c.caen || 'N/A'}) - ${employees}, ${turnover} cifră afaceri`;
  }).join('\n');
}

function formatWebResultsForAI(results: any[]): string {
  if (results.length === 0) {
    return "";
  }
  
  return results.map((r, i) => {
    let entry = `${i + 1}. **${r.title || 'N/A'}**`;
    if (r.price) entry += ` - ${r.price}`;
    if (r.source) entry += ` (${r.source})`;
    // Add Google rating info
    if (r.googleRating !== null) {
      entry += ` ⭐ ${r.googleRating}/5 (${r.reviewCount || 0} recenzii)`;
    }
    entry += `\n   Link: ${r.url || 'N/A'}`;
    if (r.description) entry += `\n   ${r.description}`;
    if (r.images && r.images.length > 0) {
      entry += `\n   Imagine: ${r.images[0]}`;
    }
    return entry;
  }).join('\n\n');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Received messages:", messages.length);

    // Initialize Supabase client for auth and rate limiting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header (optional - anonymous users can still use with IP-based limits)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let isSubscribed = false;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
        // Check subscription status
        isSubscribed = await checkUserSubscription(userId, supabase);
        console.log(`Authenticated user: ${userId}, subscribed: ${isSubscribed}`);
      }
    }

    // Server-side rate limiting for authenticated users
    if (userId) {
      const { allowed, count, remaining } = await checkAndIncrementMessageCount(
        userId,
        isSubscribed,
        supabase
      );

      if (!allowed) {
        console.log(`Rate limit exceeded for user ${userId}: ${count} messages today`);
        return new Response(
          JSON.stringify({
            error: "Ai atins limita de mesaje zilnice. Fă upgrade la Pro pentru mesaje nelimitate!",
            rateLimited: true,
            messagesUsed: count,
            remaining: 0,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Extract the last user message to search for companies and products
    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
    let companiesContext = "";
    let webSearchContext = "";
    
    if (lastUserMessage?.content) {
      // Search SME companies and web in parallel
      const [smeCompanies, webResults] = await Promise.all([
        searchSMECompanies(lastUserMessage.content),
        searchProductsOnWeb(lastUserMessage.content)
      ]);
      
      if (smeCompanies.length > 0) {
        companiesContext = `\n\n🏢 FIRME IMM VERIFICATE (conform criteriilor: <250 angajați, ≤50M EUR cifră afaceri, ≤43M EUR bilanț):\n${formatSMECompaniesForAI(smeCompanies)}\n\nAcestea sunt firme mici și mijlocii verificate din baza de date ANAF.`;
      }
      
      if (webResults.results.length > 0) {
        const formattedResults = formatWebResultsForAI(webResults.results);
        console.log("Web results for AI (SME preferred):", formattedResults);
        webSearchContext = `\n\n🔍 REZULTATE CĂUTARE WEB (PRIORITATE MAGAZINE MICI LOCALE):\n${formattedResults}\n\nACESTEA SUNT LINKURI REALE ȘI FUNCȚIONALE de la magazine locale. Folosește-le direct în răspunsul tău!`;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Ești un agent de comerț agentic pentru România, specializat în sprijinirea afacerilor mici și mijlocii (IMM-uri).

🎯 MISIUNEA TA: Să ajuți utilizatorii să găsească produse de la AFACERI MICI ȘI MIJLOCII românești, nu de la retaileri mari.

📊 CRITERII IMM (definiția EU):
- Mai puțin de 250 de angajați
- Cifra de afaceri ≤ 50 milioane EUR
- Total bilanț ≤ 43 milioane EUR

Personalitate:
- Prietenos și susținător al economiei locale
- Răspunzi în română
- Folosești emoji-uri moderat
- Expert în produse artizanale, locale și de la producători mici

🚫 REGULI CRITICE:
1. PRIORITIZEAZĂ magazinele mici și producătorii locali
2. EVITĂ să recomanzi retaileri mari (eMAG, Altex, Carrefour, IKEA, Dedeman etc.)
3. Menționează beneficiile cumpărăturilor de la afaceri locale:
   - Sprijini economia locală
   - Produse mai personalizate
   - Contact direct cu producătorul
   - Susții antreprenoriatul românesc

📝 Format răspuns pentru produse (OBLIGATORIU):
1. **Nume produs** 🛍️
   🖼️ Imagine: [URL-ul EXACT al imaginii dacă este disponibil]
   🔗 Link: [URL-ul EXACT din rezultatele furnizate]
   💰 Preț: [dacă este disponibil]
   📝 Descriere: [scurtă descriere]
   ✅ De ce să cumperi de aici: [beneficii afacere locală]

IMPORTANT: Dacă rezultatele conțin o linie "Imagine:", INCLUDE întotdeauna acea linie în răspunsul tău exact cum este!
FOLOSEȘTE DOAR linkurile exacte furnizate în rezultatele web - NU INVENTA niciodată URL-uri!
Răspunde concis dar informativ. Maximum 200 cuvinte pe răspuns.${companiesContext}${webSearchContext}`
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Prea multe cereri. Te rugăm încearcă din nou." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credite insuficiente." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Eroare AI gateway" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response started");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Eroare necunoscută" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
