import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
    title: "Termos de Uso | Arena Digital",
    description: "Termos de uso da plataforma Arena Digital.",
};

const sections = [
    {
        title: "1. Sobre a plataforma",
        body: [
            "A Arena Digital é uma plataforma que conecta donos de arenas esportivas e atletas, oferecendo ferramentas para gestão de quadras, organização de jogos, pagamentos e interação entre usuários.",
            "Ao utilizar a plataforma, você concorda com estes Termos de Uso.",
        ],
    },
    {
        title: "2. Quem pode usar",
        body: ["Você pode utilizar a Arena Digital se:"],
        list: [
            "For maior de 18 anos ou estiver autorizado por um responsável legal",
            "Fornecer informações verdadeiras no cadastro",
            "Utilizar a plataforma de forma legal e responsável",
        ],
    },
    {
        title: "3. Tipos de usuários",
        body: ["A plataforma possui dois perfis principais:"],
        groups: [
            {
                label: "Donos de Arena:",
                text: "Responsáveis pela gestão de quadras, horários, pagamentos e operação do espaço.",
            },
            {
                label: "Atletas:",
                text: "Usuários que utilizam a plataforma para encontrar jogos, arenas, parceiros e participar de atividades esportivas.",
            },
        ],
    },
    {
        title: "4. Funcionalidades",
        body: ["A Arena Digital oferece, entre outros:"],
        list: [
            "Gestão de quadras e reservas",
            "Organização de jogos e eventos",
            "Controle financeiro",
            "Rankings, histórico e evolução de atletas",
            "Programas de fidelidade e comunidade",
        ],
        after: ["As funcionalidades podem ser atualizadas, alteradas ou removidas a qualquer momento."],
    },
    {
        title: "5. Cadastro e conta",
        body: ["Você é responsável por:"],
        list: [
            "Manter a segurança da sua conta",
            "Não compartilhar seu acesso com terceiros",
            "Todas as atividades realizadas com seu login",
        ],
        after: ["A Arena Digital pode suspender ou encerrar contas em caso de uso indevido."],
    },
    {
        title: "6. Pagamentos",
        body: ["Algumas funcionalidades podem ser pagas. Ao contratar um plano ou serviço, você concorda que:"],
        list: [
            "Os valores serão informados previamente",
            "A cobrança poderá ser recorrente",
            "O não pagamento pode resultar na suspensão do acesso",
        ],
    },
    {
        title: "7. Responsabilidades",
        body: ["A Arena Digital não é responsável por:"],
        list: [
            "Problemas ocorridos dentro das arenas",
            "Cancelamentos ou conflitos entre usuários",
            "Qualidade dos serviços prestados pelas arenas",
        ],
        after: ["A plataforma atua como intermediadora tecnológica."],
    },
    {
        title: "8. Conduta do usuário",
        body: ["Você concorda em não:"],
        list: [
            "Usar a plataforma para fins ilegais",
            "Prejudicar outros usuários",
            "Inserir informações falsas",
            "Tentar burlar o sistema",
        ],
    },
    {
        title: "9. Privacidade",
        body: [
            "Seus dados serão utilizados para operação da plataforma e melhoria da experiência. Para mais detalhes, consulte nossa Política de Privacidade.",
        ],
    },
    {
        title: "10. Cancelamento e encerramento",
        body: [
            "Você pode encerrar sua conta a qualquer momento. A Arena Digital também pode suspender ou encerrar contas que violem estes termos.",
        ],
    },
    {
        title: "11. Alterações nos termos",
        body: [
            "Os Termos de Uso podem ser atualizados a qualquer momento. O uso contínuo da plataforma indica concordância com as mudanças.",
        ],
    },
    {
        title: "12. Contato",
        body: ["Em caso de dúvidas, entre em contato pelo e-mail: seuemail@arena.com"],
    },
];

export default function TermsOfUsePage() {
    return (
        <div className="min-h-screen bg-white font-sans text-[#003049]">
            <Navbar />

            <main className="bg-[#F6F7F9] px-4 pb-28 pt-36 md:px-10 md:pb-32 md:pt-40">
                <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-[30px] px-0 md:px-8">
                    <h1 className="text-center font-heading text-[32px] font-bold leading-[48px] text-[#003049]">
                        Termos de Uso
                    </h1>

                    <div className="max-w-none text-sm leading-[1.5] text-[#003049]">
                        {sections.map((section) => (
                            <section key={section.title} className="mb-6">
                                <h2 className="mb-1 text-sm font-semibold leading-[1.5]">{section.title}</h2>
                                {section.body.map((paragraph) => (
                                    <p key={paragraph} className="mb-1">
                                        {paragraph}
                                    </p>
                                ))}

                                {section.groups?.map((group) => (
                                    <div key={group.label} className="mt-4">
                                        <p className="font-medium">{group.label}</p>
                                        <p>{group.text}</p>
                                    </div>
                                ))}

                                {section.list && (
                                    <ul className="my-4 list-disc space-y-0 pl-6">
                                        {section.list.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                )}

                                {section.after?.map((paragraph) => (
                                    <p key={paragraph} className="mt-1">
                                        {paragraph}
                                    </p>
                                ))}
                            </section>
                        ))}

                        <p className="mt-9 text-[10px] leading-[1.5]">Última atualização: 14/04/2026</p>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
