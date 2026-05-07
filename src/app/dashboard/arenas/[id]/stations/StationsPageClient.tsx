'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Eye, MoreVertical, Edit } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  GradientMediaCard,
  GRADIENT_MEDIA_CARD_STATION_PRESET,
} from '@/components/dashboard/GradientMediaCard';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';

interface StationListItem {
  id: string;
  name: string;
  image_url?: string | null;
  station_type?: { name?: string } | null;
  metrics?: {
    pending?: number;
    closedToday?: number;
    openedToday?: number;
  };
}

interface Props {
  arenaId: string;
  initialStations: StationListItem[];
}

function stationImage(station: StationListItem) {
  return (
    station.image_url ||
    (station.station_type?.name === 'Bar'
      ? '/bg_img_bar.png'
      : station.station_type?.name === 'Loja'
        ? '/bg_img_lojaesporte.png'
        : '/placeholder-station.jpg')
  );
}

export function StationsPageClient({ arenaId, initialStations }: Props) {
  const router = useRouter();
  const [stations] = useState<StationListItem[]>(initialStations);

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">
              Estações
            </h1>
            <p className="text-arena-navy-800/60 font-medium text-sm">
              Gerencie suas estações, caixas, comandas e itens.
            </p>
          </div>
            <Link href={`/dashboard/arenas/${arenaId}/stations/new`}>
            <Button className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Estação
            </Button>
          </Link>
        </div>

        <DashboardTabs
          value="stations"
          tabs={[{ label: 'Estações', value: 'stations' }]}
        />

        {stations.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-white/50 py-20">
            <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
              <Plus className="h-8 w-8 text-arena-navy-800/20" />
            </div>
            <p className="text-lg font-medium text-arena-navy-800/40">
              Nenhuma estação cadastrada aqui.
            </p>
            <Link href={`/dashboard/arenas/${arenaId}/stations/new`} className="mt-4">
              <Button
                variant="outline"
                className="border-arena-navy-800/10 text-arena-navy-800/60"
              >
                Cadastrar Primeira Estação
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
            <div className="grid grid-cols-[repeat(auto-fill,376px)] justify-center gap-6 pb-1">
              {stations.map((station) => (
                <GradientMediaCard
                  key={station.id}
                  {...GRADIENT_MEDIA_CARD_STATION_PRESET}
                  contentLayout="bottom"
                  imageSrc={stationImage(station)}
                  imageAlt={station.name}
                  ariaLabel={`Abrir estação ${station.name}`}
                  onClick={() =>
                    router.push(
                      `/dashboard/arenas/${arenaId}/stations/${station.id}`
                    )
                  }
                  actions={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="pointer-events-auto p-0 text-white hover:bg-white/15"
                          aria-label="Menu da estação"
                        >
                          <MoreVertical className="size-6" strokeWidth={2} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/arenas/${arenaId}/stations/${station.id}/edit`}
                            className="flex w-full cursor-pointer items-center"
                          >
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/arenas/${arenaId}/stations/${station.id}`}
                            className="flex w-full cursor-pointer items-center"
                          >
                            <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                >
                  <h4 className="text-[14px] font-semibold leading-tight text-white">
                    {station.name}
                  </h4>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span className="text-[15px] font-medium leading-snug text-white">
                      Comandas pendentes:
                    </span>
                    <span className="text-[24px] font-extrabold leading-none tracking-tight text-white">
                      {station.metrics?.pending ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[15px] font-medium leading-snug text-white">
                      Total fechadas: {station.metrics?.closedToday ?? 0}
                    </p>
                    <p className="text-[15px] font-medium leading-snug text-white">
                      Total abertas: {station.metrics?.openedToday ?? 0}
                    </p>
                  </div>
                  <p className="text-[12px] font-semibold text-white">hoje</p>
                </GradientMediaCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
