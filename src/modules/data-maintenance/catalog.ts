export const CLEANUP_MODULES = [
  {
    "id": "manual_transactions",
    "group": "Financeiro",
    "label": "Lançamentos manuais",
    "description": "Entradas e saídas manuais, sem remover os lançamentos de origem automática."
  },
  {
    "id": "financial_transactions",
    "group": "Financeiro",
    "label": "Todos os lançamentos locais",
    "description": "Inclui lançamentos de reservas, mensalistas, comandas e rotativos. Cobranças externas permanecem protegidas."
  },
  {
    "id": "cash_sessions",
    "group": "Financeiro",
    "label": "Caixas completos",
    "description": "Aberturas, fechamentos e seus demonstrativos. Exige selecionar todos os lançamentos vinculados."
  },
  {
    "id": "transaction_categories",
    "group": "Financeiro",
    "label": "Categorias financeiras",
    "description": "Categorias personalizadas de entradas e saídas."
  },
  {
    "id": "bookings",
    "group": "Reservas e agenda",
    "label": "Reservas",
    "description": "Reservas, participantes, serviços e grupos do app com suas regras de cancelamento. Pagamentos do provedor e checkouts em andamento permanecem protegidos."
  },
  {
    "id": "booking_requests",
    "group": "Reservas e agenda",
    "label": "Solicitações de reserva",
    "description": "Pedidos pelo app, grupos e participantes das solicitações."
  },
  {
    "id": "booking_results",
    "group": "Reservas e agenda",
    "label": "Resultados de partidas",
    "description": "Placares, jogadores e confirmações de resultados da arena."
  },
  {
    "id": "monthly_plans",
    "group": "Mensalistas e turmas",
    "label": "Planos de mensalistas",
    "description": "Recorrências, blocos, pausas e histórico de reajustes dos planos."
  },
  {
    "id": "monthly_billing",
    "group": "Mensalistas e turmas",
    "label": "Mensalidades e pagamentos",
    "description": "Competências, rateios, cobranças e pagamentos locais de mensalistas."
  },
  {
    "id": "monthly_credits",
    "group": "Mensalistas e turmas",
    "label": "Créditos de mensalistas",
    "description": "Saldos e movimentos de crédito da arena. A restauração recupera os valores originais."
  },
  {
    "id": "classes",
    "group": "Mensalistas e turmas",
    "label": "Turmas",
    "description": "Turmas, horários, níveis e seus alunos."
  },
  {
    "id": "booking_billing",
    "group": "Financeiro",
    "label": "Cobranças locais de reservas",
    "description": "Rateios e pagamentos registrados no painel. Não remove o histórico de pagamentos do Asaas."
  },
  {
    "id": "station_orders",
    "group": "Comandas e atendimento",
    "label": "Comandas",
    "description": "Comandas, itens, pagamentos e histórico de situação."
  },
  {
    "id": "station_customers",
    "group": "Comandas e atendimento",
    "label": "Clientes de balcão",
    "description": "Cadastros de clientes de comandas exclusivos desta arena."
  },
  {
    "id": "stations",
    "group": "Comandas e atendimento",
    "label": "Estações e pontos de venda",
    "description": "Cadastros de estações. Comandas e produtos vinculados precisam ser tratados na mesma seleção."
  },
  {
    "id": "rotations",
    "group": "Rotativos",
    "label": "Eventos e inscrições",
    "description": "Rotativos, quadras do evento e inscrições dos atletas."
  },
  {
    "id": "rotation_credits",
    "group": "Rotativos",
    "label": "Créditos de rotativos",
    "description": "Lotes, saldos e movimentos de créditos para inscrições."
  },
  {
    "id": "rotation_packages",
    "group": "Rotativos",
    "label": "Pacotes de rotativos",
    "description": "Pacotes e valores de compra de créditos oferecidos pela arena."
  },
  {
    "id": "athlete_links",
    "group": "Pessoas",
    "label": "Atletas da arena",
    "description": "Remove os vínculos, os perfis da arena e suas matrículas em turmas. Mantém a conta do atleta e seus dados em outras arenas."
  },
  {
    "id": "arena_users",
    "group": "Pessoas",
    "label": "Usuários e equipe da arena",
    "description": "Remove os acessos de colaboradores desta arena. O proprietário e as contas globais permanecem."
  },
  {
    "id": "athlete_favorites",
    "group": "Pessoas",
    "label": "Favoritos desta arena",
    "description": "Remove esta arena da lista de favoritos dos atletas, sem alterar outros favoritos."
  },
  {
    "id": "products",
    "group": "Catálogo e estoque",
    "label": "Produtos e serviços",
    "description": "Itens vendidos pela arena. Estoque, histórico e comandas vinculados são conferidos na prévia."
  },
  {
    "id": "product_categories",
    "group": "Catálogo e estoque",
    "label": "Categorias de produtos",
    "description": "Categorias personalizadas de produtos e serviços."
  },
  {
    "id": "inventory",
    "group": "Catálogo e estoque",
    "label": "Estoque e movimentações",
    "description": "Zera os saldos dos produtos preservados e remove entradas e movimentos de estoque selecionados."
  },
  {
    "id": "price_history",
    "group": "Catálogo e estoque",
    "label": "Histórico de preços",
    "description": "Reajustes em lote e histórico de preços dos produtos, preservando o preço atual dos itens mantidos."
  },
  {
    "id": "courts",
    "group": "Estrutura e regras",
    "label": "Quadras e espaços",
    "description": "Cadastros de quadras e suas modalidades. Reservas e outros vínculos impedem exclusões isoladas."
  },
  {
    "id": "court_prices",
    "group": "Estrutura e regras",
    "label": "Tabelas de preços",
    "description": "Tabelas, dias e faixas de horários de cobrança das quadras."
  },
  {
    "id": "arena_sports",
    "group": "Estrutura e regras",
    "label": "Modalidades da arena",
    "description": "Modalidades oferecidas pela empresa. Não apaga o catálogo global de esportes."
  },
  {
    "id": "arena_amenities",
    "group": "Estrutura e regras",
    "label": "Comodidades da arena",
    "description": "Vínculos de comodidades desta empresa, mantendo o catálogo global."
  },
  {
    "id": "cancellation_drafts",
    "group": "Estrutura e regras",
    "label": "Rascunhos de cancelamento",
    "description": "Rascunhos e suas faixas. Políticas publicadas e já aceitas permanecem protegidas."
  },
  {
    "id": "loyalty",
    "group": "Relacionamento e conteúdo",
    "label": "Fidelidade",
    "description": "Extrato, créditos, débitos e saldos do programa da arena."
  },
  {
    "id": "open_games",
    "group": "Relacionamento e conteúdo",
    "label": "GameMatch da arena",
    "description": "Jogos abertos e solicitações de participação vinculados à arena. Times globais são mantidos."
  },
  {
    "id": "arena_content",
    "group": "Relacionamento e conteúdo",
    "label": "Conteúdo e promoções",
    "description": "Destaques manuais e publicações de horários e promoções. Arquivos e banner da empresa são mantidos."
  },
  {
    "id": "arena_notifications",
    "group": "Relacionamento e conteúdo",
    "label": "Notificações do painel",
    "description": "Avisos internos da arena. Não apaga a caixa de notificações pessoal do atleta."
  },
  {
    "id": "message_templates",
    "group": "Comunicação",
    "label": "Modelos de mensagens",
    "description": "Modelos e textos personalizados de comunicação da arena."
  },
  {
    "id": "whatsapp_history",
    "group": "Comunicação",
    "label": "Conversas do WhatsApp",
    "description": "Conversas e mensagens salvas nesta arena. A conexão, as credenciais e os registros de entrega do provedor são mantidos."
  },
  {
    "id": "ai_agent",
    "group": "Comunicação",
    "label": "Configuração do atendimento",
    "description": "Configuração do agente de atendimento desta arena. Não altera integrações ou credenciais."
  }
] as const

export type CleanupModule = typeof CLEANUP_MODULES[number]['id']
export const CLEANUP_MODULE_IDS = CLEANUP_MODULES.map(item => item.id) as [CleanupModule, ...CleanupModule[]]
export const CLEANUP_GROUPS = [...new Set(CLEANUP_MODULES.map(item => item.group))]
export const cleanupModuleLabel = (id: string) => CLEANUP_MODULES.find(item => item.id === id)?.label ?? id
