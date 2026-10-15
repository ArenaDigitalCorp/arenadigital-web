'use client';

import { formatPhone } from '@/lib/brasil-document'
import { useRef, useState } from 'react';
import { Search, X, Loader2, UserPlus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn, normalizeString } from '@/lib/utils';
import { searchAthletesAction } from '@/modules/loyalty/actions/loyaltyActions';

export interface BookingAthleteOption {
  id: string;
  nome_perfil: string;
  telefone: string;
}

interface BookingParticipantsFieldProps {
  arenaId: string;
  participants: BookingAthleteOption[];
  excludeAthleteId?: string | null;
  onChange: (participants: BookingAthleteOption[]) => void;
  onRegisterNew?: () => void;
  disabled?: boolean;
}

export function BookingParticipantsField({
  arenaId,
  participants,
  excludeAthleteId,
  onChange,
  onRegisterNew,
  disabled = false,
}: BookingParticipantsFieldProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<BookingAthleteOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const participantIds = new Set(participants.map((p) => p.id));

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const result = await searchAthletesAction(arenaId);
        if (result.success && result.data) {
          const normalizedSearch = normalizeString(value);
          const filtered = (result.data as BookingAthleteOption[]).filter(
            (a) =>
              a &&
              a.id !== excludeAthleteId &&
              !participantIds.has(a.id) &&
              normalizeString(a.nome_perfil).includes(normalizedSearch)
          );
          setResults(filtered);
        }
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const addParticipant = (athlete: BookingAthleteOption) => {
    if (athlete.id === excludeAthleteId || participantIds.has(athlete.id)) return;
    onChange([...participants, athlete]);
    setSearch('');
    setResults([]);
  };

  const removeParticipant = (id: string) => {
    onChange(participants.filter((p) => p.id !== id));
  };

  const showDropdown = search.length >= 2 && !disabled;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">
          Participantes adicionais
        </Label>
        <p className="mt-1 text-[11px] font-medium text-arena-navy-800/45">
          Vincule outros atletas à mesma reserva (opcional)
        </p>
      </div>

      {participants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <div
              key={p.id}
              className="inline-flex items-center gap-2 rounded-full border border-[#FFE4D3] bg-[#FFF5EF] px-3 py-1.5"
            >
              <span className="text-xs font-bold text-arena-navy-800">{p.nome_perfil}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeParticipant(p.id)}
                className="text-red-500 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remover ${p.nome_perfil}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/20" />
        <Input
          placeholder="Buscar atleta para adicionar"
          value={search}
          disabled={disabled}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-12 rounded-xl border-arena-navy-800/10 pl-12 font-semibold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button"
        />
        {isSearching && (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-arena-button" />
        )}
        {showDropdown && (results.length > 0 || (!isSearching && onRegisterNew)) && (
          <div className="absolute z-50 mt-2 max-h-44 w-full overflow-auto rounded-2xl border border-arena-navy-800/10 bg-white p-2 shadow-2xl">
            {results.map((athlete) => (
              <button
                key={athlete.id}
                type="button"
                onClick={() => addParticipant(athlete)}
                className="mb-1 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors last:mb-0 hover:bg-[#FFF5EF]"
              >
                <div>
                  <p className="text-sm font-bold text-arena-navy-800">{athlete.nome_perfil}</p>
                  <p className="text-[10px] font-black uppercase tracking-tight text-arena-navy-800/40">
                    {formatPhone(athlete.telefone)}
                  </p>
                </div>
              </button>
            ))}
            {results.length === 0 && !isSearching && onRegisterNew && (
              <button
                type="button"
                onClick={onRegisterNew}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-[#FFF5EF]'
                )}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-arena-button/10">
                  <UserPlus className="h-4 w-4 text-arena-button" />
                </div>
                <div>
                  <p className="text-sm font-bold text-arena-button">
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
    </div>
  );
}
