export type AccessBaseRole = 'Gestor' | 'Atendente' | 'Caixa'

export type AccessProfile = {
  id: string
  name: string
  base_role: AccessBaseRole
  resources: string[]
  member_count: number
  is_default: boolean
  version: number
}

export type AccessMember = {
  id: string
  user_id: string
  name: string | null
  email: string
  status: string
  role: AccessBaseRole
  profile_id: string
  profile_name: string
  station_id: string | null
}

export type AuditState = Record<string, unknown>

export type AccessManagement = {
  resources: { key: string; label: string; group_name: string }[]
  profiles: AccessProfile[]
  members: AccessMember[]
  history: {
    id: string | number
    created_at: string
    actor_id: string | null
    actor_name: string | null
    event: string
    before_state: AuditState | null
    after_state: AuditState | null
  }[]
}

export type ProfileInput = {
  id: string | null
  name: string
  baseRole: AccessBaseRole
  resources: string[]
  version: number | null
}
