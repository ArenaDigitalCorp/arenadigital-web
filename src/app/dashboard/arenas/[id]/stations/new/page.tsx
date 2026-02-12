import { StationForm } from "@/modules/stations/components/StationForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface NewStationPageProps {
    params: Promise<{
        id: string; // Arena ID
    }>;
}

export default async function NewStationPage({ params }: NewStationPageProps) {
    const { id } = await params;

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4">
                <Link href={`/dashboard/arenas/${id}/stations`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Nova Estação</h2>
                    <p className="text-muted-foreground">
                        Preencha os dados abaixo para cadastrar uma nova estação.
                    </p>
                </div>
            </div>

            <div className="border rounded-lg p-6 bg-white">
                <StationForm arenaId={id} />
            </div>
        </div>
    );
}
