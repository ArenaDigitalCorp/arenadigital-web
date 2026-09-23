/**
 * Catálogo de variáveis que o gestor pode inserir no corpo do template.
 * Resolvidas pela aplicação no envio (perfil do atleta, relatório de
 * mensalista, dados de pagamento da Arena) — não são um dado armazenado no
 * banco. Novas variáveis entram aqui conforme os pontos de disparo forem
 * definidos.
 *
 * `category` também marca o pré-requisito de resolução: variáveis
 * "Mensalista" só resolvem para um atleta com plano ativo no mês filtrado;
 * "Arena" com nota "(Asaas)" só resolvem se a Arena tiver concluído o
 * cadastro de pagamentos.
 */
export type MessageTemplateVariableCategory = "Atleta" | "Mensalista" | "Arena" | "Contexto"

export interface MessageTemplateVariable {
  token: string
  label: string
  description: string
  category: MessageTemplateVariableCategory
}

export const MESSAGE_TEMPLATE_VARIABLES: MessageTemplateVariable[] = [
  {
    token: "##ATLETA_NOME_COMPLETO##",
    label: "Nome completo do atleta",
    description: "Nome completo cadastrado do atleta em questão.",
    category: "Atleta",
  },
  {
    token: "##ATLETA_PRIMEIRO_NOME##",
    label: "Primeiro nome do atleta",
    description: "Apenas o primeiro nome do atleta em questão.",
    category: "Atleta",
  },
  {
    token: "##MES_REFERENCIA##",
    label: "Mês de referência",
    description: "Mês filtrado na tela de origem, por extenso (ex.: \"setembro\").",
    category: "Contexto",
  },
  {
    token: "##VALOR_DEVIDO_MES_CORRENTE##",
    label: "Valor devido no mês corrente",
    description:
      "Valor em aberto do atleta no mês filtrado, em máscara monetária (mesma fonte do Relatório de Mensalistas). Já desconta pagamento parcial e crédito aplicado.",
    category: "Mensalista",
  },
  {
    token: "##VALOR_CREDITO_ATUAL##",
    label: "Crédito atual do atleta",
    description:
      "Saldo de crédito que o atleta possui atualmente, o mesmo valor exibido no menu de Mensalista.",
    category: "Mensalista",
  },
  {
    token: "##MENSALISTA_RECORRENCIA##",
    label: "Dias e horários da recorrência",
    description:
      "Dia(s) da semana e horário(s) do plano do atleta (ex.: \"Terças às 18h e 19h\"). Junta todos os blocos quando o plano tiver mais de um.",
    category: "Mensalista",
  },
  {
    token: "##MENSALISTA_TOTAL_HORAS_MES##",
    label: "Total de horas no mês",
    description:
      "Soma das horas ocupadas pela recorrência no mês filtrado, sem contar sessões canceladas.",
    category: "Mensalista",
  },
  {
    token: "##MENSALISTA_VALOR_HORA##",
    label: "Valor da hora da quadra",
    description: "Valor da hora vigente para o plano, pela tabela de preço do tipo Mensalista.",
    category: "Mensalista",
  },
  {
    token: "##MENSALISTA_VALOR_MENSALIDADE##",
    label: "Valor total da mensalidade",
    description:
      "Valor cheio da mensalidade do mês filtrado, antes de qualquer pagamento — diferente do valor devido, que já desconta o que foi pago.",
    category: "Mensalista",
  },
  {
    token: "##MENSALISTA_DATA_VENCIMENTO##",
    label: "Data de vencimento do mês",
    description: "Data limite de pagamento da mensalidade do mês filtrado.",
    category: "Mensalista",
  },
  {
    token: "##ARENA_ANTECEDENCIA_CANCELAMENTO##",
    label: "Antecedência para cancelamento",
    description:
      "Horas de antecedência exigidas pela política de cancelamento vigente da Arena para reembolso de 100%. Fica vazio se a Arena não tiver essa faixa configurada.",
    category: "Arena",
  },
  {
    token: "##ARENA_CHAVE_PIX##",
    label: "Chave Pix da Arena (Asaas)",
    description:
      "Chave Pix da conta de recebimento da Arena. Só resolve se o cadastro de pagamentos (Asaas) estiver concluído.",
    category: "Arena",
  },
  {
    token: "##ARENA_TITULAR_PIX##",
    label: "Titular da conta Pix (Asaas)",
    description:
      "Nome do titular da conta de recebimento da Arena. Só resolve se o cadastro de pagamentos (Asaas) estiver concluído.",
    category: "Arena",
  },
  {
    token: "##ARENA_CNPJ##",
    label: "CNPJ/CPF da Arena",
    description: "Documento (CPF ou CNPJ) cadastrado no perfil da Arena.",
    category: "Arena",
  },
]
