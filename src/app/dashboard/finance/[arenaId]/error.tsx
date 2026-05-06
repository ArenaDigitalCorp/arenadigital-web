"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function FinanceError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("[finance]", error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-arena-navy-800">Erro ao carregar dados financeiros</h2>
        <p className="text-sm text-muted-foreground">{error.message || "Tente novamente em instantes."}</p>
      </div>
      <Button onClick={reset} className="bg-arena-button hover:bg-arena-button-hover text-white">Tentar novamente</Button>
    </div>
  );
}
