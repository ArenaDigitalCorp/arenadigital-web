'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn, normalizeString } from '@/lib/utils';
import { getAthletesByArenaAction } from '@/modules/athletes/actions/athleteActions';
import { listPerfisAtletaAction } from '@/modules/athletes/actions/perfilActions';
import {
  PERFIL_LABEL,
  PERFIS_ATLETA,
  type PerfilAtleta,
} from '@/modules/athletes/types/perfil.types';
import { AthletesTable, type Athlete } from './AthletesTable';
import { tutorialAthletes } from '@/lib/tutorial-mock-data';

interface AthletesListProps {
  arenaId: string | null;
  tutorial?: boolean;
}

export function AthletesList({ arenaId, tutorial = false }: AthletesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [perfis, setPerfis] = useState<Record<string, PerfilAtleta>>({});
  const [perfilFiltro, setPerfilFiltro] = useState<PerfilAtleta | 'todos'>('todos');
  const [isLoading, setIsLoading] = useState(false);

  const loadAthletes = useCallback(async () => {
    if (!arenaId) return;
    if (tutorial) {
      setAthletes(tutorialAthletes);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [res, perfisRes] = await Promise.all([
        getAthletesByArenaAction(arenaId),
        listPerfisAtletaAction(arenaId),
      ]);
      setAthletes(res.data as Athlete[]);
      // Perfil indisponível não impede a lista de aparecer — a coluna mostra "—".
      setPerfis(perfisRes.success && perfisRes.data ? perfisRes.data : {});
    } catch (error) {
      console.error('Error loading athletes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [arenaId, tutorial]);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);

  const perfisDisponiveis = Object.keys(perfis).length > 0;

  const filteredAthletes = useMemo(() => {
    const q = normalizeString(searchTerm.trim());
    return athletes.filter((a) => {
      if (q && !normalizeString(a.name).includes(q)) return false;
      if (perfilFiltro === 'todos' || !perfisDisponiveis) return true;
      return (perfis[a.id] ?? 'padrao') === perfilFiltro;
    });
  }, [athletes, searchTerm, perfilFiltro, perfis, perfisDisponiveis]);

  /**
   * Os perfis podem não estar disponíveis (migração pendente no ambiente). Nesse
   * caso o filtro não pode contar todo mundo como "Cliente padrão" — seria
   * afirmar algo que não se sabe. Some, e a coluna mostra "—".
   */
  /** Quantos atletas em cada perfil — o contador evita filtrar para o vazio. */
  const contagem = useMemo(() => {
    const base: Record<string, number> = { todos: athletes.length };
    for (const perfil of PERFIS_ATLETA) base[perfil] = 0;
    for (const a of athletes) base[perfis[a.id] ?? 'padrao'] += 1;
    return base;
  }, [athletes, perfis]);

  if (!arenaId) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Carregando dados da arena...
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card className="rounded-lg border border-slate-100 bg-white px-6 py-6 shadow-sm">
        <div className="mb-8 flex flex-col items-start gap-3">
          <h3 className="font-heading text-xl font-bold text-arena-navy-800">
            Atletas vinculados
          </h3>
          <div className="flex w-full flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Input
                placeholder="Buscar por atleta"
                className="h-10 w-full rounded-md border-slate-300 pl-3 pr-10 text-sm text-arena-navy-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#20B2AA]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <div className={cn('flex flex-wrap items-center gap-1.5', !perfisDisponiveis && 'hidden')}>
              {(['todos', ...PERFIS_ATLETA] as const).map((opcao) => {
                const ativo = perfilFiltro === opcao;
                return (
                  <button
                    key={opcao}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setPerfilFiltro(opcao)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                      ativo
                        ? 'border-arena-navy-800 bg-arena-navy-800 text-white'
                        : 'border-slate-200 text-arena-navy-800/60 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {opcao === 'todos' ? 'Todos' : PERFIL_LABEL[opcao]}
                    <span className={cn('ml-1.5', ativo ? 'text-white/60' : 'text-arena-navy-800/35')}>
                      {contagem[opcao] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <AthletesTable
          athletes={filteredAthletes}
          isLoading={isLoading}
          arenaId={arenaId}
          perfis={perfis}
        />
      </Card>
    </TooltipProvider>
  );
}
