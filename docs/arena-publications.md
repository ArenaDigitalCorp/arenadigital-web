# Publicações no painel da arena

Donos e gestores acessam **Publicações** diretamente no menu principal. A arena ativa no seletor define a autoria. Trocar para outra arena gerenciada mantém a seção; selecionar uma arena onde o usuário não tem gestão volta ao dashboard e não concede permissão de publicação.

A rota `/dashboard/publications/[arenaId]` usa o mesmo editor completo do admin: comunicado, promoção, publicidade e novidade, título, descrição, imagem, período, modalidade, botão de ação, prévia e histórico. Salvar e publicar são ações separadas.

A autoria depende da área acessada. No painel da arena, inclusive uma conta que também administra a plataforma atua como dono ou gestor da arena selecionada. O vínculo precisa ser explícito: ser administrador da plataforma não permite publicar por qualquer arena. Na área admin, a autoria é sempre Arena Digital; as publicações das arenas ficam disponíveis para consulta e moderação (pausar, bloquear e desbloquear).

As ações e o upload enviam o contexto `arena` ou `platform`, que é validado no servidor. A RPC `can_author_home_publication(uuid)` verifica dono ou gestor ativo sem o bypass administrativo de `can_manage_arena`. A nova assinatura de seis argumentos de `manage_home_publication` valida novamente o contexto e os vínculos no banco. A assinatura anterior, de cinco argumentos, permanece compatível e mantém suas restrições.

Os endereços anteriores `/dashboard/arenas/[id]/publications` e `/dashboard/arenas/[id]/mobile-content` encaminham à nova tela. O endereço `/dashboard/arenas/[id]/mobile-content/scheduling` também redireciona para Publicações. Horário disponível e Jogo aberto são tipos do mesmo editor, exclusivos da arena, e aparecem na mesma listagem e busca. Seus dados continuam em `arena_promotions` e `open_games`, preservando as integrações de reservas e participação do app. Horários permitem editar, publicar e retirar do ar; jogos permitem editar e cancelar com confirmação, sem cancelar a reserva. A edição de jogo preserva no banco inscrições, reserva vinculada, visibilidade, situação e níveis.

Deploy: aplicar primeiro a migration `20261108210000_home_publication_context.sql` do repositório `arenadigital-db`, depois publicar a web. Promover cada repositório por `main` → `homolog`; produção depende de validação posterior.
