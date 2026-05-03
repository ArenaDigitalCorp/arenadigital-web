export interface Sport {
  id: string;
  name: string;
}

export interface Comodidade {
  id: string;
  name: string;
}

export interface Arena {
  id: string;
  name: string;
  owner_id: string;
  status: 'active' | 'inactive' | 'maintenance';
  address?: Record<string, unknown>;
  phone?: string;
  email?: string;
  opening_hours?: Record<string, unknown>;
  description?: string;
  banner_url?: string;
  zip_code?: string;
  number?: string;
  complement?: string;
  id_municipio?: number;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  nome_moeda_virtual?: string;
  neighborhood?: string;
  cpf_cnpj?: string | null;
  location?: Record<string, unknown>;
  created_at: string;
  // Populated by joins
  sports?: Sport[];
  comodidades?: Comodidade[];
}

export type CreateArenaDTO = Omit<Arena, 'id' | 'created_at' | 'sports' | 'comodidades'> & {
  sports?: string[];       // Sport IDs
  comodidades?: string[];  // Comodidade IDs
};

export type UpdateArenaDTO = Partial<CreateArenaDTO>;
