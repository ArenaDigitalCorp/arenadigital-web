/** Valores aceitos pela constraint stations_status_check (arenadigital-db). */
export const STATION_STATUSES = ['ativo', 'Em manutenção', 'inativo'] as const;

export type StationStatus = (typeof STATION_STATUSES)[number];

const LABELS: Record<StationStatus, string> = {
  ativo: 'Ativo',
  'Em manutenção': 'Em manutenção',
  inativo: 'Desativado',
};

export const STATION_STATUS_OPTIONS = STATION_STATUSES.map((value) => ({ value, label: LABELS[value] }));

export function isStationStatus(value: unknown): value is StationStatus {
  return typeof value === 'string' && (STATION_STATUSES as readonly string[]).includes(value);
}

export function stationStatusLabel(status: string | null | undefined): string {
  return isStationStatus(status) ? LABELS[status] : status ?? LABELS.ativo;
}
