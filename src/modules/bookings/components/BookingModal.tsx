'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Loader2,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Users,
  UserPlus,
  AlertTriangle,
  Minus,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { searchAthletesAction } from '@/modules/loyalty/actions/loyaltyActions';
import {
  getCourtByIdAction,
  getCourtsByArenaAction,
} from '@/modules/courts/actions/courtActions';
import {
  listCourtPriceTableOptionsAction,
  quoteCourtPriceAction,
  quoteMonthlyBlocksAction,
  type BookingPriceTableOption,
} from '@/modules/courts/actions/priceTableActions';
import {
  checkBookingConflictsAction,
  getBookingsByArenaAction,
  saveBackofficeBookingBundleAction,
} from '@/modules/bookings/actions/bookingActions';
import type { BookingConflict } from '@/modules/bookings/actions/bookingActions';
import type { Booking } from '@/modules/bookings/types/booking.types';
import { getProductsByArenaAction } from '@/modules/products/actions/stockActions';
import {
  isCatalogService,
  type Product,
} from '@/modules/products/types/product.types';
import {
  BookingServicesSection,
  sumBookingServiceLines,
  type BookingServiceLineLocal,
} from '@/modules/bookings/components/BookingServicesSection';
import { getPerfilAtletaAction } from '@/modules/athletes/actions/perfilActions';
import type { PerfilAtleta } from '@/modules/athletes/types/perfil.types';
import {
  createPlanoMensalistaBlocosAction,
} from '@/modules/bookings/actions/mensalistaActions';
import { MensalistaBlocosPicker } from '@/modules/bookings/components/MensalistaBlocosPicker';
import {
  agruparBlocos,
  fimDoHorizonte,
  fimDoMes,
  fracaoPrimeiroMes,
  intervaloDeCotacao,
  resumirPlano,
  slotKey,
  type Bloco,
  type BookingLike,
  type CourtLike,
} from '@/modules/bookings/lib/mensalista-blocos';
import {
  BookingParticipantsField,
  type BookingAthleteOption,
} from '@/modules/bookings/components/BookingParticipantsField';
import { AthleteRegistrationModal } from '@/modules/athletes/components/AthleteRegistrationModal';
import { toast } from 'sonner';
import {
  format,
  addWeeks,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, normalizeString } from '@/lib/utils';
import { track, trackAction } from '@/lib/telemetry/client';

interface Athlete {
  id: string;
  nome_perfil: string;
  telefone: string;
}

interface Sport {
  id: string;
  name: string;
}

interface AthleteSearchFieldProps {
  search: string;
  athletes: Athlete[];
  selectedAthlete: Athlete | null;
  isSearching: boolean;
  mensalista?: boolean;
  onSearch: (value: string) => void;
  onSelectAthlete: (athlete: Athlete) => void;
  onClearAthlete: () => void;
  onRegisterNew: () => void;
}

