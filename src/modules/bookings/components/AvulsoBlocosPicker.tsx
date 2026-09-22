'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DIAS_SEMANA_CURTO,
  DIAS_SEMANA_LONGO,
  avaliarSlotAvulso,
  formatHora,
  podeSelecionarAvulso,
  slotKeyAvulso,
  toDateKey,
  type BookingLike,
  type CourtLike,
  type ResumoBlocoAvulso,
} from '@/modules/bookings/lib/avulso-blocos';

interface AvulsoBlocosPickerProps {
  courts: CourtLike[];
  bookings: BookingLike[];
  isLoading: boolean;
  selected: Set<string>;
  onToggleSlot: (key: string) => void;
  onRemoveBloco: (blocoKey: string) => void;
  weekStart: Date;
  onNavigateWeek: (direction: 1 | -1) => void;
  activeCourtId: string;
  onActiveCourtChange: (courtId: string) => void;
  blocos: ResumoBlocoAvulso[];
  onBlocoValorChange: (blocoKey: string, valor: number) => void;
  isQuoting: boolean;
  disabled?: boolean;
}

/** Janela de horas exibida: a união do funcionamento de todas as quadras. */
function faixaDeHoras(courts: CourtLike[]): number[] {
  let min = 23;
  let max = 6;
  for (const court of courts) {
    for (const dia of court.day_config ?? []) {
      if (!dia.enabled) continue;
      const inicio = Number.parseInt(dia.startTime.split(':')[0], 10);
      const fim = Number.parseInt(dia.endTime.split(':')[0], 10);
      if (!Number.isNaN(inicio)) min = Math.min(min, inicio);
      if (!Number.isNaN(fim)) max = Math.max(max, fim > inicio ? fim : 23);
    }
  }
  if (min > max) return Array.from({ length: 17 }, (_, i) => i + 6);
  return Array.from({ length: Math.max(1, max - min) }, (_, i) => i + min);
}

