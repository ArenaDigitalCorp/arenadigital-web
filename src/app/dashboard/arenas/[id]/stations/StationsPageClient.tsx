'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Eye, MoreVertical, Edit, Filter, Store } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  GradientMediaCard,
  GRADIENT_MEDIA_CARD_STATION_PRESET,
} from '@/components/dashboard/GradientMediaCard';
import { StationForm } from '@/modules/stations/components/StationForm';
import { normalizeString } from '@/lib/utils';

const stationFilterSelectClass =
  'h-10 w-full min-w-[160px] border-slate-300 text-sm text-arena-navy-800 shadow-none focus-visible:ring-1 focus-visible:ring-[#20B2AA] data-[placeholder]:text-arena-navy-800/60 sm:w-fit';

type StationTypeFilter = 'all' | 'bar' | 'loja' | 'outro';
type StationStatusFilter = 'all' | 'ativo' | 'inativo' | 'manutencao' | 'desativado';
type StationSortOrder = 'recent' | 'oldest';

interface StationListItem {
  id: string;
  name: string;
  status?: string | null;
  station_type_id?: string | null;
  image_url?: string | null;
  station_type?: { name?: string } | null;
  metrics?: {
    pending?: number;
    closedToday?: number;
    openedToday?: number;
  };
  created_at?: string;
}

interface Props {
  arenaId: string;
  initialStations: StationListItem[];
}

/** URL da foto da estação, se existir (evita placeholders quebrados em /public). */
function stationImageUrl(station: StationListItem) {
  const u = station.image_url?.trim();
  return u || undefined;
}

/** Normaliza status vindo do banco (ex.: legados sem valor). */
function isStationActive(status: string | null | undefined) {
  return !status || status === 'ativo';
}

function stationStatusBadge(status: string | null | undefined) {
  const s = status ?? 'ativo';
  if (s === 'ativo') return undefined;
  if (s === 'inativo') {
    return (
      <Badge variant="warning" className="pointer-events-none">
        Inativo
      </Badge>
    );
  }
  if (s === 'Em manutenção') {
    return (
      <Badge variant="outline" className="pointer-events-none border-white/80 bg-white/90 text-arena-navy-800">
        Em manutenção
      </Badge>
    );
  }
  if (s === 'Desativado') {
    return (
      <Badge variant="destructive" className="pointer-events-none">
        Desativado
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="pointer-events-none bg-white/90 text-arena-navy-800">
      {s}
    </Badge>
  );
}

export function StationsPageClient({ arenaId, initialStations }: Props) {
  const router = useRouter();
  const [stations, setStations] = useState<StationListItem[]>(initialStations);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<StationListItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<StationTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StationStatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<StationSortOrder>('recent');

  useEffect(() => {
    setStations(initialStations);
  }, [initialStations]);

  const filteredStations = useMemo(() => {
    let list = [...stations];

    if (typeFilter !== 'all') {
      list = list.filter((s) => {
        const n = normalizeString(s.station_type?.name ?? '');
        if (typeFilter === 'bar') return n.includes('bar');
        if (typeFilter === 'loja') return n.includes('loja');
        return !n.includes('bar') && !n.includes('loja');
      });
    }

    if (statusFilter !== 'all') {
      list = list.filter((s) => {
        const st = s.status ?? 'ativo';
        if (statusFilter === 'ativo') return isStationActive(s.status);
        if (statusFilter === 'inativo') return st === 'inativo';
        if (statusFilter === 'manutencao') return st === 'Em manutenção';
        if (statusFilter === 'desativado') return st === 'Desativado';
        return true;
      });
    }

    list.sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return sortOrder === 'recent' ? tb - ta : ta - tb;
    });

    return list;
  }, [stations, typeFilter, statusFilter, sortOrder]);

  const closeEdit = () => {
    setEditOpen(false);
    setEditingStation(null);
  };

  const editInitialData =
    editingStation &&
    ({
      id: editingStation.id,
      name: editingStation.name,
      status: editingStation.status ?? 'ativo',
      station_type_id: editingStation.station_type_id ?? '',
    } as const);

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black tracking-tight text-arena-navy-800">
              Estações
            </h1>
            <p className="text-sm font-medium text-arena-navy-800/60">
              Gerencie suas estações, caixas, comandas e itens.
            </p>
          </div>
          <Button
            type="button"
            className="bg-arena-button font-semibold text-white shadow-sm hover:bg-arena-button-hover"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar Estação
          </Button>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova estação</DialogTitle>
            </DialogHeader>
            <StationForm
              key={createOpen ? 'station-create-open' : 'station-create-closed'}
              arenaId={arenaId}
              onSuccess={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            if (!open) closeEdit();
            else setEditOpen(true);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar estação</DialogTitle>
            </DialogHeader>
            {editInitialData && editingStation ? (
              <StationForm
                key={editingStation.id}
                arenaId={arenaId}
                initialData={editInitialData}
                onSuccess={closeEdit}
              />
            ) : null}
          </DialogContent>
        </Dialog>

        {stations.length > 0 ? (
          <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 text-arena-navy-800/50">
              <Filter className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide">Filtros</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as StationTypeFilter)}
              >
                <SelectTrigger className={stationFilterSelectClass}>
                  <SelectValue placeholder="Tipo de estação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="loja">Loja</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortOrder}
                onValueChange={(v) => setSortOrder(v as StationSortOrder)}
              >
                <SelectTrigger className={stationFilterSelectClass}>
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StationStatusFilter)}
              >
                <SelectTrigger className={stationFilterSelectClass}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="manutencao">Em manutenção</SelectItem>
                  <SelectItem value="desativado">Desativado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        {stations.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-white/50 py-20">
            <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
              <Plus className="h-8 w-8 text-arena-navy-800/20" />
            </div>
            <p className="text-lg font-medium text-arena-navy-800/40">
              Nenhuma estação cadastrada aqui.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 border-arena-navy-800/10 text-arena-navy-800/60"
              onClick={() => setCreateOpen(true)}
            >
              Cadastrar Primeira Estação
            </Button>
          </Card>
        ) : filteredStations.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border border-slate-100 bg-white py-16 shadow-sm">
            <p className="text-center text-sm font-medium text-arena-navy-800/50">
              Nenhuma estação encontrada com os filtros selecionados.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-3 text-arena-button"
              onClick={() => {
                setTypeFilter('all');
                setStatusFilter('all');
                setSortOrder('recent');
              }}
            >
              Limpar filtros
            </Button>
          </Card>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
            <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-6 pb-1">
              {filteredStations.map((station) => (
                <GradientMediaCard
                  key={station.id}
                  {...GRADIENT_MEDIA_CARD_STATION_PRESET}
                  fluid
                  contentLayout="bottom"
                  imageSrc={stationImageUrl(station)}
                  imageAlt={station.name}
                  imageFallback={
                    <Store
                      className="size-11"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                  }
                  inactive={!isStationActive(station.status)}
                  ariaLabel={`Abrir estação ${station.name}`}
                  onClick={() =>
                    router.push(`/dashboard/arenas/${arenaId}/stations/${station.id}`)
                  }
                  badge={stationStatusBadge(station.status)}
                  actions={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="pointer-events-auto cursor-pointer p-0 text-white"
                          aria-label="Menu da estação"
                        >
                          <MoreVertical className="size-6" strokeWidth={2} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="flex cursor-pointer items-center"
                          onClick={() => {
                            setEditingStation(station);
                            setEditOpen(true);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" /> Editar
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
