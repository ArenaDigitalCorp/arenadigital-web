import type { Database } from './supabase.types'

type PublicFunctions = Database['public']['Functions']
type NullableArgs<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | null
}

type AdminFunctionOverrides = {
  provision_arena_athlete_profile: Omit<
    PublicFunctions['provision_arena_athlete_profile'],
    'Args'
  > & {
    Args: NullableArgs<
      PublicFunctions['provision_arena_athlete_profile']['Args'],
      | 'p_address'
      | 'p_address_number'
      | 'p_birth_date'
      | 'p_cep'
      | 'p_city_id'
      | 'p_level_id'
      | 'p_neighborhood'
    >
  }
  update_backoffice_booking: Omit<
    PublicFunctions['update_backoffice_booking'],
    'Args'
  > & {
    Args: NullableArgs<
      PublicFunctions['update_backoffice_booking']['Args'],
      'p_athlete_id' | 'p_price' | 'p_sport_id'
    >
  }
}

export type SupabaseAdminDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Omit<PublicFunctions, keyof AdminFunctionOverrides> &
      AdminFunctionOverrides
  }
}
