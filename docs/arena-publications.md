# Publicações no painel da arena

Donos e gestores acessam **Publicações** diretamente no menu principal. A arena ativa no seletor define a autoria. Trocar para outra arena gerenciada mantém a seção; selecionar uma arena onde o usuário não tem gestão volta ao dashboard e não concede permissão de publicação.

A rota `/dashboard/publications/[arenaId]` usa o mesmo editor completo do admin: comunicado, promoção, publicidade e novidade, título, descrição, imagem, período, modalidade, botão de ação, prévia e histórico. Salvar e publicar são ações separadas. A plataforma continua publicando somente como Arena Digital e moderando conteúdos das arenas.

Os endereços anteriores `/dashboard/arenas/[id]/publications` e `/dashboard/arenas/[id]/mobile-content` encaminham à nova tela. A ferramenta de horários e jogos permanece em `/dashboard/arenas/[id]/mobile-content/scheduling`, com acesso secundário identificado na tela de publicações e retorno explícito. Não há mudança no contrato de banco.
