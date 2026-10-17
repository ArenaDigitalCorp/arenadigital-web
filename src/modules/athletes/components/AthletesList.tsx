'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAthletePage } from '@/modules/athletes/hooks/useAthletePage';
import { PERFIL_LABEL, PERFIS_ATLETA } from '@/modules/athletes/types/perfil.types';
import type { AthletePageQuery } from '@/modules/athletes/types/list-page.types';
import { AthletesTable } from './AthletesTable';

interface AthletesListProps {
  arenaId: string | null;
  tutorial?: boolean;
}

export function AthletesList(props: AthletesListProps) {
  return <AthletesListForArena key={props.arenaId ?? 'pending'} {...props} />;
}

function AthletesListForArena({ arenaId, tutorial = false }: AthletesListProps) {
  const [query, setQuery] = useState<AthletePageQuery>({
    page: 1, pageSize: 25, search: '', profile: 'todos',
    sort: { column: 'name', direction: 'asc' },
  });
  const result = useAthletePage(arenaId, tutorial, query);
  const recoveringProfiles = result.data?.profilesAvailable === false
    && (query.profile !== 'todos' || query.sort.column === 'perfil');
  // Adjust this component's query before rendering a response without profiles.
  // Both unsupported fields are cleared, so the next render settles immediately.
  if (recoveringProfiles) {
    setQuery({
      ...query, page: 1, profile: 'todos',
      sort: query.sort.column === 'perfil' ? { column: 'name', direction: query.sort.direction } : query.sort,
    });
  }
  const isLoading = result.isLoading || recoveringProfiles;
  const data = recoveringProfiles ? undefined : result.data;
  const athletes = data?.items ?? [];
  const profilesAvailable = data?.profilesAvailable !== false;
  const perfis = Object.fromEntries(athletes.flatMap(athlete =>
    profilesAvailable && athlete.perfil ? [[athlete.id, athlete.perfil]] : []));

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
                aria-label="Buscar por atleta"
                maxLength={120}
                value={query.search}
                onChange={(e) => setQuery(current => ({ ...current, search: e.target.value, page: 1 }))}
              />
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {profilesAvailable && <div className="flex flex-wrap items-center gap-1.5">
              {(['todos', ...PERFIS_ATLETA] as const).map((opcao) => {
                const ativo = query.profile === opcao;
                return (
                  <button
                    key={opcao}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setQuery(current => ({ ...current, profile: opcao, page: 1 }))}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                      ativo
                        ? 'border-arena-navy-800 bg-arena-navy-800 text-white'
                        : 'border-slate-200 text-arena-navy-800/60 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {opcao === 'todos' ? 'Todos' : PERFIL_LABEL[opcao]}
                    <span className={cn('ml-1.5', ativo ? 'text-white/60' : 'text-arena-navy-800/35')}>
                      {data?.counts[opcao] ?? '—'}
                    </span>
                  </button>
                );
              })}
            </div>}
          </div>
          {!profilesAvailable && (
            <p role="status" className="text-xs text-arena-navy-800/60">
              Perfis temporariamente indisponíveis. Os atletas continuam listados.{' '}
              <button type="button" className="underline" onClick={result.retry}>
                Tentar carregar os perfis novamente
              </button>
            </p>
          )}
        </div>

        {result.isRefreshing && !isLoading && (
          <p role="status" className="mb-2 text-xs text-arena-navy-800/60">Atualizando atletas...</p>
        )}
        <AthletesTable
          athletes={athletes}
          isLoading={isLoading}
          arenaId={arenaId}
          perfis={perfis}
          profilesAvailable={profilesAvailable}
          error={result.error}
          onRetry={result.retry}
          page={data?.page ?? query.page}
          pageSize={query.pageSize}
          total={data?.total ?? 0}
          onPageChange={page => setQuery(current => ({ ...current, page }))}
          onPageSizeChange={pageSize => setQuery(current => ({ ...current, pageSize, page: 1 }))}
          sort={query.sort}
          onSortChange={sort => setQuery(current => ({ ...current, sort, page: 1 }))}
        />
      </Card>
    </TooltipProvider>
  );
}
