import * as z from 'zod'
import { DEFAULT_AGENT_MODEL } from '../types/agent.types'

/** Validação do formulário de configuração do agente (setup do gestor). */
export const agentConfigSchema = z.object({
  personaPrompt: z
    .string()
    .max(4000, 'A personalidade deve ter no máximo 4000 caracteres.')
    .optional()
    .nullable(),
  model: z.string().min(1).default(DEFAULT_AGENT_MODEL),
  temperature: z.number().min(0).max(2).default(0.3),
  maxOutputTokens: z.number().int().min(50).max(2000).default(500),
  monthlyTokenCap: z.number().int().positive().max(2_147_483_647, 'O teto mensal de tokens deve ser no máximo 2.147.483.647.').nullable().optional(),
  fallbackMessage: z
    .string()
    .max(1000, 'A mensagem de fallback deve ter no máximo 1000 caracteres.')
    .optional()
    .nullable(),
})

export type AgentConfigFormValues = z.infer<typeof agentConfigSchema>

/** Validação do payload de conexão de um número via Embedded Signup. */
export const connectChannelSchema = z.object({
  arenaId: z.string().uuid(),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  displayPhoneNumber: z.string().nullable().optional(),
  verifiedName: z.string().nullable().optional(),
  accessToken: z.string().min(1),
  tokenExpiresAt: z.string().nullable().optional(),
})

export type ConnectChannelValues = z.infer<typeof connectChannelSchema>
