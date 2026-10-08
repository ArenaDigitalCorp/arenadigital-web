/**
 * Erros das RPCs de turma para a tela.
 *
 * As mensagens do banco são escritas sem acento (padrão das migrations). Aqui
 * elas ganham a grafia correta para o gestor; a regra continua sendo do banco.
 * A sobreposição de horário (SQLSTATE 23P01) vira um resultado próprio, porque
 * a tela pede confirmação e reenvia.
 */

export interface ErroRpc {
  message: string
  code?: string
  details?: string | null
}

export type ResultadoErroTurma =
  | { tipo: 'sobreposicao'; turmas: string[]; mensagem: string }
  | { tipo: 'erro'; mensagem: string }

const FRASES: [RegExp, string][] = [
  [/\be usada\b/g, 'é usada'],
  [/\be de outra pessoa\b/g, 'é de outra pessoa'],
  [/\bnao esta\b/g, 'não está'],
  [/\bja esta\b/g, 'já está'],
  [/\b1o dia\b/g, '1º dia'],
  // Nas mensagens de turma, "anterior/posterior a" sempre precede palavra feminina
  // (entrada, saída, criação, última).
  [/\b(anterior|posterior) a (?=[a-z])/g, '$1 à '],
]

const PALAVRAS = new Map<string, string>(Object.entries({
  nao: 'não',
  Nao: 'Não',
  ja: 'já',
  ate: 'até',
  tambem: 'também',
  Horario: 'Horário',
  horario: 'horário',
  horarios: 'horários',
  recorrencia: 'recorrência',
  Recorrencia: 'Recorrência',
  criacao: 'criação',
  Nivel: 'Nível',
  nivel: 'nível',
  invalido: 'inválido',
  invalida: 'inválida',
  responsavel: 'responsável',
  saida: 'saída',
  ultima: 'última',
  comecar: 'começar',
  Codigo: 'Código',
  Usuario: 'Usuário',
  obrigatorios: 'obrigatórios',
  obrigatoria: 'obrigatória',
  obrigatorias: 'obrigatórias',
  Vinculo: 'Vínculo',
  vinculo: 'vínculo',
  Operacao: 'Operação',
  sobreposicao: 'sobreposição',
  indisponivel: 'indisponível',
  mes: 'mês',
}))

export function corrigirAcentos(mensagem: string): string {
  let texto = mensagem
  for (const [padrao, troca] of FRASES) texto = texto.replace(padrao, troca)
  return texto.replace(/[A-Za-z]+/g, (palavra) => PALAVRAS.get(palavra) ?? palavra)
}

export function traduzirErroTurma(erro: ErroRpc | null | undefined): ResultadoErroTurma {
  if (!erro) return { tipo: 'erro', mensagem: 'Não foi possível concluir. Tente novamente.' }

  if (erro.code === '23P01') {
    const turmas = (erro.details ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    return {
      tipo: 'sobreposicao',
      turmas,
      mensagem: `Horário sobreposto com ${turmas.length ? turmas.join(', ') : 'outra turma'}.`,
    }
  }

  const texto = (erro.message ?? '').trim()
  return { tipo: 'erro', mensagem: texto ? corrigirAcentos(texto) : 'Não foi possível concluir. Tente novamente.' }
}