function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function AvulsoBlocosPicker({
  courts,
  bookings,
  isLoading,
  selected,
  onToggleSlot,
  onRemoveBloco,
  weekStart,
  onNavigateWeek,
  activeCourtId,
  onActiveCourtChange,
  blocos,
  onBlocoValorChange,
  isQuoting,
  disabled = false,
}: AvulsoBlocosPickerProps) {
  const [foco, setFoco] = useState<{ dia: number; hora: number } | null>(null);

  const horas = useMemo(() => faixaDeHoras(courts), [courts]);
  const agora = useMemo(() => new Date(), []);
  const dias = useMemo(() => weekDates(weekStart), [weekStart]);

  const bookingsPorCourt = useMemo(() => {
    const mapa = new Map<string, BookingLike[]>();
    for (const booking of bookings) {
      const lista = mapa.get(booking.court_id);
      if (lista) lista.push(booking);
      else mapa.set(booking.court_id, [booking]);
    }
    return mapa;
  }, [bookings]);

  const activeCourt = courts.find((court) => court.id === activeCourtId) ?? courts[0];

  const grade = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof avaliarSlotAvulso>>();
    if (!activeCourt) return mapa;
    for (let dia = 0; dia < 7; dia++) {
      for (const hora of horas) {
        mapa.set(
          `${dia}|${hora}`,
          avaliarSlotAvulso({
            court: activeCourt,
            date: dias[dia],
            hora,
            bookingsPorCourt,
            agora,
          })
        );
      }
    }
    return mapa;
  }, [activeCourt, horas, dias, bookingsPorCourt, agora]);

  /** Horas livres por quadra nesta semana — orienta onde ainda há espaço. */
  const livresPorCourt = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const court of courts) {
      let livres = 0;
      for (let dia = 0; dia < 7; dia++) {
        for (const hora of horas) {
          const info = avaliarSlotAvulso({
            court,
            date: dias[dia],
            hora,
            bookingsPorCourt,
            agora,
          });
          if (info.status === 'free') livres++;
        }
      }
      mapa.set(court.id, livres);
    }
    return mapa;
  }, [courts, horas, dias, bookingsPorCourt, agora]);

  const alternativas = useMemo(() => {
    if (!foco) return [];
    return courts.filter((court) => {
      if (court.id === activeCourtId) return false;
      const info = avaliarSlotAvulso({
        court,
        date: dias[foco.dia],
        hora: foco.hora,
        bookingsPorCourt,
        agora,
      });
      return info.status === 'free';
    });
  }, [foco, courts, activeCourtId, dias, bookingsPorCourt, agora]);

  const rangeLabel = `${dias[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${dias[6].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-arena-navy-800/10 bg-slate-50">
        <Loader2 className="h-5 w-5 animate-spin text-arena-button" />
        <span className="ml-2 text-sm font-semibold text-arena-navy-800/50">
          Carregando disponibilidade da semana…
        </span>
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-arena-navy-800/15 p-6 text-center text-sm font-semibold text-arena-navy-800/50">
        Nenhum espaço ativo nesta arena.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navegação de semana */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onNavigateWeek(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-arena-navy-800/10 text-arena-navy-800/60 transition-colors hover:bg-slate-50"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[110px] text-center text-xs font-black uppercase tracking-wider text-arena-navy-800/60">
          {rangeLabel}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onNavigateWeek(1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-arena-navy-800/10 text-arena-navy-800/60 transition-colors hover:bg-slate-50"
          aria-label="Próxima semana"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Espaços */}
      <div className="flex flex-wrap gap-2">
        {courts.map((court) => {
          const marcados = [...selected].filter((key) =>
            key.startsWith(`${court.id}|`)
          ).length;
          const ativo = court.id === activeCourtId;
          return (
            <button
              key={court.id}
              type="button"
              disabled={disabled}
              onClick={() => onActiveCourtChange(court.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
                ativo
                  ? 'border-arena-button bg-[#FFF5EF] shadow-[inset_0_0_0_1px_var(--arena-button)]'
                  : 'border-arena-navy-800/10 bg-white hover:bg-slate-50'
              )}
            >
              <span className="text-[13px] font-bold text-arena-navy-800">
                {court.name}
              </span>
              <span className="rounded-md bg-arena-status-active/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-arena-status-active">
                {livresPorCourt.get(court.id) ?? 0}h livres
              </span>
              {marcados > 0 && (
                <span className="rounded-md bg-arena-button px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                  {marcados}h aqui
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grade */}
      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-[620px] gap-[3px]"
          style={{ gridTemplateColumns: '58px repeat(7, minmax(74px, 1fr))' }}
          role="grid"
          aria-label="Disponibilidade da semana no espaço selecionado"
        >
          <div />
          {DIAS_SEMANA_CURTO.map((diaLabel, index) => (
            <div key={diaLabel} className="pb-1.5 pt-1 text-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-arena-navy-800/50">
                {diaLabel}
              </span>
              <span className="block font-mono text-[9.5px] font-medium text-arena-navy-800/40">
                {dias[index].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          ))}

          {horas.map((hora) => (
            <FragmentRow
              key={hora}
              hora={hora}
              grade={grade}
              activeCourtId={activeCourtId}
              selected={selected}
              disabled={disabled}
              onToggleSlot={onToggleSlot}
              onFocus={(dia) => setFoco({ dia, hora })}
              courts={courts}
              dias={dias}
            />
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] font-semibold text-arena-navy-800/50">
        <LegendaItem className="border-arena-status-active/25 bg-arena-status-active/10">
          Livre
        </LegendaItem>
        <LegendaItem className="border-red-200 bg-red-50">Ocupado</LegendaItem>
        <LegendaItem className="border-arena-navy-800/10 bg-slate-50">
          Fora do funcionamento
        </LegendaItem>
        <LegendaItem className="border-arena-button bg-arena-button">
          Selecionado
        </LegendaItem>
      </div>

      {/* Outros espaços livres no horário sob o cursor */}
      <div className="flex min-h-[52px] flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-arena-navy-800/15 bg-slate-50/70 px-3 py-2.5">
        {!foco ? (
          <span className="text-xs font-medium text-arena-navy-800/40">
            Passe o mouse por um horário para ver quais outros espaços estão livres nele.
          </span>
        ) : (
          <>
            <span className="text-xs font-bold text-arena-navy-800/70">
              Livre em{' '}
              <span className="font-mono">
                {DIAS_SEMANA_LONGO[foco.dia]},{' '}
                {dias[foco.dia].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                {formatHora(foco.hora)}
              </span>
              :
            </span>
            {alternativas.length === 0 ? (
              <span className="text-xs font-medium text-arena-navy-800/40">
                nenhum outro espaço disponível neste horário.
              </span>
            ) : (
              alternativas.map((court) => (
                <button
                  key={court.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onActiveCourtChange(court.id);
                    onToggleSlot(slotKeyAvulso(court.id, toDateKey(dias[foco.dia]), foco.hora));
                  }}
                  className="rounded-[10px] border border-arena-calendar-teal bg-white px-2.5 py-1.5 text-xs font-bold text-arena-calendar-teal transition-colors hover:bg-arena-calendar-teal/10"
                >
                  {court.name}
                </button>
              ))
            )}
          </>
        )}
      </div>

      {/* Blocos escolhidos */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">
            Horários escolhidos
          </span>
          {isQuoting && <Loader2 className="h-3 w-3 animate-spin text-arena-button" />}
        </div>

        {blocos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-arena-navy-800/15 px-4 py-5 text-center text-[12.5px] font-semibold text-arena-navy-800/40">
            Nenhum horário marcado ainda. Clique na grade para escolher.
          </div>
        ) : (
          <div className="space-y-1.5">
            {blocos.map((bloco) => {
              const court = courts.find((c) => c.id === bloco.courtId);
              const key = `${bloco.courtId}|${bloco.date}|${bloco.from}`;
              const data = new Date(bloco.date + 'T00:00:00');
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-arena-navy-800/10 border-l-[3px] border-l-arena-button bg-white px-3 py-2.5"
                >
                  <span className="min-w-[170px] text-[13px] font-black text-arena-navy-800">
                    {DIAS_SEMANA_LONGO[data.getDay()]},{' '}
                    {data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                    <span className="font-mono font-semibold text-arena-navy-800/70">
                      {formatHora(bloco.from)}–{formatHora(bloco.to)}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-arena-navy-800/50">
                    {court?.name ?? 'Espaço'}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] font-medium text-arena-navy-800/40">R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={disabled}
                      value={bloco.valor}
                      onChange={(e) => onBlocoValorChange(key, Number(e.target.value) || 0)}
                      className="w-24 rounded-lg border border-arena-navy-800/10 px-2 py-1 text-right font-mono text-[12.5px] font-semibold text-arena-navy-800 focus:border-arena-button focus:outline-none focus:ring-1 focus:ring-arena-button"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveBloco(key)}
                    aria-label={`Remover ${DIAS_SEMANA_LONGO[data.getDay()]} ${formatHora(bloco.from)}`}
                    className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg border border-arena-navy-800/10 p-1 text-arena-navy-800/40 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LegendaItem({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={cn('inline-block h-2.5 w-2.5 rounded border', className)} />
      {children}
    </span>
  );
}

interface FragmentRowProps {
  hora: number;
  grade: Map<string, ReturnType<typeof avaliarSlotAvulso>>;
  activeCourtId: string;
  selected: Set<string>;
  disabled: boolean;
  onToggleSlot: (key: string) => void;
  onFocus: (dia: number) => void;
  courts: CourtLike[];
  dias: Date[];
}

function FragmentRow({
  hora,
  grade,
  activeCourtId,
  selected,
  disabled,
  onToggleSlot,
  onFocus,
  courts,
  dias,
}: FragmentRowProps) {
  return (
    <>
      <div className="flex h-[30px] items-center justify-end pr-2 font-mono text-[10.5px] font-medium text-arena-navy-800/40">
        {formatHora(hora)}
      </div>
      {Array.from({ length: 7 }, (_, dia) => {
        const dateKey = toDateKey(dias[dia]);
        const key = slotKeyAvulso(activeCourtId, dateKey, hora);
        const info = grade.get(`${dia}|${hora}`) ?? { status: 'closed' as const };
        const marcado = selected.has(key);
        const selecionavel = podeSelecionarAvulso(info.status);

        const emOutroEspaco =
          !marcado &&
          courts.some(
            (court) =>
              court.id !== activeCourtId && selected.has(slotKeyAvulso(court.id, dateKey, hora))
          );

        return (
          <button
            key={dia}
            type="button"
            disabled={disabled || !selecionavel}
            onMouseEnter={() => onFocus(dia)}
            onFocus={() => onFocus(dia)}
            onClick={() => onToggleSlot(key)}
            title={tituloDoSlot(info, hora)}
            className={cn(
              'flex h-[30px] items-center justify-center overflow-hidden truncate rounded-md border px-1 text-[10.5px] font-bold transition-colors',
              marcado &&
                'border-arena-button-hover bg-arena-button text-white shadow-sm hover:bg-arena-button-hover',
              !marcado &&
                info.status === 'free' &&
                'border-arena-status-active/25 bg-arena-status-active/10 text-arena-status-active hover:bg-arena-status-active/20',
              !marcado &&
                info.status === 'busy' &&
                'cursor-not-allowed border-red-200 bg-red-50 font-semibold text-red-700',
              !marcado &&
                (info.status === 'closed' || info.status === 'past') &&
                'cursor-not-allowed border-arena-navy-800/5 bg-slate-50 text-arena-navy-800/25',
              emOutroEspaco && 'ring-1 ring-inset ring-[#FFE4D3]'
            )}
          >
            {rotuloDoSlot(info, marcado, emOutroEspaco)}
          </button>
        );
      })}
    </>
  );
}

function rotuloDoSlot(
  info: ReturnType<typeof avaliarSlotAvulso>,
  marcado: boolean,
  emOutroEspaco: boolean
) {
  if (marcado) return '✓';
  switch (info.status) {
    case 'busy':
      return info.occupantName ?? 'Ocupado';
    case 'closed':
    case 'past':
      return '—';
    default:
      return emOutroEspaco ? '·' : '';
  }
}

function tituloDoSlot(info: ReturnType<typeof avaliarSlotAvulso>, hora: number): string {
  switch (info.status) {
    case 'busy':
      return `Ocupado por ${info.occupantName ?? 'outro atleta'}`;
    case 'closed':
      return 'Fora do horário de funcionamento';
    case 'past':
      return 'Horário já passou';
    default:
      return `Livre a partir das ${formatHora(hora)}`;
  }
}