function AthleteSearchField({
  search,
  athletes,
  selectedAthlete,
  isSearching,
  mensalista = false,
  onSearch,
  onSelectAthlete,
  onClearAthlete,
  onRegisterNew,
}: AthleteSearchFieldProps) {
  const showDropdown = search.length >= 2 && !selectedAthlete;
  return (
    <div className="space-y-2 relative">
      <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
        {mensalista ? 'Atleta' : 'Nome do responsável'}
      </Label>
      {!selectedAthlete ? (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/20" />
          <Input
            placeholder={
              mensalista
                ? 'Buscar atleta vinculado à arena'
                : 'Selecione um atleta vinculado ou insira um novo'
            }
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-12 h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800"
          />
          {isSearching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-arena-button" />
          )}
          {showDropdown && (athletes.length > 0 || !isSearching) && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-arena-navy-800/10 rounded-2xl shadow-2xl max-h-48 overflow-auto p-2">
              {athletes.map((athlete) => (
                <button
                  key={athlete.id}
                  type="button"
                  onClick={() => onSelectAthlete(athlete)}
                  className="w-full text-left px-4 py-3 transition-colors flex items-center justify-between rounded-xl mb-1 last:mb-0 hover:bg-[#FFF5EF]"
                >
                  <div>
                    <p className="font-bold text-arena-navy-800 text-sm">
                      {athlete.nome_perfil}
                    </p>
                    <p className="text-[10px] uppercase font-black text-arena-navy-800/40 tracking-tight">
                      {athlete.telefone}
                    </p>
                  </div>
                </button>
              ))}
              {athletes.length === 0 && !isSearching && (
                <button
                  type="button"
                  onClick={onRegisterNew}
                  className="w-full text-left px-4 py-3 transition-colors flex items-center gap-3 rounded-xl hover:bg-[#FFF5EF]"
                >
                  <div className="h-8 w-8 rounded-full bg-arena-button/10 flex items-center justify-center flex-shrink-0">
                    <UserPlus className="h-4 w-4 text-arena-button" />
                  </div>
                  <div>
                    <p className="font-bold text-arena-button text-sm">
                      Cadastrar &ldquo;{search}&rdquo;
                    </p>
                    <p className="text-[10px] text-arena-navy-800/40">
                      Nenhum atleta encontrado · Criar novo
                    </p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 rounded-xl border bg-[#FFF5EF] border-[#FFE4D3]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-arena-button/10">
              <Check className="h-4 w-4 text-arena-button" />
            </div>
            <div>
              <p className="font-bold text-arena-navy-800 text-sm">
                {selectedAthlete.nome_perfil}
              </p>
              <p className="text-[10px] uppercase font-black text-arena-navy-800/40 tracking-tight">
                {selectedAthlete.telefone}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearAthlete}
            className="h-8 w-8 hover:bg-red-50 text-red-500 rounded-lg"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  arenaId: string;
  courtId: string;
  selectedDate: Date;
  selectedHour: number;
  selectedMinute?: number;
  defaultPrice: number;
  /** Quando informado, o modal abre em modo edição (reserva avulsa). */
  existingBooking?: Booking | null;
}

export function BookingModal({
  isOpen,
  onClose,
  onSuccess,
  arenaId,
  courtId,
  selectedDate,
  selectedHour,
  selectedMinute = 0,
  defaultPrice,
  existingBooking = null,
}: BookingModalProps) {
  const [bookingType, setBookingType] = useState<'avulso' | 'mensal'>('avulso');

  // Shared
  const [search, setSearch] = useState('');
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [courtSports, setCourtSports] = useState<Sport[]>([]);
  const [courtDayConfig, setCourtDayConfig] = useState<any[] | null>(null);
  const [priceTables, setPriceTables] = useState<BookingPriceTableOption[]>([]);
  const [avulsoPriceTableId, setAvulsoPriceTableId] = useState<string>('');
  const [avulsoSuggested, setAvulsoSuggested] = useState<number | null>(null);
  const lastAutoCourtPrice = useRef<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [isLoadingSports, setIsLoadingSports] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAthleteModalOpen, setIsAthleteModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState<BookingConflict[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Avulso
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  /** Valor da locação (quadra), sem serviços — o total enviado ao servidor inclui serviços. */
  const [courtPrice, setCourtPrice] = useState(defaultPrice.toString());
  const [serviceLines, setServiceLines] = useState<BookingServiceLineLocal[]>(
    []
  );
  const [catalogServiceProducts, setCatalogServiceProducts] = useState<
    Product[]
  >([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(2);
  const [includeServices, setIncludeServices] = useState(false);
  const [additionalParticipants, setAdditionalParticipants] = useState<
    BookingAthleteOption[]
  >([]);
  const [splitBillingPerParticipant, setSplitBillingPerParticipant] =
    useState(false);

  // Mensal
  const [diaSemana, setDiaSemana] = useState<string>(
    String(selectedDate.getDay())
  );
  const [horarioInicio, setHorarioInicio] = useState('19:00');
  const [horarioFim, setHorarioFim] = useState('20:00');
  const [sessoesPorMes, setSessoesPorMes] = useState('4');
  const [valorMensal, setValorMensal] = useState('');

  // Mensal — recorrência por blocos (N dias/horários, possivelmente em espaços
  // diferentes). A grade é a fonte da agenda; os campos legados acima ficam
  // apenas para a aba avulsa e para a checagem de conflito do fluxo antigo.
  const [blocoSlots, setBlocoSlots] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !selectedAthlete?.id || bookingType !== 'mensal') {
      setPerfilAtleta(null);
      return;
    }
    let cancelled = false;
    void getPerfilAtletaAction(arenaId, selectedAthlete.id).then((res) => {
      if (cancelled) return;
      // Sem perfil legível, segue a heurística antiga — não é motivo para
      // travar a criação do plano.
      const proximo = res.success && res.data ? res.data.perfilEfetivo : null;
      setPerfilAtleta((anterior) => {
        if (anterior !== proximo && tabelasAutomaticas.current.size > 0) {
          setPriceTableByCourt((prev) => {
            const next = { ...prev };
            for (const courtId of tabelasAutomaticas.current) delete next[courtId];
            return next;
          });
          tabelasAutomaticas.current = new Set();
        }
        return proximo;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedAthlete?.id, bookingType, arenaId]);
  const [activeCourtId, setActiveCourtId] = useState<string>(courtId);
  const [arenaCourts, setArenaCourts] = useState<CourtLike[]>([]);
  const [horizonteBookings, setHorizonteBookings] = useState<BookingLike[]>([]);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  /**
   * Perfil do atleta na arena. Professor cai na tabela Professor do espaço;
   * os demais, na Mensalista. O perfil só sugere — o seletor segue na tela.
   */
  const [perfilAtleta, setPerfilAtleta] = useState<PerfilAtleta | null>(null);
  /**
   * Espaços cuja tabela foi escolhida pelo sistema (não pelo gestor). O perfil
   * costuma chegar depois das tabelas; sem isso, um professor ficaria com a
   * tabela Mensalista escolhida antes de o perfil ser conhecido.
   */
  const tabelasAutomaticas = useRef<Set<string>>(new Set());
  const [priceTableByCourt, setPriceTableByCourt] = useState<
    Record<string, string>
  >({});
  const [priceTablesByCourt, setPriceTablesByCourt] = useState<
    Record<string, BookingPriceTableOption[]>
  >({});
  const [blocoValores, setBlocoValores] = useState<number[]>([]);
  const [isQuotingBlocos, setIsQuotingBlocos] = useState(false);
  const lastAutoValorBlocos = useRef<string | null>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const bookingOperationId = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && bookingOperationId.current === null) {
      bookingOperationId.current = crypto.randomUUID();
    } else if (!isOpen) {
      bookingOperationId.current = null;
    }
  }, [isOpen]);

  async function loadCourtSports(preferredSportId?: string | null) {
    try {
      setIsLoadingSports(true);
      const res = await getCourtByIdAction(arenaId, courtId);
      const sports = res.data?.sports ?? [];
      setCourtSports(sports);
      setCourtDayConfig(
        Array.isArray(res.data?.day_config)
          ? (res.data.day_config as any[])
          : null
      );
      if (sports.length > 0) {
        const pick =
          preferredSportId && sports.some((s) => s.id === preferredSportId)
            ? preferredSportId
            : sports[0].id;
        setSelectedSport(pick);
      } else {
        setSelectedSport('');
      }

      const tablesRes = await listCourtPriceTableOptionsAction(arenaId, courtId);
      const tables = tablesRes.success ? tablesRes.data : [];
      setPriceTables(tables);
      const defaultTable = tables.find((t) => t.isDefault) ?? tables[0];
      setAvulsoPriceTableId(defaultTable?.id ?? '');
    } finally {
      setIsLoadingSports(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    if (existingBooking) {
      const start = parseISO(existingBooking.start_time);
      const end = parseISO(existingBooking.end_time);
      setStartTime(format(start, 'HH:mm'));
      setEndTime(format(end, 'HH:mm'));
      setBookingType('avulso');
      setIsRecurring(false);
      setConflicts([]);
      if (existingBooking.atleta) {
        setSelectedAthlete({
          id: existingBooking.atleta.id,
          nome_perfil: existingBooking.atleta.nome_perfil,
          telefone: existingBooking.atleta.telefone ?? '',
        });
        setSearch(existingBooking.atleta.nome_perfil);
      } else {
        setSelectedAthlete(null);
        setSearch(existingBooking.athlete_name ?? '');
      }
      void loadCourtSports(existingBooking.sport_id ?? null);
      const raw = existingBooking.booking_services;
      const mapped: BookingServiceLineLocal[] = (raw ?? []).map((s) => ({
        productId: s.product_id,
        quantity: s.quantity,
        unitPrice: Number(s.unit_price),
        name: s.products?.name ?? 'Serviço',
      }));
      setServiceLines(mapped);
      setIncludeServices(mapped.length > 0);
      const svcSum = mapped.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
      const isSplit = existingBooking.cobranca_por_participante ?? false;
      setSplitBillingPerParticipant(isSplit);
      setCourtPrice(
        String(
          isSplit
            ? existingBooking.price ?? 0
            : Math.max(0, (existingBooking.price ?? 0) - svcSum)
        )
      );
      const extra = (existingBooking.booking_participants ?? [])
        .filter((p) => p.funcao === 'convidado')
        .map((p) => ({
          id: p.atleta_id,
          nome_perfil: p.atleta?.nome_perfil ?? 'Atleta',
          telefone: p.atleta?.telefone ?? '',
        }));
      setAdditionalParticipants(extra);
      // Não deixa o auto-quote sobrescrever o valor carregado da reserva.
      lastAutoCourtPrice.current = null;
      lastAutoValorBlocos.current = null;
      setAvulsoSuggested(null);
      return;
    }

    const startTotal = selectedHour * 60 + selectedMinute;
    const endTotal = startTotal + 60;
    const endHour = Math.floor(endTotal / 60) % 24;
    const endMin = endTotal % 60;
    const startStr = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    const endStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    setStartTime(startStr);
    setEndTime(endStr);
    setHorarioInicio(startStr);
    setHorarioFim(endStr);
    setCourtPrice(defaultPrice.toString());
    lastAutoCourtPrice.current = defaultPrice.toString();
    lastAutoValorBlocos.current = null;
    setAvulsoSuggested(null);
    setServiceLines([]);
    setIncludeServices(false);
    setAdditionalParticipants([]);
    setSplitBillingPerParticipant(false);
    setDiaSemana(String(selectedDate.getDay()));
    void loadCourtSports();
  }, [
    isOpen,
    existingBooking,
    selectedDate,
    selectedHour,
    selectedMinute,
    defaultPrice,
    arenaId,
    courtId,
  ]);

  // Limpa conflitos quando qualquer campo relevante muda
  useEffect(() => {
    setConflicts([]);
  }, [
    startTime,
    endTime,
    horarioInicio,
    horarioFim,
    diaSemana,
    isRecurring,
    recurrenceWeeks,
    bookingType,
  ]);

  useEffect(() => {
    if (!existingBooking && additionalParticipants.length === 0) {
      setSplitBillingPerParticipant(false);
    }
  }, [additionalParticipants.length, existingBooking]);

  useEffect(() => {
    if (splitBillingPerParticipant && includeServices) {
      setIncludeServices(false);
      setServiceLines([]);
    }
  }, [splitBillingPerParticipant, includeServices]);

  useEffect(() => {
    if (!isOpen) return;
    getProductsByArenaAction(arenaId).then((r) => {
      if (r.success && r.data) {
        setCatalogServiceProducts(
          (r.data as Product[]).filter((p) => isCatalogService(p))
        );
      } else {
        setCatalogServiceProducts([]);
      }
    });
  }, [isOpen, arenaId]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (selectedAthlete) setSelectedAthlete(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.length < 2) {
      setAthletes([]);
      return;
    }

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const result = await searchAthletesAction(arenaId);
        if (result.success && result.data) {
          const normalizedSearch = normalizeString(value);
          const filtered = (result.data as Athlete[]).filter(
            (a) =>
              a && normalizeString(a.nome_perfil).includes(normalizedSearch)
          );
          setAthletes(filtered);
        }
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  // Avulso: fim menor/igual ao início só é válido quando a reserva cruza a
  // meia-noite dentro do horário de funcionamento do espaço no dia
  // (ex.: 22:00 → 01:00 com funcionamento até 02:00).
  const avulsoEndTimeError = (() => {
    if (!startTime || !endTime) return null;
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    if ([sH, eH].some((n) => Number.isNaN(n))) return null;
    const startMins = sH * 60 + (sM || 0);
    const endMins = eH * 60 + (eM || 0);
    if (endMins > startMins) return null; // termina no mesmo dia

    const dayNames = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    const dayName = dayNames[selectedDate.getDay()];
    const dayCfg = courtDayConfig?.find(
      (d: any) => d?.day?.toLowerCase() === dayName.toLowerCase()
    );

    if (!dayCfg?.startTime || !dayCfg?.endTime) {
      return 'O fim deve ser maior que o início.';
    }

    const [opSH, opSM] = String(dayCfg.startTime).split(':').map(Number);
    const [opEH, opEM] = String(dayCfg.endTime).split(':').map(Number);
    const opStartMins = (opSH || 0) * 60 + (opSM || 0);
    const opEndMins = (opEH || 0) * 60 + (opEM || 0);
    const operationCrossesMidnight = opEndMins <= opStartMins;

    if (!operationCrossesMidnight) {
      return 'O fim deve ser maior que o início.';
    }
    if (endMins > opEndMins) {
      return `O fim deve estar dentro do funcionamento do espaço (até ${dayCfg.endTime}).`;
    }
    return null;
  })();

  // ── Sugestão de valor pela tabela de preço (server: resolve_court_price) ──
  // Sempre editável: só preenche quando o campo está vazio ou ainda mostra a
  // última sugestão automática — o gestor pode sobrescrever à vontade.
  const buildLocalIso = (base: Date, time: string, addDay = false) => {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(base);
    if (addDay) d.setDate(d.getDate() + 1);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toISOString();
  };

  useEffect(() => {
    if (!isOpen || bookingType !== 'avulso') return;
    if (!avulsoPriceTableId || !startTime || !endTime || avulsoEndTimeError) return;
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    if ([sH, eH].some((n) => Number.isNaN(n))) return;
    const overnight = eH * 60 + (eM || 0) <= sH * 60 + (sM || 0);
    const startISO = buildLocalIso(selectedDate, startTime);
    const endISO = buildLocalIso(selectedDate, endTime, overnight);
    let cancelled = false;
    quoteCourtPriceAction(arenaId, courtId, avulsoPriceTableId, startISO, endISO).then(
      (res) => {
        if (cancelled || !res.success) return;
        setAvulsoSuggested(res.value);
        setCourtPrice((prev) =>
          prev === '' || prev === lastAutoCourtPrice.current ? String(res.value) : prev
        );
        lastAutoCourtPrice.current = String(res.value);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    bookingType,
    avulsoPriceTableId,
    startTime,
    endTime,
    selectedDate,
    avulsoEndTimeError,
    arenaId,
    courtId,
  ]);

  // ── Agenda da recorrência: espaços e reservas dos 3 meses gerados ────────
  // Uma consulta só ao abrir a aba. A grade precisa do horizonte inteiro (e não
  // apenas da semana) porque um horário livre hoje pode colidir numa ocorrência
  // de daqui a dois meses — e nesse caso o bloco é bloqueado.
  useEffect(() => {
    if (!isOpen || bookingType !== 'mensal' || existingBooking) return;
    let cancelled = false;
    setIsLoadingAgenda(true);

    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fim = fimDoHorizonte(inicio);
    fim.setHours(23, 59, 59, 999);

    Promise.all([
      getCourtsByArenaAction(arenaId),
      getBookingsByArenaAction(arenaId, inicio.toISOString(), fim.toISOString()),
    ])
      .then(([courtsRes, bookingsRes]) => {
        if (cancelled) return;
        const courts = ((courtsRes.data ?? []) as CourtLike[]).filter(
          (court) => (court as { status?: string }).status !== 'inativo'
        );
        setArenaCourts(courts);
        setHorizonteBookings((bookingsRes.data ?? []) as BookingLike[]);
        if (!courts.some((court) => court.id === activeCourtId)) {
          setActiveCourtId(courts[0]?.id ?? courtId);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAgenda(false);
      });

    return () => {
      cancelled = true;
    };
    // activeCourtId fora das deps de propósito: trocar de espaço não recarrega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bookingType, existingBooking, arenaId, courtId]);

  // Tabelas de preço de cada espaço que entrou na recorrência. São por quadra,
  // então um plano que usa dois espaços escolhe duas tabelas.
  useEffect(() => {
    if (!isOpen || bookingType !== 'mensal') return;
    const courtIds = Array.from(
      new Set([...blocoSlots].map((key) => key.split('|')[0]))
    );
    const faltando = courtIds.filter((id) => !priceTablesByCourt[id]);
    if (faltando.length === 0) return;

    let cancelled = false;
    Promise.all(
      faltando.map(async (id) => ({
        id,
        tables: (await listCourtPriceTableOptionsAction(arenaId, id)).data ?? [],
      }))
    ).then((results) => {
      if (cancelled) return;
      setPriceTablesByCourt((prev) => {
        const next = { ...prev };
        for (const { id, tables } of results) next[id] = tables;
        return next;
      });
      setPriceTableByCourt((prev) => {
        const next = { ...prev };
        for (const { id, tables } of results) {
          if (next[id]) continue;
          // Professor tem tabela própria; sem perfil (ou perfil comum) vale a
          // Mensalista, como antes.
          const papel: 'professor' | 'mensalista' =
            perfilAtleta === 'professor' ? 'professor' : 'mensalista';
          const preferida =
            tables.find((t) => t.tipo === papel) ??
            tables.find((t) => t.aplicaA.includes(papel)) ??
            tables.find((t) => t.tipo === 'mensalista') ??
            tables.find((t) => t.isDefault) ??
            tables[0];
          if (preferida) {
            next[id] = preferida.id;
            tabelasAutomaticas.current.add(id);
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, bookingType, blocoSlots, priceTablesByCourt, arenaId, perfilAtleta]);

  // ── Subtotal ao vivo ─────────────────────────────────────────────────────
  // O preço de cada bloco vem de `resolve_court_price`, para respeitar as
  // faixas de horário da tabela. O total mensal é composto aqui multiplicando
  // pelas ocorrências reais de cada dia no mês.
  const blocosSelecionados = useMemo(
    () => agruparBlocos(blocoSlots),
    [blocoSlots]
  );

  const inicioVigencia = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  }, []);

  useEffect(() => {
    if (!isOpen || bookingType !== 'mensal') return;
    if (blocosSelecionados.length === 0) {
      setBlocoValores([]);
      setIsQuotingBlocos(false);
      return;
    }
    const semTabela = blocosSelecionados.some(
      (bloco) => !priceTableByCourt[bloco.courtId]
    );
    if (semTabela) return;

    let cancelled = false;
    setIsQuotingBlocos(true);
    const timer = setTimeout(() => {
      const payload = blocosSelecionados.map((bloco) => {
        const { startISO, endISO } = intervaloDeCotacao(bloco, inicioVigencia);
        return {
          courtId: bloco.courtId,
          priceTableId: priceTableByCourt[bloco.courtId] ?? null,
          startISO,
          endISO,
        };
      });

      quoteMonthlyBlocksAction(arenaId, payload)
        .then((res) => {
          if (cancelled || !res.success) return;
          setBlocoValores(res.values);
        })
        .finally(() => {
          if (!cancelled) setIsQuotingBlocos(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    bookingType,
    blocosSelecionados,
    priceTableByCourt,
    inicioVigencia,
    arenaId,
  ]);

  const resumoBlocos = useMemo(
    () => resumirPlano(blocosSelecionados, blocoValores, inicioVigencia),
    [blocosSelecionados, blocoValores, inicioVigencia]
  );

  // O valor sugerido preenche o campo, mas o gestor manda: uma vez editado à
  // mão, deixamos de sobrescrever (desconto ou acréscimo negociado).
  useEffect(() => {
    if (!isOpen || bookingType !== 'mensal') return;
    const sugerido = resumoBlocos.valorMesCheio;
    if (!sugerido) return;
    const texto = sugerido.toFixed(2);
    setValorMensal((prev) =>
      prev === '' || prev === lastAutoValorBlocos.current ? texto : prev
    );
    lastAutoValorBlocos.current = texto;
  }, [isOpen, bookingType, resumoBlocos.valorMesCheio]);

  /** Espaços que entraram na recorrência, na ordem em que aparecem. */
  const blocosCourtIds = useMemo(() => {
    const vistos: string[] = [];
    for (const bloco of blocosSelecionados) {
      if (!vistos.includes(bloco.courtId)) vistos.push(bloco.courtId);
    }
    return vistos;
  }, [blocosSelecionados]);

  const valorMensalEditadoManualmente =
    valorMensal !== '' && valorMensal !== lastAutoValorBlocos.current;

  /** Pró-rata aplicado sobre o valor que o gestor realmente vai cobrar. */
  const primeiraMensalidade = useMemo(() => {
    const cobrado = Number(valorMensal) || 0;
    return (
      Math.round(cobrado * fracaoPrimeiroMes(blocosSelecionados, inicioVigencia) * 100) /
      100
    );
  }, [valorMensal, blocosSelecionados, inicioVigencia]);

  const handleToggleSlot = (key: string) => {
    setBlocoSlots((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleRemoveBloco = (bloco: Bloco) => {
    setBlocoSlots((prev) => {
      const next = new Set(prev);
      for (const hora of bloco.hours) {
        next.delete(slotKey(bloco.courtId, bloco.diaSemana, hora));
      }
      return next;
    });
  };

  const handleSaveAvulso = async () => {
    if (!selectedAthlete && !search) {
      toast.error('Informe o nome do responsável');
      return;
    }
    if (avulsoEndTimeError) {
      toast.error(avulsoEndTimeError);
      return;
    }
    const court = Number(courtPrice);
    if (Number.isNaN(court) || court < 0) {
      toast.error('Informe um valor válido para a locação');
      return;
    }
    if (splitBillingPerParticipant) {
      if (!selectedAthlete?.id) {
        toast.error(
          'Para cobrança separada, o responsável precisa ser um atleta cadastrado'
        );
        return;
      }
      if (additionalParticipants.length === 0) {
        toast.error(
          'Adicione pelo menos um participante para cobrança separada'
        );
        return;
      }
    }
    const servicePayload = serviceLines.map((l) => ({
      product_id: l.productId,
      quantity: l.quantity,
    }));

    try {
      setIsSaving(true);
      const startDateTime = new Date(selectedDate);
      const [sH, sM] = startTime.split(':').map(Number);
      startDateTime.setHours(sH, sM, 0, 0);
      const endDateTime = new Date(selectedDate);
      const [eH, eM] = endTime.split(':').map(Number);
      endDateTime.setHours(eH, eM, 0, 0);
      if (endDateTime <= startDateTime)
        endDateTime.setDate(endDateTime.getDate() + 1);

      bookingOperationId.current ??= crypto.randomUUID();
      const weeks = isRecurring
        ? Math.max(1, Math.floor(recurrenceWeeks) || 1)
        : 1;
      const slots = Array.from({ length: weeks }, (_, index) => ({
        start_time: addWeeks(startDateTime, index).toISOString(),
        end_time: addWeeks(endDateTime, index).toISOString(),
      }));
      const result = await saveBackofficeBookingBundleAction(arenaId, {
        operationId: bookingOperationId.current,
        updateBookingId: existingBooking?.id ?? null,
        courtId,
        athleteName: selectedAthlete ? selectedAthlete.nome_perfil : search,
        athleteId: selectedAthlete?.id ?? null,
        sportId: selectedSport || null,
        rentalPrice: court,
        splitBilling: splitBillingPerParticipant,
        recurrenceId: isRecurring ? bookingOperationId.current : null,
        slots,
        services: servicePayload,
        additionalAthleteIds: additionalParticipants.map((p) => p.id),
      });
      if (!result.success) {
        trackAction('booking_save', 'failure', { arena_id: arenaId });
        toast.error(result.error ?? (existingBooking ? 'Erro ao atualizar reserva' : 'Erro ao criar reserva'));
        return;
      }

      bookingOperationId.current = null;
      trackAction('booking_save', 'success', {
        arena_id: arenaId,
        booking_type: 'avulso',
        edit_mode: Boolean(existingBooking),
        recurring: isRecurring,
      });
      if (existingBooking) {
        toast.success('Reserva atualizada com sucesso!');
        onSuccess();
        onClose();
        resetForm();
        return;
      }

      toast.success(
        isRecurring
          ? splitBillingPerParticipant
            ? 'Agenda criada! Confirme o pagamento de cada participante em Financeiro → Cobranças Avulsas.'
            : 'Agenda criada! Confirme os pagamentos em Financeiro → Cobranças Avulsas.'
          : splitBillingPerParticipant
            ? 'Reserva criada! Confirme o pagamento de cada participante em Financeiro → Cobranças Avulsas.'
            : 'Reserva criada! Confirme o pagamento em Financeiro → Cobranças Avulsas.'
      );
      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      trackAction('booking_save', 'failure', {
        arena_id: arenaId,
        booking_type: 'avulso',
        edit_mode: Boolean(existingBooking),
        recurring: isRecurring,
        source: error instanceof Error ? 'exception' : 'unknown_error',
      });
      toast.error('Erro ao criar reserva');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMensal = async () => {
    if (!selectedAthlete) {
      toast.error('Selecione um atleta vinculado à arena');
      return;
    }
    if (!valorMensal || isNaN(Number(valorMensal))) {
      toast.error('Informe o valor mensal');
      return;
    }
    if (blocosSelecionados.length === 0) {
      toast.error('Marque ao menos um horário na grade');
      return;
    }

    setIsSaving(true);
    try {
      const result = await createPlanoMensalistaBlocosAction(arenaId, {
        athlete_id: selectedAthlete.id,
        sport_id: selectedSport || undefined,
        blocos: blocosSelecionados.map((bloco) => ({
          court_id: bloco.courtId,
          dia_semana: bloco.diaSemana,
          horario_inicio: `${String(bloco.from).padStart(2, '0')}:00`,
          horario_fim: `${String(bloco.to).padStart(2, '0')}:00`,
        })),
        valor_mensal: Number(valorMensal),
        additional_athlete_ids: additionalParticipants.map((p) => p.id),
        // A tabela do primeiro bloco, mesmo critério que o plano usa para
        // court_id e horário. É o que identifica um plano de professor depois.
        price_table_id: priceTableByCourt[blocosSelecionados[0].courtId] ?? null,
      });

      if (!result.success) {
        trackAction('membership_plan_save', 'failure', {
          arena_id: arenaId,
          booking_type: 'mensalista',
          source: 'server_result',
        });
        throw new Error(result.error);
      }

      trackAction('membership_plan_save', 'success', {
        arena_id: arenaId,
        booking_type: 'mensalista',
      });
      toast.success('Plano mensalista criado com sucesso!');
      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      trackAction('membership_plan_save', 'failure', {
        arena_id: arenaId,
        booking_type: 'mensalista',
        source: error instanceof Error ? 'exception' : 'unknown_error',
      });
      toast.error(
        error instanceof Error ? error.message : 'Erro ao criar mensalista'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSearch('');
    setAthletes([]);
    setSelectedAthlete(null);
    setSelectedSport('');
    setIsRecurring(false);
    setRecurrenceWeeks(2);
    setDiaSemana('1');
    setHorarioInicio('19:00');
    setHorarioFim('20:00');
    setSessoesPorMes('4');
    setValorMensal('');
    setBlocoSlots(new Set());
    setBlocoValores([]);
    setPriceTableByCourt({});
    setPriceTablesByCourt({});
    setActiveCourtId(courtId);
    lastAutoValorBlocos.current = null;
    setBookingType('avulso');
    setConflicts([]);
    setCourtPrice(defaultPrice.toString());
    setServiceLines([]);
    setIncludeServices(false);
    setAdditionalParticipants([]);
    setSplitBillingPerParticipant(false);
    setPriceTables([]);
    setAvulsoPriceTableId('');
    setAvulsoSuggested(null);
    lastAutoCourtPrice.current = null;
    lastAutoValorBlocos.current = null;
  };

  // ── Helpers para gerar slots a verificar ────────────────────────────────
  function buildSlotsAvulso(): { startTime: string; endTime: string }[] {
    const startDateTime = new Date(selectedDate);
    const [sH, sM] = startTime.split(':').map(Number);
    startDateTime.setHours(sH, sM, 0, 0);
    const endDateTime = new Date(selectedDate);
    const [eH, eM] = endTime.split(':').map(Number);
    endDateTime.setHours(eH, eM, 0, 0);
    if (endDateTime <= startDateTime)
      endDateTime.setDate(endDateTime.getDate() + 1);

    if (!isRecurring)
      return [
        {
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
        },
      ];

    const weeks = Math.max(1, Math.floor(recurrenceWeeks) || 1);
    const slots = [];
    for (let i = 0; i < weeks; i++) {
      slots.push({
        startTime: addWeeks(startDateTime, i).toISOString(),
        endTime: addWeeks(endDateTime, i).toISOString(),
      });
    }
    return slots;
  }

  function buildSlotsMensal(): { startTime: string; endTime: string }[] {
    const slots: { startTime: string; endTime: string }[] = [];
    const now = new Date();
    const [sH, sM] = horarioInicio.split(':').map(Number);
    const [eH, eM] = horarioFim.split(':').map(Number);
    const diaSemanaNum = Number(diaSemana);
    const sessoes = Number(sessoesPorMes) || 4;

    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const targetDate = addMonths(now, monthOffset);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();

      let current = startOfMonth(new Date(year, month, 1));
      const end = endOfMonth(new Date(year, month, 1));
      while (current.getDay() !== diaSemanaNum) current = addDays(current, 1);

      let count = 0;
      while (current <= end && count < sessoes) {
        const startDt = new Date(current);
        startDt.setHours(sH, sM, 0, 0);
        const endDt = new Date(current);
        endDt.setHours(eH, eM, 0, 0);
        if (startDt > now) {
          slots.push({
            startTime: startDt.toISOString(),
            endTime: endDt.toISOString(),
          });
        }
        current = addDays(current, 7);
        count++;
      }
    }
    return slots;
  }

  // ── Pre-save: verifica conflitos antes de salvar ─────────────────────────
  async function handlePreSave() {
    if (bookingType === 'avulso' && avulsoEndTimeError) {
      toast.error(avulsoEndTimeError);
      return;
    }
    setConflicts([]);
    setIsCheckingConflicts(true);
    try {
      const slots =
        bookingType === 'avulso' ? buildSlotsAvulso() : buildSlotsMensal();
      if (slots.length === 0) {
        // Sem slots futuros (todos no passado), deixa o server action tratar
        bookingType === 'avulso'
          ? await handleSaveAvulso()
          : await handleSaveMensal();
        return;
      }
      const result = await checkBookingConflictsAction(
        arenaId,
        courtId,
        slots,
        existingBooking?.id
      );
      if (!result.success) {
        trackAction('booking_conflict_check', 'failure', {
          arena_id: arenaId,
          court_id: courtId,
          booking_type: bookingType,
          source: 'server_result',
        });
        toast.error(result.error ?? 'Erro ao verificar conflitos');
        return;
      }
      if (result.conflicts.length > 0) {
        track('booking_conflict_detected', {
          arena_id: arenaId,
          court_id: courtId,
          booking_type: bookingType,
          conflict_count: result.conflicts.length,
        });
        setConflicts(result.conflicts);
        return;
      }
      // Sem conflitos — prossegue
      bookingType === 'avulso'
        ? await handleSaveAvulso()
        : await handleSaveMensal();
    } finally {
      setIsCheckingConflicts(false);
    }
  }

  const handleAthleteRegistered = async () => {
    setIsAthleteModalOpen(false);
    try {
      setIsSearching(true);
      const result = await searchAthletesAction(arenaId);
      if (result.success && result.data) {
        const normalizedSearch = normalizeString(search);
        const filtered = (result.data as Athlete[]).filter(
          (a) => a && normalizeString(a.nome_perfil).includes(normalizedSearch)
        );
        if (filtered.length === 1) {
          setSelectedAthlete(filtered[0]);
          setSearch(filtered[0].nome_perfil);
          setAthletes([]);
        } else {
          setAthletes(filtered);
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  const athleteSearchProps = {
    search,
    athletes,
    selectedAthlete,
    isSearching,
    onSearch: handleSearch,
    onSelectAthlete: (athlete: Athlete) => {
      setSelectedAthlete(athlete);
      setSearch(athlete.nome_perfil);
      setAthletes([]);
      setAdditionalParticipants((prev) =>
        prev.filter((p) => p.id !== athlete.id)
      );
    },
    onClearAthlete: () => setSelectedAthlete(null),
    onRegisterNew: () => setIsAthleteModalOpen(true),
  };

  const servicesSumDisplay = useMemo(
    () => sumBookingServiceLines(serviceLines),
    [serviceLines]
  );
  const hasPaidParticipants = Boolean(
    existingBooking?.booking_participants?.some(
      (p) =>
        (p.funcao === 'responsavel' || p.funcao === 'convidado') && p.pago_em
    )
  );
  const participantCount = 1 + additionalParticipants.length;
  const totalDisplay =
    (Number(courtPrice) || 0) *
      (splitBillingPerParticipant ? participantCount : 1) +
    servicesSumDisplay;
  const fmtBrl = (n: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(n);
  const recurrenceWeeksDisplay = Math.max(1, Math.floor(recurrenceWeeks) || 1);
  const recurrenceMesesAprox = Math.max(
    1,
    Math.ceil(recurrenceWeeksDisplay / 4)
  );

  return (
    <>
      <Dialog
        open={isOpen}
        modal={!isAthleteModalOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent
          className={cn(
            '!flex max-h-[90vh] min-h-0 w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-3xl border-none bg-white p-0 shadow-2xl',
            'sm:max-w-[min(995px,calc(100vw-2rem))] sm:w-full'
          )}
        >
          <DialogHeader className="shrink-0 space-y-0 px-6 pb-4 pt-6 text-left sm:px-10 sm:pb-5 sm:pt-8">
            <DialogTitle className="text-2xl font-black text-arena-navy-800 tracking-tight">
              {existingBooking
                ? 'Editar reserva'
                : bookingType === 'avulso'
                  ? 'Cadastrar nova reserva'
                  : 'Novo Mensalista'}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 sm:px-10">
            <div className="space-y-6 pb-6 sm:space-y-8 sm:pb-8">
              {/* Tipo de reserva */}
              {!existingBooking && (
                <div className="flex items-center gap-1 rounded-xl bg-[#F1F5F9] p-1">
                  <button
                    type="button"
                    onClick={() => setBookingType('avulso')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all',
                      bookingType === 'avulso'
                        ? 'bg-white text-arena-button shadow-sm'
                        : 'text-arena-navy-800/50 hover:text-arena-navy-800'
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    Avulso
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingType('mensal')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all',
                      bookingType === 'mensal'
                        ? 'bg-white text-arena-button shadow-sm'
                        : 'text-arena-navy-800/50 hover:text-arena-navy-800'
                    )}
                  >
                    <Users className="h-4 w-4" />
                    Mensal
                  </button>
                </div>
              )}
              {existingBooking && bookingType === 'avulso' && (
                <div
                  className="flex items-center gap-1 rounded-xl bg-[#F1F5F9] p-1"
                  aria-label="Tipo de reserva: avulsa"
                >
                  <div className="pointer-events-none flex flex-1 items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-bold text-arena-button shadow-sm">
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    Avulso
                  </div>
                  <div
                    className="flex flex-1 cursor-not-allowed select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-arena-navy-800/35"
                    title="Alterar para mensal não está disponível ao editar esta reserva"
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    Mensal
                  </div>
                </div>
              )}

              {/* ── AVULSO ── */}
              {bookingType === 'avulso' && (
                <>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
                    <div className="min-w-0 space-y-4 lg:col-span-6">
                      <AthleteSearchField {...athleteSearchProps} />
                      <BookingParticipantsField
                        arenaId={arenaId}
                        participants={additionalParticipants}
                        excludeAthleteId={selectedAthlete?.id}
                        onChange={setAdditionalParticipants}
                        onRegisterNew={() => setIsAthleteModalOpen(true)}
                        disabled={isSaving}
                      />
                      {additionalParticipants.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (hasPaidParticipants) return;
                                setSplitBillingPerParticipant((prev) => !prev);
                              }}
                              disabled={hasPaidParticipants}
                              className={cn(
                                'relative mt-0.5 h-6 w-12 shrink-0 rounded-full transition-colors',
                                splitBillingPerParticipant
                                  ? 'bg-arena-button'
                                  : 'bg-gray-200',
                                hasPaidParticipants &&
                                  'cursor-not-allowed opacity-40'
                              )}
                              aria-pressed={splitBillingPerParticipant}
                            >
                              <div
                                className={cn(
                                  'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                                  splitBillingPerParticipant ? 'left-7' : 'left-1'
                                )}
                              />
                            </button>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <Label className="text-sm font-bold text-arena-navy-800">
                                Cobrança separada por participante
                              </Label>
                              <p className="text-[10px] font-medium leading-snug text-arena-navy-800/40">
                                Cada pessoa terá sua própria cobrança e entrada no
                                financeiro. A reserva só é confirmada quando todos
                                pagarem.
                              </p>
                              {hasPaidParticipants && (
                                <p className="text-[10px] font-semibold leading-snug text-amber-700">
                                  Não é possível alterar este modo após confirmar
                                  pagamentos de participantes.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 lg:col-span-3">
                      <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                        Data
                      </Label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/20" />
                        <Input
                          value={format(selectedDate, 'dd/MM/yyyy', {
                            locale: ptBR,
                          })}
                          readOnly
                          placeholder="dd/mm/aaaa"
                          className="h-14 rounded-xl border-arena-navy-800/10 bg-gray-50 pl-12 font-bold text-arena-navy-800 focus:ring-0"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 lg:col-span-3">
                      <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                        Esporte
                      </Label>
                      <Select
                        value={selectedSport || undefined}
                        onValueChange={setSelectedSport}
                        disabled={isLoadingSports}
                      >
                        <SelectTrigger className="h-14 rounded-xl border-arena-navy-800/10 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button">
                          <SelectValue
                            placeholder={
                              isLoadingSports
                                ? 'Carregando...'
                                : 'Selecione o tipo de esporte'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-arena-navy-800/10 p-2">
                          {courtSports.map((sport) => (
                            <SelectItem
                              key={sport.id}
                              value={sport.id}
                              className="rounded-xl py-3 font-bold text-arena-navy-800"
                            >
                              {sport.name}
                            </SelectItem>
                          ))}
                          {courtSports.length === 0 && !isLoadingSports && (
                            <SelectItem value="__no_sports" disabled>
                              Nenhum esporte cadastrado neste espaço
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
                    <div className="space-y-2 lg:col-span-3">
                      <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                        Horário início
                      </Label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/20" />
                        <Input
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          placeholder="08h00"
                          className="h-14 rounded-xl border-arena-navy-800/10 pl-12 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 lg:col-span-3">
                      <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                        Horário fim
                      </Label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/20" />
                        <Input
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          placeholder="09h00"
                          className={cn(
                            'h-14 rounded-xl border-arena-navy-800/10 pl-12 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button',
                            avulsoEndTimeError &&
                              'border-red-400 focus:border-red-400 focus:ring-red-400'
                          )}
                        />
                      </div>
                      {avulsoEndTimeError && (
                        <p className="text-xs font-medium text-red-500">
                          {avulsoEndTimeError}
                        </p>
                      )}
                    </div>
                    {priceTables.length > 1 && (
                      <div className="space-y-2 lg:col-span-3">
                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                          Tabela de preço
                        </Label>
                        <Select
                          value={avulsoPriceTableId || undefined}
                          onValueChange={setAvulsoPriceTableId}
                        >
                          <SelectTrigger className="h-14 rounded-xl border-arena-navy-800/10 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-arena-navy-800/10 p-2">
                            {priceTables.map((t) => (
                              <SelectItem
                                key={t.id}
                                value={t.id}
                                className="rounded-xl py-3 font-bold text-arena-navy-800"
                              >
                                {t.nome}
                                {t.isDefault ? ' · padrão' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div
                      className={cn(
                        'space-y-2',
                        priceTables.length > 1 ? 'lg:col-span-3' : 'lg:col-span-6'
                      )}
                    >
                      <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                        {splitBillingPerParticipant
                          ? 'Valor por participante'
                          : 'Valor pago'}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-arena-navy-800/40">
                          R$
                        </span>
                        <Input
                          value={courtPrice}
                          onChange={(e) => setCourtPrice(e.target.value)}
                          placeholder="00,00"
                          className="h-14 rounded-xl border-arena-navy-800/10 pl-12 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button"
                        />
                      </div>
                      {avulsoSuggested !== null && (
                        <p className="text-[11px] font-medium text-arena-navy-800/45">
                          Sugerido pela tabela: {fmtBrl(avulsoSuggested)}
                          {String(avulsoSuggested) !== courtPrice.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setCourtPrice(String(avulsoSuggested));
                                lastAutoCourtPrice.current = String(avulsoSuggested);
                              }}
                              className="ml-2 font-bold text-arena-button underline underline-offset-2"
                            >
                              usar sugerido
                            </button>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8 border-t border-slate-200 pt-6 md:grid-cols-2 md:gap-0">
                    {!existingBooking ? (
                      <div className="flex min-w-0 flex-col md:border-r md:border-slate-200 md:pr-8">
                        <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                          <button
                            type="button"
                            onClick={() => setIsRecurring(!isRecurring)}
                            className={cn(
                              'relative mt-0.5 h-6 w-12 shrink-0 rounded-full transition-colors',
                              isRecurring ? 'bg-arena-button' : 'bg-gray-200'
                            )}
                            aria-pressed={isRecurring}
                          >
                            <div
                              className={cn(
                                'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                                isRecurring ? 'left-7' : 'left-1'
                              )}
                            />
                          </button>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <Label className="text-sm font-bold text-arena-navy-800">
                              Reserva recorrente
                            </Label>
                            <p className="text-[10px] font-medium leading-snug text-arena-navy-800/40">
                              Repetir este horário toda semana
                            </p>
                          </div>
                        </div>
                        {isRecurring && (
                          <div className="animate-in fade-in slide-in-from-top-2 mt-4 duration-300">
                            <div className="rounded-xl border border-slate-200/90 bg-slate-100 p-4">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 space-y-1.5">
                                  <p className="text-sm font-semibold text-arena-navy-800">
                                    Selecione a duração (semanas)
                                  </p>
                                  <p className="text-xs leading-relaxed text-arena-navy-800/50">
                                    Serão criadas {recurrenceWeeksDisplay}{' '}
                                    {recurrenceWeeksDisplay === 1
                                      ? 'reserva'
                                      : 'reservas'}{' '}
                                    nas próximas{' '}
                                    {recurrenceMesesAprox === 1
                                      ? '1 mês'
                                      : `${recurrenceMesesAprox} meses`}{' '}
                                    (aprox.)
                                  </p>
                                </div>
                                <div className="flex h-10 shrink-0 items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRecurrenceWeeks((w) =>
                                        Math.max(1, (Math.floor(w) || 1) - 1)
                                      )
                                    }
                                    className="flex w-10 items-center justify-center text-arena-navy-800 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35"
                                    disabled={recurrenceWeeksDisplay <= 1}
                                    aria-label="Menos uma semana"
                                  >
                                    <Minus
                                      className="h-4 w-4"
                                      strokeWidth={2.5}
                                    />
                                  </button>
                                  <span className="flex min-w-[2.5rem] items-center justify-center border-x border-slate-200 text-sm font-black tabular-nums text-arena-navy-800">
                                    {recurrenceWeeksDisplay}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRecurrenceWeeks((w) =>
                                        Math.min(52, (Math.floor(w) || 1) + 1)
                                      )
                                    }
                                    className="flex w-10 items-center justify-center text-arena-navy-800 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35"
                                    disabled={recurrenceWeeksDisplay >= 52}
                                    aria-label="Mais uma semana"
                                  >
                                    <Plus
                                      className="h-4 w-4"
                                      strokeWidth={2.5}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="hidden min-h-0 md:block md:border-r md:border-slate-200 md:pr-8"
                        aria-hidden
                      />
                    )}

                    <div className="flex min-w-0 flex-col md:pl-8">
                      <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (splitBillingPerParticipant) return;
                            setIncludeServices((prev) => {
                              if (prev) setServiceLines([]);
                              return !prev;
                            });
                          }}
                          disabled={splitBillingPerParticipant}
                          className={cn(
                            'relative mt-0.5 h-6 w-12 shrink-0 rounded-full transition-colors',
                            includeServices ? 'bg-arena-button' : 'bg-gray-200',
                            splitBillingPerParticipant &&
                              'cursor-not-allowed opacity-40'
                          )}
                          aria-pressed={includeServices}
                        >
                          <div
                            className={cn(
                              'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                              includeServices ? 'left-7' : 'left-1'
                            )}
                          />
                        </button>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <Label className="text-sm font-bold text-arena-navy-800">
                            Adicionar serviço
                          </Label>
                          <p className="text-[10px] font-medium leading-snug text-arena-navy-800/40">
                            Inclua serviços nessa reserva e já calcule o valor
                            de forma única
                          </p>
                        </div>
                      </div>
                      {includeServices && (
                        <div className="animate-in fade-in slide-in-from-top-2 mt-4 duration-300">
                          <BookingServicesSection
                            compact
                            catalogServices={catalogServiceProducts.map(
                              (p) => ({
                                id: p.id,
                                name: p.name,
                                price: p.price,
                              })
                            )}
                            lines={serviceLines}
                            onLinesChange={setServiceLines}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-arena-navy-800/70">
                        Total da reserva
                      </span>
                      <span className="text-2xl font-black tracking-tight text-arena-button">
                        {fmtBrl(totalDisplay)}
                      </span>
                    </div>
                    {splitBillingPerParticipant ? (
                      <p className="mt-2 text-[11px] font-medium text-arena-navy-800/45">
                        {participantCount} participante
                        {participantCount !== 1 ? 's' : ''} ×{' '}
                        {fmtBrl(Number(courtPrice) || 0)}
                      </p>
                    ) : serviceLines.length > 0 ? (
                      <p className="mt-2 text-[11px] font-medium text-arena-navy-800/45">
                        Locação {fmtBrl(Number(courtPrice) || 0)} + serviços{' '}
                        {fmtBrl(servicesSumDisplay)}
                      </p>
                    ) : null}
                  </div>
                </>
              )}

              {/* ── MENSAL ── */}
              {bookingType === 'mensal' && (
                <>
                  <AthleteSearchField {...athleteSearchProps} mensalista />

                  <BookingParticipantsField
                    arenaId={arenaId}
                    participants={additionalParticipants}
                    excludeAthleteId={selectedAthlete?.id}
                    onChange={setAdditionalParticipants}
                    onRegisterNew={() => setIsAthleteModalOpen(true)}
                    disabled={isSaving}
                  />

                  {/* Grade de disponibilidade — a agenda da recorrência */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                        Onde e quando
                      </Label>
                      <span className="ml-auto text-[11.5px] font-medium text-arena-navy-800/40">
                        Clique nos horários livres. Horas seguidas viram um bloco só.
                      </span>
                    </div>
                    <MensalistaBlocosPicker
                      courts={arenaCourts}
                      bookings={horizonteBookings}
                      isLoading={isLoadingAgenda}
                      selected={blocoSlots}
                      onToggleSlot={handleToggleSlot}
                      onRemoveBloco={handleRemoveBloco}
                      inicioVigencia={inicioVigencia}
                      activeCourtId={activeCourtId}
                      onActiveCourtChange={setActiveCourtId}
                      resumo={resumoBlocos}
                      isQuoting={isQuotingBlocos}
                      disabled={isSaving}
                    />
                  </div>

                  {/* Esporte */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                      Esporte
                    </Label>
                    <Select
                      value={selectedSport || undefined}
                      onValueChange={setSelectedSport}
                      disabled={isLoadingSports}
                    >
                      <SelectTrigger className="h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800">
                        <SelectValue
                          placeholder={
                            isLoadingSports
                              ? 'Carregando...'
                              : 'Selecione o esporte'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-arena-navy-800/10 p-2">
                        {courtSports.map((sport) => (
                          <SelectItem
                            key={sport.id}
                            value={sport.id}
                            className="rounded-xl py-3 font-bold text-arena-navy-800"
                          >
                            {sport.name}
                          </SelectItem>
                        ))}
                        {courtSports.length === 0 && !isLoadingSports && (
                          <SelectItem value="__no_sports" disabled>
                            Nenhum esporte cadastrado neste espaço
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tabela de preço — uma por espaço usado na recorrência */}
                  {blocosCourtIds.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                        Tabela de preço
                      </Label>
                      <div className="space-y-2">
                        {blocosCourtIds.map((cid) => {
                          const court = arenaCourts.find((c) => c.id === cid);
                          const tables = priceTablesByCourt[cid] ?? [];
                          return (
                            <div
                              key={cid}
                              className="flex flex-wrap items-center gap-3 rounded-xl border border-arena-navy-800/10 bg-white px-3 py-2"
                            >
                              <span className="min-w-[120px] text-[13px] font-bold text-arena-navy-800">
                                {court?.name ?? 'Espaço'}
                              </span>
                              <Select
                                value={priceTableByCourt[cid] || undefined}
                                onValueChange={(value) => {
                                  // Escolha do gestor: o perfil não sobrescreve mais.
                                  tabelasAutomaticas.current.delete(cid);
                                  setPriceTableByCourt((prev) => ({
                                    ...prev,
                                    [cid]: value,
                                  }));
                                }}
                              >
                                <SelectTrigger className="ml-auto h-11 w-full max-w-[260px] rounded-xl border-arena-navy-800/10 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-arena-navy-800/10 p-2">
                                  {tables.map((t) => (
                                    <SelectItem
                                      key={t.id}
                                      value={t.id}
                                      className="rounded-xl py-3 font-bold text-arena-navy-800"
                                    >
                                      {t.nome}
                                      {t.isDefault ? ' · padrão' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] font-medium text-arena-navy-800/45">
                        O valor de cada bloco respeita as faixas de horário da tabela
                        escolhida para o espaço.
                      </p>
                    </div>
                  )}

                  {/* Subtotal e valor cobrado */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 rounded-2xl border border-arena-navy-800/10 bg-slate-50/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-arena-navy-800/60">
                        Subtotal pela tabela
                      </p>
                      <div className="space-y-1 text-[12.5px]">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold text-arena-navy-800/50">
                            Horas por semana
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-arena-navy-800">
                            {resumoBlocos.horasSemana}h
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold text-arena-navy-800/50">
                            Valor por semana
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-arena-navy-800">
                            {fmtBrl(resumoBlocos.valorSemana)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold text-arena-navy-800/50">
                            Reservas no mês de referência
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-arena-navy-800">
                            {resumoBlocos.ocorrenciasMesCheio}x
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-arena-navy-800/10 pt-2">
                          <span className="text-[13px] font-black text-arena-navy-800">
                            Mensalidade
                          </span>
                          <span className="text-xl font-black text-arena-button">
                            {fmtBrl(resumoBlocos.valorMesCheio)}
                          </span>
                        </div>
                        {resumoBlocos.variacaoMensal.length > 1 && (
                          <p className="text-[11px] leading-snug text-arena-navy-800/45">
                            O preço da hora é fixo, então a fatura acompanha o
                            calendário:{' '}
                            {resumoBlocos.variacaoMensal
                              .map((v) => `${fmtBrl(v.valor)} em meses com ${v.ocorrencias} reservas`)
                              .join(' · ')}
                            .
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                        Valor mensal cobrado (R$)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-arena-navy-800/40 font-bold text-sm">
                          R$
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={valorMensal}
                          onChange={(e) => setValorMensal(e.target.value)}
                          className="pl-10 h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800"
                        />
                      </div>
                      <p className="text-[11px] font-medium text-arena-navy-800/45">
                        {valorMensalEditadoManualmente
                          ? `Ajustado à mão — a tabela sugeria ${fmtBrl(resumoBlocos.valorMesCheio)}.`
                          : 'Preenchido pela tabela. Edite para aplicar desconto ou acréscimo.'}
                        {resumoBlocos.variacaoMensal.length > 1 &&
                          ' É o valor de um mês de referência; meses com menos reservas são cobrados proporcionalmente.'}
                      </p>

                      {resumoBlocos.horasSemana > 0 && (
                        <div className="rounded-xl border border-arena-amber/40 bg-arena-inactive-pill-bg px-3 py-2 text-[11.5px] font-semibold text-arena-inactive-pill-fg">
                          {resumoBlocos.ocorrenciasPrimeiroMes > 0 ? (
                            <>
                              1ª mensalidade proporcional (
                              {format(inicioVigencia, 'dd/MM', { locale: ptBR })}–
                              {format(fimDoMes(inicioVigencia), 'dd/MM', { locale: ptBR })}
                              ):{' '}
                              <span className="font-mono">
                                {fmtBrl(primeiraMensalidade)}
                              </span>{' '}
                              · {resumoBlocos.ocorrenciasPrimeiroMes} reservas
                            </>
                          ) : (
                            <>
                              Nenhuma ocorrência cabe até o fim do mês. As reservas e a
                              cobrança começam no mês que vem.
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── ALERTA DE CONFLITOS ── */}
              {conflicts.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm font-black text-red-700">
                      {conflicts.length === 1
                        ? 'Conflito de horário encontrado'
                        : `${conflicts.length} conflitos de horário encontrados`}
                    </p>
                  </div>
                  <p className="text-xs text-red-600 font-medium">
                    Os horários abaixo já estão ocupados. Altere o horário ou
                    data antes de prosseguir.
                  </p>
                  <div className="space-y-2">
                    {conflicts.map((c, i) => (
                      <div
                        key={i}
                        className="bg-white border border-red-100 rounded-xl px-3 py-2.5 flex items-start gap-2"
                      >
                        <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[9px] font-black text-red-500">
                            {i + 1}
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-red-700 uppercase tracking-wider">
                            {c.proposedDate}
                          </p>
                          <p className="text-xs text-red-600 font-medium">
                            Ocupado por{' '}
                            <span className="font-black">{c.athleteName}</span>{' '}
                            ({c.startTime}–{c.endTime})
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-center sm:gap-4 sm:px-10 sm:py-5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 w-full rounded-xl border-arena-navy-800/25 font-semibold text-arena-navy-800 hover:bg-slate-50 sm:w-auto sm:min-w-[200px]"
            >
              Fechar
            </Button>
            <Button
              type="button"
              onClick={handlePreSave}
              disabled={isSaving || isCheckingConflicts}
              className="h-11 w-full rounded-xl bg-arena-button font-semibold text-white shadow-sm hover:bg-arena-button-hover disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
            >
              {isSaving || isCheckingConflicts ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  {isCheckingConflicts ? 'Verificando…' : 'Salvando…'}
                </span>
              ) : existingBooking ? (
                'Salvar alterações'
              ) : bookingType === 'avulso' ? (
                'Salvar'
              ) : (
                'Criar Plano'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AthleteRegistrationModal
        arenaId={arenaId}
        open={isAthleteModalOpen}
        onOpenChange={setIsAthleteModalOpen}
        onSuccess={handleAthleteRegistered}
      />
    </>
  );
}
