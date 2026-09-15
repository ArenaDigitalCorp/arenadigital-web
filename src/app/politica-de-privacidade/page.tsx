import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
    title: "Política de Privacidade | Arena Digital",
    description: "Política de Privacidade da plataforma Arena Digital.",
};

type Block =
    | { type: "p"; text: string }
    | { type: "ul"; items: string[] };

const intro: string[] = [
    "A Arena Digital valoriza a privacidade e a proteção dos dados pessoais de seus usuários. Esta Política de Privacidade tem como objetivo explicar, de forma clara e transparente, como coletamos, utilizamos, armazenamos, compartilhamos e protegemos as informações dos usuários da plataforma Arena Digital, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados – LGPD) e demais legislações aplicáveis.",
    "Ao utilizar a plataforma Arena Digital, seja por meio do aplicativo móvel, portal web ou qualquer outro serviço disponibilizado, o usuário declara que leu, compreendeu e concorda com esta Política de Privacidade.",
];

const sections: { title: string; blocks: Block[] }[] = [
    {
        title: "1. Sobre a Arena Digital",
        blocks: [
            {
                type: "p",
                text: "A Arena Digital é uma plataforma tecnológica destinada à gestão de arenas esportivas, reservas de quadras, organização de eventos, campeonatos, relacionamento entre atletas, administração financeira e demais serviços relacionados ao ecossistema de esportes.",
            },
            { type: "p", text: "A plataforma conecta:" },
            {
                type: "ul",
                items: [
                    "Administradores de Arenas;",
                    "Atletas;",
                    "Organizadores de eventos;",
                    "Professores e treinadores;",
                    "Parceiros comerciais;",
                    "Prestadores de serviços.",
                ],
            },
        ],
    },
    {
        title: "2. Dados coletados",
        blocks: [
            {
                type: "p",
                text: "Durante a utilização da plataforma poderão ser coletados diferentes tipos de dados pessoais.",
            },
        ],
    },
    {
        title: "2.1 Dados fornecidos pelo usuário",
        blocks: [
            { type: "p", text: "Podemos coletar informações como:" },
            {
                type: "ul",
                items: [
                    "Nome completo;",
                    "CPF (quando necessário);",
                    "Data de nascimento;",
                    "Sexo;",
                    "E-mail;",
                    "Número de telefone;",
                    "Cidade;",
                    "Estado;",
                    "País;",
                    "Dados da empresa (para administradores de arenas);",
                    "Informações esportivas (modalidades praticadas, nível técnico, ranking quando aplicável).",
                ],
            },
        ],
    },
    {
        title: "2.2 Dados coletados automaticamente",
        blocks: [
            {
                type: "p",
                text: "Durante a utilização da plataforma também poderão ser coletadas informações técnicas, tais como:",
            },
            {
                type: "ul",
                items: [
                    "Endereço IP;",
                    "Sistema operacional;",
                    "Navegador utilizado;",
                    "Modelo do dispositivo;",
                    "Fabricante do aparelho;",
                    "Identificador do dispositivo;",
                    "Data e hora dos acessos;",
                    "Localização aproximada (quando autorizada);",
                    "Logs de utilização;",
                    "Tempo de permanência;",
                    "Páginas acessadas;",
                    "Interações realizadas.",
                ],
            },
        ],
    },
    {
        title: "2.3 Dados provenientes de terceiros",
        blocks: [
            { type: "p", text: "Também podemos receber informações provenientes de:" },
            {
                type: "ul",
                items: [
                    "Sistemas de autenticação (Google, Apple e outros provedores autorizados);",
                    "Apple App Store e Google Play, incluindo identificadores de produto, compra, transação e assinatura, status e período de acesso;",
                    "Gateways de pagamento;",
                    "Plataformas parceiras;",
                    "Redes sociais (quando o login social for utilizado).",
                ],
            },
        ],
    },
    {
        title: "3. Finalidade do tratamento dos dados",
        blocks: [
            { type: "p", text: "Os dados pessoais poderão ser utilizados para:" },
            {
                type: "ul",
                items: [
                    "Criar e manter a conta do usuário;",
                    "Autenticar acessos;",
                    "Permitir reservas de quadras;",
                    "Gerenciar pagamentos;",
                    "Processar assinaturas;",
                    "Organizar campeonatos;",
                    "Gerenciar listas de participantes;",
                    "Emitir comprovantes;",
                    "Enviar notificações;",
                    "Informar alterações de reservas;",
                    "Confirmar presença em eventos;",
                    "Melhorar a experiência do usuário;",
                    "Desenvolver novas funcionalidades;",
                    "Gerar estatísticas internas;",
                    "Prevenir fraudes;",
                    "Garantir a segurança da plataforma;",
                    "Cumprir obrigações legais;",
                    "Atender determinações judiciais;",
                    "Atender solicitações de autoridades competentes.",
                ],
            },
        ],
    },
    {
        title: "4. Base legal para tratamento",
        blocks: [
            {
                type: "p",
                text: "O tratamento dos dados pessoais poderá ocorrer com fundamento em uma ou mais das seguintes bases legais previstas na LGPD:",
            },
            {
                type: "ul",
                items: [
                    "Consentimento do titular;",
                    "Execução de contrato;",
                    "Cumprimento de obrigação legal;",
                    "Exercício regular de direitos;",
                    "Legítimo interesse;",
                    "Proteção do crédito;",
                    "Proteção da vida;",
                    "Tutela da saúde, quando aplicável.",
                ],
            },
        ],
    },
    {
        title: "5. Compartilhamento de dados",
        blocks: [
            {
                type: "p",
                text: "A Arena Digital poderá compartilhar informações apenas quando necessário para execução dos serviços.",
            },
            { type: "p", text: "Isso pode ocorrer com:" },
            {
                type: "ul",
                items: [
                    "Processadores de pagamento;",
                    "Instituições financeiras;",
                    "Provedores de hospedagem;",
                    "Serviços de autenticação;",
                    "Empresas de envio de e-mails;",
                    "Plataformas de notificações;",
                    "Ferramentas de análise de desempenho;",
                    "Prestadores de suporte técnico;",
                    "Parceiros comerciais vinculados às arenas;",
                    "Autoridades públicas, quando houver obrigação legal.",
                ],
            },
            { type: "p", text: "Nunca comercializamos dados pessoais dos usuários." },
        ],
    },
    {
        title: "6. Pagamentos",
        blocks: [
            {
                type: "p",
                text: "Os pagamentos realizados dentro da plataforma poderão ser processados por empresas especializadas.",
            },
            {
                type: "p",
                text: "A Arena Digital não armazena números completos de cartões de crédito ou débito.",
            },
            {
                type: "p",
                text: "As informações financeiras são processadas diretamente pelos provedores de pagamento certificados, que seguem elevados padrões internacionais de segurança, incluindo requisitos do PCI DSS quando aplicáveis.",
            },
        ],
    },
    {
        title: "7. Cookies e tecnologias semelhantes",
        blocks: [
            { type: "p", text: "Utilizamos cookies e tecnologias similares para:" },
            {
                type: "ul",
                items: [
                    "Manter sessões autenticadas;",
                    "Memorizar preferências;",
                    "Melhorar desempenho;",
                    "Medir audiência;",
                    "Identificar falhas;",
                    "Personalizar conteúdos;",
                    "Aprimorar funcionalidades.",
                ],
            },
            {
                type: "p",
                text: "O usuário poderá desabilitar cookies nas configurações do navegador, embora algumas funcionalidades possam deixar de funcionar corretamente.",
            },
        ],
    },
    {
        title: "8. Segurança da informação",
        blocks: [
            {
                type: "p",
                text: "A Arena Digital adota medidas técnicas, administrativas e organizacionais para proteger os dados pessoais contra:",
            },
            {
                type: "ul",
                items: [
                    "acesso não autorizado;",
                    "perda;",
                    "destruição;",
                    "alteração;",
                    "divulgação indevida;",
                    "vazamentos.",
                ],
            },
            { type: "p", text: "Entre as medidas adotadas destacam-se:" },
            {
                type: "ul",
                items: [
                    "criptografia de dados em trânsito (TLS/HTTPS);",
                    "criptografia de informações sensíveis quando aplicável;",
                    "autenticação segura de usuários;",
                    "controle de acesso baseado em permissões;",
                    "monitoramento de atividades;",
                    "backups periódicos;",
                    "infraestrutura em nuvem com elevados padrões de disponibilidade e segurança;",
                    "revisão contínua de vulnerabilidades.",
                ],
            },
            {
                type: "p",
                text: "Apesar de todos os esforços empregados, nenhum ambiente conectado à internet é absolutamente seguro, razão pela qual não podemos garantir segurança absoluta contra eventos imprevisíveis ou ações maliciosas de terceiros.",
            },
        ],
    },
    {
        title: "9. Retenção dos dados",
        blocks: [
            { type: "p", text: "Os dados pessoais permanecerão armazenados:" },
            {
                type: "ul",
                items: [
                    "enquanto existir relacionamento entre o usuário e a plataforma;",
                    "durante o período necessário para cumprimento de obrigações legais;",
                    "enquanto houver necessidade para defesa de direitos em processos administrativos ou judiciais;",
                    "pelo prazo permitido pela legislação.",
                ],
            },
            {
                type: "p",
                text: "Após esse período, os dados poderão ser eliminados ou anonimizados.",
            },
        ],
    },
    {
        title: "10. Direitos do titular dos dados",
        blocks: [
            {
                type: "p",
                text: "Nos termos da LGPD, o usuário poderá solicitar, a qualquer momento:",
            },
            {
                type: "ul",
                items: [
                    "confirmação da existência de tratamento;",
                    "acesso aos dados;",
                    "correção de dados incompletos ou desatualizados;",
                    "anonimização;",
                    "bloqueio;",
                    "eliminação;",
                    "portabilidade;",
                    "revogação do consentimento;",
                    "informação sobre compartilhamentos realizados;",
                    "oposição ao tratamento quando cabível.",
                ],
            },
            {
                type: "p",
                text: "As solicitações poderão ser realizadas pelos canais oficiais de atendimento da Arena Digital.",
            },
        ],
    },
    {
        title: "11. Exclusão da conta",
        blocks: [
            { type: "p", text: "O usuário poderá solicitar a exclusão de sua conta." },
            {
                type: "p",
                text: "A solicitação não implica na eliminação imediata de todos os dados, pois determinadas informações poderão permanecer armazenadas para:",
            },
            {
                type: "ul",
                items: [
                    "cumprimento de obrigações legais;",
                    "prevenção a fraudes;",
                    "auditorias;",
                    "defesa judicial;",
                    "cumprimento de determinações regulatórias.",
                ],
            },
        ],
    },
    {
        title: "12. Comunicações",
        blocks: [
            { type: "p", text: "Poderemos enviar comunicações relacionadas a:" },
            {
                type: "ul",
                items: [
                    "confirmação de reservas;",
                    "alterações de horários;",
                    "recuperação de senha;",
                    "segurança da conta;",
                    "notificações operacionais;",
                    "novidades da plataforma;",
                    "campanhas promocionais (quando permitido pela legislação ou mediante consentimento).",
                ],
            },
            {
                type: "p",
                text: "O usuário poderá cancelar comunicações de marketing a qualquer momento, sem prejuízo do recebimento das mensagens essenciais ao funcionamento da plataforma.",
            },
        ],
    },
    {
        title: "13. Menores de idade",
        blocks: [
            {
                type: "p",
                text: "A utilização da plataforma por menores de idade deverá ocorrer em conformidade com a legislação aplicável e, quando necessário, mediante autorização ou acompanhamento de seus pais ou responsáveis legais.",
            },
        ],
    },
    {
        title: "14. Transferência internacional de dados",
        blocks: [
            {
                type: "p",
                text: "Alguns fornecedores de infraestrutura, armazenamento, autenticação, notificações e processamento de dados poderão estar localizados fora do Brasil.",
            },
            {
                type: "p",
                text: "Quando houver transferência internacional de dados, a Arena Digital adotará medidas para assegurar que o tratamento ocorra em conformidade com a LGPD, utilizando mecanismos legais e contratuais adequados.",
            },
        ],
    },
    {
        title: "15. Atualizações desta Política",
        blocks: [
            {
                type: "p",
                text: "Esta Política de Privacidade poderá ser alterada periodicamente para refletir mudanças na legislação, na tecnologia ou nos serviços oferecidos pela Arena Digital.",
            },
            {
                type: "p",
                text: "Sempre que ocorrerem alterações relevantes, a versão atualizada será disponibilizada na plataforma, contendo a respectiva data de atualização.",
            },
            {
                type: "p",
                text: "Recomendamos que o usuário consulte este documento regularmente.",
            },
        ],
    },
    {
        title: "16. Contato",
        blocks: [
            {
                type: "p",
                text: "Em caso de dúvidas, solicitações relacionadas aos seus dados pessoais ou exercício dos direitos previstos na LGPD, entre em contato pelos canais oficiais da Arena Digital.",
            },
            { type: "p", text: "E-mail para contato: contato@arenadigital.app" },
        ],
    },
    {
        title: "17. Foro",
        blocks: [
            {
                type: "p",
                text: "Esta Política será regida pelas leis da República Federativa do Brasil.",
            },
            {
                type: "p",
                text: "Fica eleito o foro da comarca do domicílio do titular dos dados ou outro foro competente previsto na legislação aplicável para dirimir eventuais controvérsias decorrentes desta Política.",
            },
        ],
    },
    {
        title: "Considerações Finais",
        blocks: [
            {
                type: "p",
                text: "A Arena Digital reafirma seu compromisso com a transparência, segurança e privacidade de seus usuários. Buscamos continuamente aprimorar nossos processos, tecnologias e práticas de governança para garantir um ambiente confiável, seguro e em conformidade com a legislação vigente, proporcionando uma experiência digital responsável para atletas, gestores de arenas, organizadores de eventos e todos os demais usuários da plataforma.",
            },
        ],
    },
];

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-white font-sans text-[#003049]">
            <Navbar />

            <main className="bg-[#F6F7F9] px-4 pb-28 pt-36 md:px-10 md:pb-32 md:pt-40">
                <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-[30px] px-0 md:px-8">
                    <h1 className="text-center font-heading text-[32px] font-bold leading-[48px] text-[#003049]">
                        Política de Privacidade
                    </h1>

                    <div className="max-w-none text-sm leading-[1.5] text-[#003049]">
                        <section className="mb-6">
                            {intro.map((paragraph) => (
                                <p key={paragraph} className="mb-1">
                                    {paragraph}
                                </p>
                            ))}
                        </section>

                        {sections.map((section) => (
                            <section key={section.title} className="mb-6">
                                <h2 className="mb-1 text-sm font-semibold leading-[1.5]">{section.title}</h2>
                                {section.blocks.map((block, index) =>
                                    block.type === "p" ? (
                                        <p key={index} className="mb-1">
                                            {block.text}
                                        </p>
                                    ) : (
                                        <ul key={index} className="my-4 list-disc space-y-0 pl-6">
                                            {block.items.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    )
                                )}
                            </section>
                        ))}

                        <p className="mt-9 text-[10px] leading-[1.5]">Última atualização: 13/09/2026</p>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
