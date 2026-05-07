'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  PlusCircle,
  Eye,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  CalendarDays,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GradientMediaCard } from '@/components/dashboard/GradientMediaCard';
import { DayOperationModal } from '@/modules/bookings/components/DayOperationModal';
import { AvailableTimesModal } from '@/modules/bookings/components/AvailableTimesModal';
import { deleteCourtAction } from '@/modules/courts/actions/courtActions';
import type { Booking } from '@/modules/bookings/types/booking.types';

interface Props {
  arenaId: string;
  arenaName: string;
  initialCourts: any[];
  initialBookings: Booking[];
}

function getCurrentDayName() {
  const days = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  return days[new Date().getDay()];
}

export function ArenaDetailPageClient({
  arenaId,
  arenaName,
  initialCourts,
  initialBookings,
}: Props) {
  const [courts, setCourts] = useState<any[]>(initialCourts);
  const [bookings] = useState<Booking[]>(initialBookings);
  const [selectedSpace, setSelectedSpace] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'espacos' | 'cadastro'>('espacos');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDayOperationOpen, setIsDayOperationOpen] = useState(false);
  const [isAvailableTimesOpen, setIsAvailableTimesOpen] = useState(false);

  const handleDeleteCourt = async (courtId: string) => {
    if (!confirm('Deseja realmente excluir esta quadra?')) return;
    const res = await deleteCourtAction(arenaId, courtId);
    if (res.success) {
      setCourts((prev) => prev.filter((c) => c.id !== courtId));
      toast.success('Quadra excluída!');
    } else {
      toast.error(res.error ?? 'Erro ao excluir quadra.');
    }
  };

  const getCourtStatus = (court: any) => {
    const dayName = getCurrentDayName();
    if (
      !court.day_config ||
      !Array.isArray(court.day_config) ||
      court.day_config.length === 0
    ) {
      const isAvailable = court.available_days?.includes(dayName);
      if (!isAvailable) return { status: 'closed', message: 'Fechado hoje' };
      const totalSlots = 15;
      const courtBookings = bookings.filter(
        (b) =>
          b.court_id === court.id &&
          (b.status === 'confirmed' || b.status === 'reservado')
      ).length;
      return { status: 'open', booked: courtBookings, total: totalSlots };
    }

    const todayConfig = court.day_config.find((d: any) => d.day === dayName);
    if (!todayConfig || !todayConfig.enabled)
      return { status: 'closed', message: 'Fechado hoje' };

    const startHour = parseInt(todayConfig.startTime.split(':')[0]);
    const endHour = parseInt(todayConfig.endTime.split(':')[0]);
    let totalSlots = endHour - startHour;
    if (totalSlots < 0) totalSlots += 24;

    const courtBookings = bookings.filter(
      (b) =>
        b.court_id === court.id &&
        (b.status === 'confirmed' || b.status === 'reservado')
    ).length;
    return { status: 'open', booked: courtBookings, total: totalSlots };
  };

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">
            Espaços
          </h1>
          <p className="text-arena-navy-800/60 font-medium">
            Gerencie quadras, reservas e disponibilidades.
          </p>
        </div>

        <div className="flex items-center border-b border-arena-navy-800/10 gap-8">
          <button
            onClick={() => setActiveTab('espacos')}
            className={cn(
              'pb-4 font-bold text-sm transition-all relative',
              activeTab === 'espacos' ? 'text-arena-navy-800' : 'text-arena-navy-800/40'
            )}
          >
            Visão geral
            {activeTab === 'espacos' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#20B2AA]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('cadastro')}
            className={cn(
              'pb-4 font-bold text-sm transition-all relative',
              activeTab === 'cadastro' ? 'text-arena-navy-800' : 'text-arena-navy-800/40'
            )}
          >
            Cadastro
            {activeTab === 'cadastro' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#20B2AA]" />
            )}
          </button>
        </div>

        {activeTab === 'espacos' && (
          <div className="space-y-6">
            {courts.length > 0 && (
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setIsAvailableTimesOpen(true)}
                  className="bg-arena-navy-800/10 hover:bg-arena-navy-800/20 text-arena-navy-800 font-bold gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Horários disponíveis
                </Button>
                <Button
                  onClick={() => setIsDayOperationOpen(true)}
                  className="bg-arena-navy-800 hover:bg-[#001D2C] text-white font-bold gap-2"
                >
                  <CalendarDays className="w-4 h-4" />
                  Ver operação do dia
                </Button>
              </div>
            )}
            {courts.length === 0 ? (
              <Card className="bg-white/50 border-dashed border-2 py-20 flex flex-col items-center justify-center">
                <PlusCircle className="h-12 w-12 text-arena-navy-800/20 mb-4" />
                <p className="text-arena-navy-800/40 font-medium text-lg">
                  Nenhum espaço cadastrado aqui.
                </p>
              </Card>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
                <div className="grid grid-cols-[repeat(auto-fill,376px)] justify-center gap-6 pb-1">
                {courts.map((court) => {
                  const statusInfo = getCourtStatus(court);
                  return (
                    <GradientMediaCard
                      key={court.id}
                      inactive={court.status === 'inativo'}
                      imageSrc={court.image_url || '/placeholder-court.jpg'}
                      imageAlt={court.name}
                      ariaLabel={`Abrir detalhes do espaço ${court.name}`}
                      onClick={() => setSelectedSpace(court)}
                      actions={
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="pointer-events-auto p-0 text-white hover:bg-white/15"
                              aria-label="Menu do espaço"
                            >
                              <MoreVertical className="size-6" strokeWidth={2} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/arenas/${arenaId}/spaces/${court.id}/edit`}
                                className="flex w-full cursor-pointer items-center"
                              >
                                <Edit className="mr-2 h-4 w-4" /> Editar
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/arenas/${arenaId}/courts/${court.id}/calendar`}
                                className="flex w-full cursor-pointer items-center"
                              >
                                <Eye className="mr-2 h-4 w-4" /> Ver calendário
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteCourt(court.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      }
                      badge={
                        court.status === 'inativo' ? (
                          <Badge variant="warning">Inativo</Badge>
                        ) : undefined
                      }
                    >
                      <h4 className="text-[14px] font-semibold leading-tight text-white">
                        {court.name}
                      </h4>
                      {statusInfo.status === 'open' ? (
                        <>
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-1 gap-y-0 leading-none">
                            <span className="text-[24px] font-extrabold tracking-tight text-white">
                              {statusInfo.booked}
                            </span>
                            <span className="text-[12px] font-semibold text-white/90">
                              / {statusInfo.total} reservas
                            </span>
                          </div>
                          <p className="mt-0.5 text-[12px] font-semibold text-white/95">
                            hoje
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 line-clamp-2 text-[24px] font-extrabold leading-tight text-white">
                          {statusInfo.message}
                        </p>
                      )}
                    </GradientMediaCard>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cadastro' && (
          <div className="space-y-8">
            <Card className="p-8 border-none shadow-lg rounded-xl bg-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-arena-navy-800">
                    Espaços Cadastrados
                  </h3>
                  <p className="text-arena-navy-800/60">
                    Gerencie quadras, reservas e disponibilidades.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/40" />
                    <Input
                      placeholder="Buscar espaço..."
                      className="pl-9 w-[240px] border-arena-navy-800/10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    className="bg-arena-button hover:bg-arena-button-hover text-white font-bold"
                    asChild
                  >
                    <Link href={`/dashboard/arenas/${arenaId}/spaces/new`}>
                      Cadastrar Espaço +
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-arena-navy-800/5">
                      <th className="py-4 font-bold text-xs uppercase tracking-wider text-arena-navy-800/40">
                        Nome
                      </th>
                      <th className="py-4 font-bold text-xs uppercase tracking-wider text-arena-navy-800/40">
                        Tipo
                      </th>
                      <th className="py-4 font-bold text-xs uppercase tracking-wider text-arena-navy-800/40">
                        Status
                      </th>
                      <th className="py-4 font-bold text-xs uppercase tracking-wider text-arena-navy-800/40">
                        Coberta/Descoberta
                      </th>
                      <th className="py-4 font-bold text-xs uppercase tracking-wider text-arena-navy-800/40 text-right">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {courts
                      .filter(
                        (c) =>
                          c.name
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                          c.type
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())
                      )
                      .map((court) => (
                        <tr
                          key={court.id}
                          className="border-b border-arena-navy-800/5 hover:bg-arena-soft transition-colors"
                        >
                          <td className="py-4 font-bold text-arena-navy-800">
                            {court.name}
                          </td>
                          <td className="py-4 text-arena-navy-800/60 text-sm font-medium">
                            {court.sports?.map((s: any) => s.name).join(', ') ||
                              court.type}
                          </td>
                          <td className="py-4">
                            <Badge
                              className={cn(
                                'font-bold text-[10px] uppercase h-5',
                                court.status === 'ativo'
                                  ? 'bg-[#FFC145]/20 text-arena-navy-800 hover:bg-[#FFC145]/30 border-none'
                                  : court.status === 'Em manutenção'
                                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-100 border-none'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-100 border-none'
                              )}
                            >
                              {court.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-arena-navy-800/60 text-sm font-medium">
                            {court.is_covered ? 'Coberto' : 'Descoberto'}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                className="h-8 w-8 text-arena-navy-800/60 bg-[#F1F5F9] hover:bg-[#E2E8F0]"
                              >
                                <Link
                                  href={`/dashboard/arenas/${arenaId}/spaces/${court.id}/edit`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCourt(court.id)}
                                className="h-8 w-8 text-arena-button/60 bg-arena-button/10 hover:bg-arena-button/20 hover:text-arena-button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedSpace(court)}
                                    className="h-8 w-8 text-teal-600/60 bg-teal-50 hover:bg-teal-100 hover:text-teal-600"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ver Calendário</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {courts.length === 0 && (
                  <div className="text-center py-20 text-arena-navy-800/40">
                    Nenhum espaço cadastrado.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        <Dialog
          open={!!selectedSpace}
          onOpenChange={(open) => {
            if (!open) setSelectedSpace(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-arena-navy-800">
                {selectedSpace?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedSpace && (
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-arena-navy-800/40 tracking-wider">
                      Status
                    </label>
                    <p className="font-bold text-arena-navy-800">
                      {selectedSpace.status}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-arena-navy-800/40 tracking-wider">
                      Tipo do espaço
                    </label>
                    <p className="font-bold text-arena-navy-800">
                      {selectedSpace.type}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-arena-navy-800/40 tracking-wider">
                      Esporte
                    </label>
                    <p className="font-bold text-arena-navy-800">
                      {selectedSpace.sports?.map((s: any) => s.name).join(', ')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-arena-navy-800/40 tracking-wider">
                      Coberta/Descoberta
                    </label>
                    <p className="font-bold text-arena-navy-800">
                      {selectedSpace.is_covered ? 'Coberta' : 'Descoberta'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-arena-navy-800/40 tracking-wider">
                      Valor da reserva
                    </label>
                    <p className="font-bold text-arena-navy-800">
                      R$ {selectedSpace.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-arena-navy-800/40 tracking-wider">
                      Tipo de reserva
                    </label>
                    <p className="font-bold text-arena-navy-800">
                      {selectedSpace.booking_type === 'hourly'
                        ? 'Por hora'
                        : 'Único'}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-arena-navy-800/40 tracking-wider">
                    Dias disponíveis
                  </label>
                  <p className="text-sm font-medium text-arena-navy-800/80">
                    {selectedSpace.available_days?.join(', ')}
                  </p>
                </div>
                {selectedSpace.observations && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-arena-navy-800/40 tracking-wider">
                      Observações
                    </label>
                    <p className="text-sm font-medium text-arena-navy-800/80">
                      {selectedSpace.observations}
                    </p>
                  </div>
                )}
                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedSpace(null)}
                  >
                    Fechar
                  </Button>
                  <Button
                    className="flex-1 bg-arena-button hover:bg-arena-button-hover"
                    asChild
                  >
                    <Link
                      href={`/dashboard/arenas/${arenaId}/spaces/${selectedSpace.id}/edit`}
                    >
                      Editar
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <DayOperationModal
          isOpen={isDayOperationOpen}
          onClose={() => setIsDayOperationOpen(false)}
          arenaId={arenaId}
          arenaName={arenaName}
          courts={courts}
        />

        <AvailableTimesModal
          isOpen={isAvailableTimesOpen}
          onClose={() => setIsAvailableTimesOpen(false)}
          arenaId={arenaId}
          currentDate={new Date()}
        />
      </div>
    </TooltipProvider>
  );
}
