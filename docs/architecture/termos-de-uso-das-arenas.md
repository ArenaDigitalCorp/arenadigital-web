# Aceite dos Termos de Uso pelas arenas

A mudança de 20 de novembro de 2026 afeta quem representa uma arena. A licença cobre a apresentação das marcas e das fotos do perfil e de seus espaços no site e no aplicativo, pelo período em que estiverem publicados. O texto distingue os direitos do fotógrafo, da marca e das pessoas retratadas. O titular pode retirar imagens ou pedir a retirada pelo contato@arenadigital.app. A autorização vale do aceite em diante. O acervo de fichas importadas continua dependendo da procedência e das autorizações de cada imagem.

## Como comunicar

Antes de concluir o cadastro ou reivindicar uma arena, o responsável lê uma declaração desmarcada com link direto para a versão integral. Uma reivindicação pendente só gera o comprovante da arena depois que o sistema confirma a titularidade. Um convite de operador, o simples login e o uso continuado do painel não autorizam imagens em nome da arena.

O titular de uma arena existente vê no painel um aviso específico da arena selecionada. Pode consultar o resumo, abrir o texto completo, confirmar ou adiar. A área do perfil reúne os comprovantes com as versões que o titular aceitou. Na tela de assinatura, o titular também pode revisar os termos e consultar o comprovante, mesmo quando o plano expirou. Enquanto houver uma pendência, a equipe continua atendendo, pode remover material e pode pedir ajuda. A publicação ou substituição de imagens do perfil e das quadras exige o aceite do titular da arena. Para esta mudança, o canal de notificação é o próprio painel.

Adotamos um aviso contextual e um arquivo público de versões. O GitHub prevê comunicação das mudanças materiais e o Google mantém um arquivo com os textos anteriores. O aceite expresso e o registro da identidade e da versão permitem demonstrar a ação e o texto apresentado sem coletar IP, CPF ou localização para esse fim. Esse aceite trata da licença da arena e não substitui a autorização de terceiros nem o fundamento de outros tratamentos de dados pessoais. [Termos do GitHub](https://docs.github.com/pt/site-policy/github-terms/github-terms-of-service) · [Arquivo do Google](https://policies.google.com/terms/archive?hl=pt-BR) · [MP 2.200-2, art. 10](https://www2.camara.leg.br/legin/fed/medpro/2001/medidaprovisoria-2200-2-24-agosto-2001-391394-publicacaooriginal-1-pe.html) · [Lei de Direitos Autorais, arts. 29 e 79](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm)

## Publicar uma alteração que exija novo aceite

1. Acrescentar o texto integral a `src/modules/terms/versions`, a entrada no catálogo e o resumo da alteração. Manter as URLs das versões anteriores disponíveis e incluir no teste de arquivo o hash do novo documento.
2. Para uma mudança material aplicável aos titulares, atualizar a versão e a mensagem de aceite em `arena-terms.ts` e preparar uma nova migração no repositório do banco. A tabela privada de versões identifica a versão exigida. Preservar os recibos anteriores. Ações editoriais e mudanças que afetem só atletas não devem gerar um novo pedido ao titular por engano.
3. Validar primeiro em homologação. Na promoção, aplicar o banco antes da web e publicar os dois em sequência. Durante o intervalo, um painel antigo pode exigir atualização antes de permitir novas imagens. Validar cada combinação de titular, arena e versão, a rota pública, a remoção de imagem, a reivindicação e o acesso dos operadores.
4. Ao responder à loja, usar um registro real gerado depois do aceite e a URL da versão correspondente. Um clique de teste ou um cadastro antigo sem aceite não comprovam a autorização de um cliente. Para marcas e fotos preexistentes, verificar a procedência quando necessário.

Antes de reutilizar esse mecanismo para uma alteração mais ampla, avaliar o público atingido, o prazo de comunicação e se o painel atende inclusive quem ainda não voltou a acessá-lo. O registro de que um comunicado foi entregue é diferente de um aceite.
