import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import {
  Building2,
  User,
  Smartphone,
  AlertTriangle,
  LayoutGrid,
  Wallet,
  Store,
  Medal,
  Activity,
  History,
  Trophy,
  Users,
  MapPin,
  RefreshCcw,
  CalendarDays,
  LineChart,
  Gamepad2,
  TrendingUp,
  Gift,
  Search,
  QrCode,
  Apple,
  Play,
  Instagram,
  Facebook,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { HeroAnimation } from "@/components/layout/HeroAnimation";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--arena-soft)] font-sans text-[var(--arena-navy-800)] selection:bg-[#F97415]/20">
      <Navbar />

      {/* Hero Section */}
      <section className="relative flex min-h-[760px] items-center justify-center overflow-hidden px-4 pb-16 pt-28 md:min-h-[906px] md:pb-20 md:pt-32">
        {/* Background Animation Setup */}
        <HeroAnimation />

        <div className="container mx-auto text-center relative z-10 flex flex-col items-center">
          <h1 className="mx-auto mb-6 max-w-5xl font-heading text-[clamp(2.8rem,5.2vw,5.75rem)] font-black leading-[0.96] text-white">
            Sua arena cheia. <span className="arena-gradient-text">Sua gestão no controle.</span> Seus atletas engajados.
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-lg font-medium leading-8 text-white/70 md:text-xl">
            Plataforma completa para gestão de arenas esportivas e aplicativo para conectar atletas, organizar jogos e criar comunidade.
          </p>
          <div className="mb-16 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button size="lg" className="arena-gradient h-14 w-full rounded-xl border-0 px-8 text-base font-extrabold text-white shadow-2xl shadow-[#F97415]/25 transition-all hover:scale-[1.02] hover:brightness-105 sm:w-auto">
                Quero transformar minha arena <span className="text-xl">→</span>
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 w-full rounded-xl border border-white/20 bg-white/[0.03] px-8 text-base font-extrabold text-white backdrop-blur-sm transition-all hover:border-white/35 hover:bg-white/10 focus:ring-0 sm:w-auto">
              <Smartphone className="w-5 h-5 mr-2 opacity-80" /> Sou atleta
            </Button>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-10 text-white/85 md:gap-20">
            <div className="flex flex-col items-center">
              <span className="arena-gradient-text mb-1 font-heading text-4xl font-black">100%</span>
              <span className="text-sm font-medium text-white/55">Digital</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="arena-gradient-text mb-1 font-heading text-4xl font-black">Web + App</span>
              <span className="text-sm font-medium text-white/55">Integrados</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="arena-gradient-text mb-1 font-heading text-4xl font-black">6</span>
              <span className="text-sm font-medium text-white/55">Modalidades</span>
            </div>
          </div>
        </div>
      </section>

      {/* Identificação Section */}
      <section className="bg-white py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="mb-16 text-center font-heading text-4xl font-extrabold text-[var(--arena-navy-800)] md:text-5xl">Você se identifica?</h2>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
            {/* Donos de Arena Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--arena-navy-800)] text-white shadow-md">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-extrabold text-[var(--arena-navy-800)]">Para Donos de Arena</h3>
                  <p className="text-sm text-slate-500 mt-1">Gerenciar uma arena não deveria ser tão complicado.</p>
                </div>
              </div>

              {[
                "Dificuldade em gerenciar reservas, pagamentos e calendário",
                "Gestão manual de campeonatos, bar e estoque",
                "Falta de previsibilidade financeira",
                "Pouca visibilidade e captação de novos alunos",
                "Falta de controle sobre ocupação das quadras"
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg border border-slate-100 bg-white p-4 shadow-[0_12px_28px_-24px_rgba(0,21,36,0.4)] transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="shrink-0 text-[#F97415] opacity-80">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <span className="text-slate-700 font-medium text-sm leading-snug">{text}</span>
                </div>
              ))}
            </div>

            {/* Atletas Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="arena-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white shadow-md shadow-[#F97415]/20">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-extrabold text-[var(--arena-navy-800)]">Para Atletas</h3>
                  <p className="text-sm text-slate-500 mt-1">Jogar deveria ser simples. Não um caos no WhatsApp.</p>
                </div>
              </div>

              {[
                "Dificuldade em encontrar parceiros do mesmo nível",
                "Falta de previsibilidade de jogos",
                "Pagamentos informais e confusos",
                "Pouca visibilidade da evolução pessoal",
                "Dificuldade em encontrar arenas confiáveis"
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg border border-slate-100 bg-white p-4 shadow-[0_12px_28px_-24px_rgba(0,21,36,0.4)] transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="shrink-0 text-[#F9A91F] opacity-80">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <span className="text-slate-700 font-medium text-sm leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ecossistema Section */}
      <section id="solution" className="bg-[var(--arena-soft)] py-28">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4 font-heading text-4xl font-extrabold text-[var(--arena-navy-800)] md:text-5xl">
              Uma plataforma. Dois lados conectados. <span className="arena-gradient-text">Um ecossistema completo.</span>
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              O Arena Digital integra tudo que arenas e atletas precisam em um só lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { icon: LayoutGrid, text: "Gestão de quadras" },
              { icon: Wallet, text: "Gestão financeira" },
              { icon: Store, text: "Controle de estações e caixas" },
              { icon: Medal, text: "Programa de fidelidade" },
              { icon: Activity, text: "Turbine horários vagos" },
              { icon: History, text: "Histórico de jogos" },
              { icon: Trophy, text: "Ranking e nível" },
              { icon: Users, text: "Formação de times" },
              { icon: MapPin, text: "Busca por geolocalização" },
              { icon: RefreshCcw, text: "Match oferta e demanda" }
            ].map((item, i) => (
              <div key={i} className="group flex min-h-36 flex-col items-center justify-center rounded-lg border border-slate-100 bg-white p-6 text-center shadow-[0_14px_30px_-26px_rgba(0,21,36,0.45)] transition-transform duration-300 hover:-translate-y-1">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-[#F97415]/10 text-[#F97415] transition-colors group-hover:bg-[#F97415] group-hover:text-white">
                  <item.icon className="w-6 h-6" />
                </div>
                <span className="font-heading text-sm font-extrabold leading-tight text-[var(--arena-navy-800)]">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Máquina Organizada Section */}
      <section id="forarenas" className="overflow-hidden bg-white py-28">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <div className="mb-16">
            <span className="mb-3 block text-xs font-extrabold uppercase tracking-wider text-[var(--arena-cyan)]">Para Donos de Arena</span>
            <h2 className="mx-auto max-w-4xl font-heading text-4xl font-extrabold leading-tight text-[var(--arena-navy-800)] md:text-5xl">
              Transforme sua arena em uma <span className="arena-gradient-text">máquina organizada</span> e previsível.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {[
              { icon: CalendarDays, title: "Gestão completa de quadras", desc: "Controle de horários, reservas e disponibilidade em poucos cliques." },
              { icon: LineChart, title: "Gestão financeira inteligente", desc: "Dashboard com entradas, saídas, mensalidades e relatórios." },
              { icon: Store, title: "Gestão de estações (bar e loja)", desc: "Controle de comandas, itens e fluxo diário." },
              { icon: Gift, title: "Programa de fidelidade", desc: "Criação de moedas, créditos e recompensas para atletas." },
              { icon: LineChart, title: "Visão estratégica", desc: "Dashboard comparativo mensal + controle de ocupação." }
            ].map((feature, i) => (
              <div key={i} className={`rounded-lg border border-slate-100 bg-white p-8 shadow-[0_18px_34px_-26px_rgba(0,21,36,0.45)] ${i === 4 ? 'md:col-span-2 lg:col-span-1' : ''}`}>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--arena-navy-900)] text-white">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-extrabold text-[var(--arena-navy-800)]">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <Button className="arena-gradient h-14 border-0 px-8 text-base font-extrabold text-white shadow-lg shadow-[#F97415]/20 transition-all hover:brightness-105">
              Quero automatizar minha arena <span className="text-xl ml-2">→</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Comunidade Atletas Section */}
      <section id="foratletas" className="relative overflow-hidden bg-[var(--arena-navy-900)] py-28">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,29,45,0)_0%,rgba(0,43,64,0.55)_100%)]" />
        <div className="container mx-auto px-4 max-w-5xl text-center relative z-10">
          <div className="mb-16">
            <span className="mb-3 block text-xs font-extrabold uppercase tracking-wider text-[var(--arena-cyan)]">Para Atletas</span>
            <h2 className="mx-auto max-w-4xl font-heading text-4xl font-extrabold leading-tight text-white md:text-5xl">
              Encontre jogos. Evolua. <span className="arena-gradient-text">Faça parte da comunidade.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {[
              { icon: Search, title: "Encontre arenas próximas", desc: "Busca por geolocalização para encontrar onde jogar." },
              { icon: Gamepad2, title: "Jogue com pessoas do seu nível", desc: "Sistema de nivelamento e histórico de partidas." },
              { icon: Users, title: "Monte seu time", desc: "Cadastro de times, convites e próximos jogos." },
              { icon: TrendingUp, title: "Acompanhe sua evolução", desc: "Vitórias, derrotas, estatísticas e nível." },
              { icon: Gift, title: "Ganhe recompensas", desc: "Programa de fidelidade integrado com a arena." }
            ].map((feature, i) => (
              <div key={i} className={`rounded-lg border border-white/5 bg-[rgba(0,43,64,0.70)] p-8 backdrop-blur-sm ${i === 4 ? 'md:col-span-2 lg:col-span-1' : ''}`}>
                <div className="arena-gradient mb-6 flex h-12 w-12 items-center justify-center rounded-lg text-white shadow-lg shadow-[#F97415]/20">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-extrabold text-white">{feature.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <Button className="arena-gradient h-14 border-0 px-8 text-base font-extrabold text-white shadow-lg shadow-[#F97415]/20 transition-all hover:brightness-105">
              Quero baixar o app <span className="text-xl ml-2">→</span>
            </Button>
          </div>
        </div>
      </section>

      {/* App Download Section */}
      <section className="bg-[#F7F4EE] py-24">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <span className="mb-3 block text-xs font-extrabold uppercase tracking-wider text-[var(--arena-cyan)]">Para Atletas</span>
          <h2 className="font-heading text-4xl font-extrabold leading-tight text-[var(--arena-navy-800)] md:text-5xl">
            Disponível para <span className="arena-gradient-text">Android e iOS</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#62656c]">
            Escaneie o QR Code e baixe o aplicativo para encontrar jogos, acompanhar seu nível e jogar mais.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {[
              { label: "Baixar na App Store", icon: Apple },
              { label: "Baixar no Google Play", icon: Play },
            ].map((store) => (
              <div key={store.label} className="rounded-xl border border-slate-100 bg-white p-6 shadow-[0_18px_34px_-28px_rgba(0,21,36,0.45)]">
                <div className="mx-auto flex aspect-square w-36 items-center justify-center rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] text-[var(--arena-navy-800)]">
                  <QrCode className="h-28 w-28" strokeWidth={1.4} />
                </div>
                <Button className="mt-5 h-11 rounded-lg bg-[var(--arena-navy-900)] px-5 text-sm font-extrabold text-white hover:bg-[var(--arena-navy-800)]">
                  <store.icon className="mr-2 h-4 w-4" />
                  {store.label}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona Section */}
      <section id="howitworks" className="bg-[var(--arena-soft)] py-28">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <span className="mb-3 block text-xs font-extrabold uppercase tracking-wider text-[var(--arena-cyan)]">Como Funciona</span>
            <h2 className="font-heading text-4xl font-extrabold text-[var(--arena-navy-800)] md:text-5xl">
              3 passos simples para <span className="arena-gradient-text">começar</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-24 relative">
            {/* Divider line for desktop */}
            <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-slate-200 -translate-x-1/2" />

            {/* Para Arenas */}
            <div>
              <h3 className="mb-8 text-center font-heading text-xl font-extrabold text-[var(--arena-navy-800)] md:text-left">Para Arenas</h3>
              <div className="space-y-8">
                {[
                  { step: "01", title: "Cadastre sua arena", desc: "Crie sua conta e configure seu perfil." },
                  { step: "02", title: "Configure quadras e estações", desc: "Adicione quadras, bar, loja e modalidades." },
                  { step: "03", title: "Conecte atletas e opere", desc: "Comece a receber reservas e gerir tudo digitalmente." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="arena-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold text-white shadow-md">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="mb-1 font-heading text-lg font-extrabold text-[var(--arena-navy-800)]">{item.title}</h4>
                      <p className="text-slate-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Para Atletas */}
            <div>
              <h3 className="mb-8 text-center font-heading text-xl font-extrabold text-[var(--arena-navy-800)] md:text-left">Para Atletas</h3>
              <div className="space-y-8">
                {[
                  { step: "01", title: "Baixe o app", desc: "Disponível para Android e iOS." },
                  { step: "02", title: "Encontre arenas e jogos", desc: "Busque por localização e nível." },
                  { step: "03", title: "Evolua seu nível", desc: "Acompanhe estatísticas e suba no ranking." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="arena-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold text-white shadow-md">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="mb-1 font-heading text-lg font-extrabold text-[var(--arena-navy-800)]">{item.title}</h4>
                      <p className="text-slate-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#050C19] to-[#101D37] py-32">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute left-1/4 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[#FF6A00] blur-[60px]" />
          <div className="absolute right-1/4 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[#FF6A00] blur-[60px]" />
        </div>

        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <h2 className="mb-6 font-heading text-4xl font-extrabold leading-tight text-white md:text-5xl">
            Pronto para lotar sua arena e organizar sua operação <span className="arena-gradient-text">de verdade?</span>
          </h2>
          <p className="text-lg text-white/70 mb-12 max-w-2xl mx-auto">
            Comece hoje e transforme a gestão da sua arena ou encontre os melhores jogos da sua região.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button size="lg" className="arena-gradient flex h-14 w-full items-center justify-center rounded-xl border-0 px-8 text-base font-extrabold text-white shadow-xl shadow-[#F97415]/20 transition-all hover:brightness-105 sm:w-auto">
                Quero transformar minha arena agora <span className="text-xl ml-2">→</span>
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-white/15 bg-transparent px-8 text-base font-extrabold text-white transition-all hover:bg-white/5 focus:ring-0 sm:w-auto">
              <Smartphone className="w-5 h-5 opacity-80" /> Sou atleta e quero jogar
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#0B1832] px-4 pb-10 pt-[41px]">
        <div className="mx-auto flex w-full max-w-[1191px] flex-col items-center gap-[30px]">
          <div className="grid w-full max-w-[956px] gap-10 md:grid-cols-[118px_1fr_151px] md:items-start md:justify-between">
            <Image
              src="/logo_arena_front_bgbranco.png"
              alt="Arena Digital Logo"
              width={118}
              height={40}
              className="h-10 w-[118px] object-contain"
            />

            <div className="flex flex-col gap-4 text-sm leading-5 text-[#C2C7CE] md:mx-auto">
              <a href="#" className="flex items-center gap-2 transition-colors hover:text-white">
                <Instagram className="h-5 w-5" strokeWidth={1.8} />
                Instagram
              </a>
              <a href="#" className="flex items-center gap-2 transition-colors hover:text-white">
                <Facebook className="h-5 w-5" strokeWidth={1.8} />
                Facebook
              </a>
            </div>

            <div className="flex w-[151px] flex-col gap-[15px] text-left text-xs leading-5 text-[#C2C7CE]">
              <p className="font-bold uppercase">Legal & Social</p>
              <div className="flex flex-col gap-2">
                <a href="#" className="transition-colors hover:text-white">Termos de Uso</a>
                <a href="#" className="transition-colors hover:text-white">Política de Privacidade</a>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-white/10" />

          <p className="text-center text-sm font-normal leading-5 text-white/50">
            © {new Date().getFullYear()} Arena Digital. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
