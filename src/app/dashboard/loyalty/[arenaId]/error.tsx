"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function LoyaltyError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("[loyalty]", error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-[#002B40]">Erro ao carregar fidelidade</h2>
        <p className="text-sm text-muted-foreground">{error.message || "Tente novamente em instantes."}</p>
      </div>
      <Button onClick={reset} className="bg-[#FF6B00] hover:bg-[#E66000] text-white">Tentar novamente</Button>
    </div>
  );
}
