import { StationForm } from "@/modules/stations/components/StationForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getStationByIdAction } from "@/modules/stations/actions/stationActions";
import { redirect } from "next/navigation";
import { assertArenaAccess } from "@/lib/server-auth";

interface EditStationPageProps {
    params: Promise<{
        id: string; // Arena ID
        stationId: string;
    }>;
}

export default async function EditStationPage({ params }: EditStationPageProps) {
    const { id, stationId } = await params;

    try { await assertArenaAccess(id) } catch { redirect(`/dashboard/arenas/${id}/stations`) }

    const res = await getStationByIdAction(id, stationId);
    const station = res.data;
    if (!station) redirect(`/dashboard/arenas/${id}/stations`);

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4">
                <Link href={`/dashboard/arenas/${id}/stations`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Editar Estação</h2>
                    <p className="text-muted-foreground">
                        Atualize os dados da estação.
                    </p>
                </div>
            </div>

            <div className="border rounded-lg p-6 bg-white">
                <StationForm initialData={station} arenaId={id} />
            </div>
        </div>
    );
}
