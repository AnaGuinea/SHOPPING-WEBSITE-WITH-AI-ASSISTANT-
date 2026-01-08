import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImportStats {
  totalRecords: number;
  smeCount: number;
  nonSmeCount: number;
  processed: number;
  errors: number;
}

export default function AdminImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [year, setYear] = useState<number>(2024);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [progress, setProgress] = useState(0);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStats(null);
      setProgress(0);
    }
  };

  const processFile = async () => {
    if (!selectedFile) {
      toast({
        title: "Eroare",
        description: "Selectează un fișier TXT pentru import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setStats(null);
    setProgress(0);

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Prima linie este header
      const headers = parseCSVLine(lines[0]);
      console.log("Headers:", headers);
      
      // Găsește indexurile coloanelor
      const cuiIndex = headers.findIndex(h => h.toUpperCase() === 'CUI');
      const caenIndex = headers.findIndex(h => h.toUpperCase() === 'CAEN');
      
      if (cuiIndex === -1) {
        throw new Error("Coloana CUI nu a fost găsită în fișier");
      }

      const totalRecords = lines.length - 1;
      const batchSize = 100;
      let processed = 0;
      let errors = 0;
      let smeCount = 0;
      let nonSmeCount = 0;

      for (let i = 1; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, Math.min(i + batchSize, lines.length));
        
        const records = batch.map(line => {
          const values = parseCSVLine(line);
          return {
            CUI: values[cuiIndex] || '',
            CAEN: caenIndex !== -1 ? values[caenIndex] : '',
            i1: values[2] || '0', // Active imobilizate
            i2: values[3] || '0', // Active circulante
            i10: values[9] || '0', // Capitaluri total
            i13: values[12] || '0', // Cifra de afaceri
            i18: values[17] || '0', // Profit net
            i19: values[18] || '0', // Pierdere neta
            i20: values[19] || '0', // Nr angajati
          };
        }).filter(r => r.CUI && r.CUI !== 'CUI');

        try {
          const { data, error } = await supabase.functions.invoke('import-anaf-data', {
            body: { 
              action: 'batch-insert', 
              data: records, 
              year 
            }
          });

          if (error) {
            console.error("Batch error:", error);
            errors += records.length;
          } else {
            processed += data?.count || records.length;
          }
        } catch (err) {
          console.error("Request error:", err);
          errors += batch.length;
        }

        setProgress(Math.round((i / totalRecords) * 100));
      }

      // Get final stats
      const { data: statsData } = await supabase.functions.invoke('import-anaf-data', {
        body: { action: 'get-stats' }
      });

      setStats({
        totalRecords,
        smeCount: statsData?.smeCount || 0,
        nonSmeCount: statsData?.nonSmeCount || 0,
        processed,
        errors,
      });

      toast({
        title: "Import finalizat",
        description: `${processed} înregistrări procesate, ${errors} erori`,
      });

    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Eroare la import",
        description: error instanceof Error ? error.message : "Eroare necunoscută",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setProgress(100);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Import Date ANAF</h1>
          <p className="text-muted-foreground mt-2">
            Importă situațiile financiare de pe data.gov.ro pentru a identifica firmele IMM
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Încarcă Fișier
            </CardTitle>
            <CardDescription>
              Selectează fișierul TXT cu situații financiare (ex: WEB_BL_BS_SL_AN2024.txt)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="year">An raportare</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || 2024)}
                min={2014}
                max={2025}
              />
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="space-y-2">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Click pentru a selecta un fișier
                  </p>
                </div>
              )}
              
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                Selectează fișier
              </Button>
            </div>

            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Se procesează... {progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={processFile}
              disabled={!selectedFile || isImporting}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se procesează...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Începe importul
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Rezultate Import
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{stats.totalRecords.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total înregistrări</p>
                </div>
                <div className="bg-green-500/10 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.smeCount.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Firme IMM</p>
                </div>
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{stats.nonSmeCount.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Non-IMM</p>
                </div>
                <div className={`rounded-lg p-4 text-center ${stats.errors > 0 ? 'bg-red-500/10' : 'bg-muted'}`}>
                  <p className={`text-2xl font-bold ${stats.errors > 0 ? 'text-red-600' : ''}`}>
                    {stats.errors.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Erori</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Instrucțiuni
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                Descarcă fișierul <strong>WEB_BL_BS_SL_AN2024.txt</strong> de pe{" "}
                <a 
                  href="https://data.gov.ro/dataset/situatii_financiare_2024" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  data.gov.ro
                </a>
              </li>
              <li>Selectează anul de raportare corespunzător</li>
              <li>Încarcă fișierul și așteaptă procesarea</li>
              <li>
                Criteriile IMM folosite:
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>&lt;250 angajați</li>
                  <li>≤50 milioane EUR cifră de afaceri</li>
                  <li>≤43 milioane EUR total bilanț</li>
                </ul>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
