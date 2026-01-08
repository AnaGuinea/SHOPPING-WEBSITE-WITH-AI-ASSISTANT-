import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Criteriile IMM conform EU (convertite în RON, curs ~5 RON/EUR)
const SME_CRITERIA = {
  MAX_EMPLOYEES: 250,
  MAX_TURNOVER_RON: 50_000_000 * 5, // 50M EUR * 5 = 250M RON
  MAX_BALANCE_SHEET_RON: 43_000_000 * 5, // 43M EUR * 5 = 215M RON
};

interface FinancialData {
  CUI: string;
  CAEN: string;
  i1: string; // Active imobilizate
  i2: string; // Active circulante
  i10: string; // Capitaluri total
  i13: string; // Cifra de afaceri netă
  i18: string; // Profit net
  i19: string; // Pierdere netă
  i20: string; // Număr mediu salariați
}

function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function isSME(data: FinancialData): boolean {
  const employees = parseNumber(data.i20) || 0;
  const turnover = parseNumber(data.i13) || 0;
  const totalBalance = (parseNumber(data.i1) || 0) + (parseNumber(data.i2) || 0);

  // Trebuie să îndeplinească criteriul de angajați ȘI cel puțin unul din celelalte două
  if (employees >= SME_CRITERIA.MAX_EMPLOYEES) return false;
  
  return turnover <= SME_CRITERIA.MAX_TURNOVER_RON || 
         totalBalance <= SME_CRITERIA.MAX_BALANCE_SHEET_RON;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, data, year } = await req.json();
    console.log(`Import ANAF action: ${action}, year: ${year}`);

    if (action === "batch-insert") {
      // Procesare batch de date financiare
      if (!Array.isArray(data) || data.length === 0) {
        return new Response(
          JSON.stringify({ error: "Date invalide" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const records = data.map((item: FinancialData) => {
        const activeImobilizate = parseNumber(item.i1);
        const activeCirculante = parseNumber(item.i2);
        const totalBilant = (activeImobilizate || 0) + (activeCirculante || 0);

        return {
          cui: item.CUI,
          caen: item.CAEN || null,
          cifra_afaceri_neta: parseNumber(item.i13),
          numar_mediu_salariati: parseNumber(item.i20),
          active_imobilizate: activeImobilizate,
          active_circulante: activeCirculante,
          total_bilant: totalBilant,
          capitaluri_total: parseNumber(item.i10),
          profit_net: parseNumber(item.i18),
          pierdere_neta: parseNumber(item.i19),
          an_raportare: year || 2024,
          is_sme: isSME(item),
        };
      });

      // Upsert pentru a actualiza înregistrările existente
      const { data: insertedData, error } = await supabase
        .from("company_financials")
        .upsert(records, { 
          onConflict: "cui",
          ignoreDuplicates: false 
        })
        .select("cui");

      if (error) {
        console.error("Insert error:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Inserted/updated ${insertedData?.length || 0} records`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          count: insertedData?.length || 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-stats") {
      // Statistici despre datele importate
      const { data: stats, error } = await supabase
        .from("company_financials")
        .select("is_sme, an_raportare")
        .limit(100000);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const totalCompanies = stats?.length || 0;
      const smeCount = stats?.filter(s => s.is_sme).length || 0;
      const years = [...new Set(stats?.map(s => s.an_raportare))];

      return new Response(
        JSON.stringify({ 
          totalCompanies,
          smeCount,
          nonSmeCount: totalCompanies - smeCount,
          years
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check-cui") {
      // Verifică dacă un CUI aparține unei IMM
      const { cui } = await req.json();
      
      const { data: company, error } = await supabase
        .from("company_financials")
        .select("*")
        .eq("cui", cui)
        .single();

      if (error && error.code !== 'PGRST116') {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          found: !!company,
          is_sme: company?.is_sme || false,
          company
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Acțiune necunoscută" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Eroare necunoscută" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
