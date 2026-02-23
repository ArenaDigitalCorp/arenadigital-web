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
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { HeroAnimation } from "@/components/layout/HeroAnimation";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-[#FF6B00]/20">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden min-h-[700px] flex items-center justify-center">
        {/* Background Animation Setup */}
        <HeroAnimation />

        <div className="container mx-auto text-center relative z-10 flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-5xl mx-auto leading-[1.15]">
            Sua arena cheia. <span className="text-[#FF6B00]">Sua<br className="hidden md:block" /> gestão no controle.</span> Seus<br className="hidden md:block" /> atletas engajados.
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto mb-10 font-medium leading-relaxed">
            Plataforma completa para gestão de arenas esportivas e aplicativo<br className="hidden md:block" /> para conectar atletas, organizar jogos e criar comunidade.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 w-full sm:w-auto">
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button size="lg" className="h-14 w-full sm:w-auto px-8 text-base bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-full shadow-lg shadow-[#FF6B00]/20 transition-all flex items-center justify-center gap-2">
                Quero transformar minha arena <span className="text-xl">→</span>
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 w-full sm:w-auto px-8 text-base border-white/20 text-white bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-sm transition-all focus:ring-0 flex items-center justify-center">
              <Smartphone className="w-5 h-5 mr-2 opacity-80" /> Sou atleta
            </Button>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 text-white/90 mt-8">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-[#FF6B00] mb-1">100%</span>
              <span className="text-xs uppercase tracking-widest font-semibold opacity-70">Digital</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-[#FFC145] mb-1">Web + App</span>
              <span className="text-xs uppercase tracking-widest font-semibold opacity-70">Integrados</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-[#FF6B00] mb-1">6</span>
              <span className="text-xs uppercase tracking-widest font-semibold opacity-70">Modalidades</span>
            </div>
          </div>
        </div>
      </section>

      {/* Identificação Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold text-[#002B40] text-center mb-16 tracking-tight">Você se identifica?</h2>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
            {/* Donos de Arena Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-[#002B40] text-white flex items-center justify-center shrink-0 shadow-md">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#002B40]">Para Donos de Arena</h3>
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
                <div key={i} className="bg-white rounded-xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
                  <div className="text-[#FF6B00] shrink-0 opacity-80">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <span className="text-slate-700 font-medium text-sm leading-snug">{text}</span>
                </div>
              ))}
            </div>

            {/* Atletas Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#FF6B00]/20">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#002B40]">Para Atletas</h3>
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
                <div key={i} className="bg-white rounded-xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-300">
                  <div className="text-[#FFC145] shrink-0 opacity-80">
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
      <section className="py-28 bg-[#F8FAFC]">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#002B40] mb-4 tracking-tight">
              Uma plataforma. Dois lados conectados. <span className="text-[#FF6B00]">Um ecossistema completo.</span>
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
              <div key={i} className="bg-white rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] border border-slate-50 hover:-translate-y-1 transition-transform duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-[#FF6B00]/10 text-[#FF6B00] flex items-center justify-center mb-4 group-hover:bg-[#FF6B00] group-hover:text-white transition-colors">
                  <item.icon className="w-6 h-6" />
                </div>
                <span className="font-semibold text-[#002B40] text-sm leading-tight">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Máquina Organizada Section */}
      <section className="py-28 bg-white overflow-hidden">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <div className="mb-16">
            <span className="text-[#0089A0] font-bold tracking-wider text-xs uppercase mb-3 block">Para Donos de Arena</span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#002B40] tracking-tight max-w-3xl mx-auto leading-tight">
              Transforme sua arena em uma <span className="text-[#FFC145]">máquina organizada</span> e previsível.
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
              <div key={i} className={`bg-white rounded-3xl p-8 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] border border-slate-100 ${i === 4 ? 'md:col-span-2 lg:col-span-1' : ''}`}>
                <div className="w-12 h-12 rounded-xl bg-[#001D2D] text-white flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-[#002B40] font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <Button className="h-14 px-8 text-base bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-full shadow-lg shadow-[#FF6B00]/20 transition-all">
              Quero automatizar minha arena <span className="text-xl ml-2">→</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Comunidade Atletas Section */}
      <section className="py-28 bg-[#001D2D] relative overflow-hidden">
        {/* Abstract background blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#002B40] rounded-full blur-[100px] opacity-50 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#0089A0]/20 rounded-full blur-[100px] opacity-50 translate-y-1/2 -translate-x-1/2" />

        <div className="container mx-auto px-4 max-w-5xl text-center relative z-10">
          <div className="mb-16">
            <span className="text-[#0089A0] font-bold tracking-wider text-xs uppercase mb-3 block">Para Atletas</span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight max-w-3xl mx-auto leading-tight">
              Encontre jogos. Evolua. <span className="text-[#FF6B00]">Faça parte da comunidade.</span>
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
              <div key={i} className={`bg-[#002B40]/50 backdrop-blur-sm rounded-3xl p-8 border border-white/5 ${i === 4 ? 'md:col-span-2 lg:col-span-1' : ''}`}>
                <div className="w-12 h-12 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center mb-6 shadow-lg shadow-[#FF6B00]/20">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <Button className="h-14 px-8 text-base bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-full shadow-lg shadow-[#FF6B00]/20 transition-all">
              Quero baixar o app <span className="text-xl ml-2">→</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Como funciona Section */}
      <section className="py-28 bg-[#F8FAFC]">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <span className="text-[#0089A0] font-bold tracking-wider text-xs uppercase mb-3 block">Como Funciona</span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#002B40] tracking-tight">
              3 passos simples para <span className="text-[#FFC145]">começar</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-24 relative">
            {/* Divider line for desktop */}
            <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-slate-200 -translate-x-1/2" />

            {/* Para Arenas */}
            <div>
              <h3 className="text-xl font-bold text-[#002B40] mb-8 text-center md:text-left">Para Arenas</h3>
              <div className="space-y-8">
                {[
                  { step: "01", title: "Cadastre sua arena", desc: "Crie sua conta e configure seu perfil." },
                  { step: "02", title: "Configure quadras e estações", desc: "Adicione quadras, bar, loja e modalidades." },
                  { step: "03", title: "Conecte atletas e opere", desc: "Comece a receber reservas e gerir tudo digitalmente." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="w-12 h-12 shrink-0 rounded-full bg-[#FFC145] text-white font-bold text-lg flex items-center justify-center shadow-md">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="text-[#002B40] font-bold text-lg mb-1">{item.title}</h4>
                      <p className="text-slate-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Para Atletas */}
            <div>
              <h3 className="text-xl font-bold text-[#002B40] mb-8 text-center md:text-left">Para Atletas</h3>
              <div className="space-y-8">
                {[
                  { step: "01", title: "Baixe o app", desc: "Disponível para Android e iOS." },
                  { step: "02", title: "Encontre arenas e jogos", desc: "Busque por localização e nível." },
                  { step: "03", title: "Evolua seu nível", desc: "Acompanhe estatísticas e suba no ranking." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="w-12 h-12 shrink-0 rounded-full bg-[#FFC145] text-white font-bold text-lg flex items-center justify-center shadow-md">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="text-[#002B40] font-bold text-lg mb-1">{item.title}</h4>
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
      <section className="py-32 bg-[#001D2D] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,#002B40_0%,transparent_70%)] opacity-80" />

        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 leading-tight tracking-tight">
            Pronto para lotar sua arena e<br className="hidden md:block" /> organizar sua operação <span className="text-[#FF6B00]">de<br className="hidden md:block" /> verdade?</span>
          </h2>
          <p className="text-lg text-white/70 mb-12 max-w-2xl mx-auto">
            Comece hoje e transforme a gestão da sua arena ou encontre os melhores jogos da sua região.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button size="lg" className="h-14 w-full sm:w-auto px-8 text-base bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-full shadow-xl shadow-[#FF6B00]/20 transition-all flex items-center justify-center">
                Quero transformar minha arena <span className="text-xl ml-2">→</span>
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 w-full sm:w-auto px-8 text-base border-white/10 text-white bg-transparent hover:bg-white/5 rounded-full transition-all focus:ring-0 flex items-center justify-center gap-2">
              <Smartphone className="w-5 h-5 opacity-80" /> Sou atleta e quero jogar
            </Button>
          </div>
        </div>
      </section>

      {/* Footer Minimalista */}
      <footer className="bg-[#001524] py-10 border-t border-white/5">
        <div className="container mx-auto px-4 flex flex-col items-center justify-center text-center">
          <img
            src="/logo_arena_front_bgbranco.png"
            alt="Arena Digital Logo"
            className="h-8 w-auto object-contain brightness-0 invert opacity-50 mb-6 hover:opacity-100 transition-opacity"
          />
          <p className="text-xs text-white/30 font-medium">
            © {new Date().getFullYear()} Arena Digital. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
