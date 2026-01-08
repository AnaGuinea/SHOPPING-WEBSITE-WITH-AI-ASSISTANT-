-- Funcție pentru actualizarea automată a timestamp-urilor
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabel pentru stocarea datelor financiare ale firmelor (criteriile IMM)
-- Date extrase din situațiile financiare ANAF de pe data.gov.ro
CREATE TABLE public.company_financials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cui TEXT NOT NULL UNIQUE,
  denumire TEXT,
  caen TEXT,
  cifra_afaceri_neta NUMERIC, -- in RON
  numar_mediu_salariati INTEGER,
  active_imobilizate NUMERIC,
  active_circulante NUMERIC,
  total_bilant NUMERIC, -- active_imobilizate + active_circulante
  capitaluri_total NUMERIC,
  profit_net NUMERIC,
  pierdere_neta NUMERIC,
  an_raportare INTEGER NOT NULL,
  is_sme BOOLEAN DEFAULT false, -- True dacă îndeplinește criteriile IMM
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pentru căutări rapide după CUI
CREATE INDEX idx_company_financials_cui ON public.company_financials(cui);

-- Index pentru filtrare IMM-uri
CREATE INDEX idx_company_financials_sme ON public.company_financials(is_sme) WHERE is_sme = true;

-- Index pentru anul de raportare
CREATE INDEX idx_company_financials_year ON public.company_financials(an_raportare);

-- Index pentru căutare după denumire
CREATE INDEX idx_company_financials_denumire ON public.company_financials USING gin(to_tsvector('romanian', denumire));

-- Enable RLS (public read access pentru date ANAF publice)
ALTER TABLE public.company_financials ENABLE ROW LEVEL SECURITY;

-- Politică pentru citire publică (datele sunt deja publice pe data.gov.ro)
CREATE POLICY "Datele financiare sunt publice" 
ON public.company_financials 
FOR SELECT 
USING (true);

-- Trigger pentru actualizarea timestamp-ului
CREATE TRIGGER update_company_financials_updated_at
BEFORE UPDATE ON public.company_financials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentariu pe tabel
COMMENT ON TABLE public.company_financials IS 'Date financiare extrase din situațiile financiare ANAF (data.gov.ro). Criteriile IMM: <250 angajați, ≤50M EUR cifră afaceri, ≤43M EUR total bilanț.';