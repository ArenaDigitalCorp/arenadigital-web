import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Calendar, LayoutDashboard, ShieldCheck, Trophy, Users, Zap } from "lucide-react";
import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20 mb-8">
            <span className="mr-2">🚀</span> Novidade: Gestão completa de campeonatos
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent dark:from-white dark:via-gray-200 dark:to-white">
            A Gestão da Sua Arena <br className="hidden md:block" />
            <span className="text-primary">Em Outro Nível</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Simplifique agendamentos, controle pagamentos e fidelize atletas com a plataforma mais moderna do mercado.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-in">
              <Button size="lg" className="h-14 px-10 text-lg bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-xl shadow-xl shadow-[#FF6B00]/20 transition-all">
                Entrar na Plataforma
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-[#002B40]/10 text-[#002B40] hover:bg-gray-100 rounded-xl">
              Ver Demonstração
            </Button>
          </div>

          {/* Hero Image Mockup */}
          <div className="mt-16 mx-auto max-w-5xl rounded-xl border bg-card p-2 shadow-2xl">
            <div className="aspect-video rounded-lg bg-muted/50 flex items-center justify-center border border-dashed text-muted-foreground">
              <span className="text-sm">Dashboard Preview Image</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Tudo que você precisa em um só lugar</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Elimine planilhas e cadernos. Tenha total controle da sua operação com ferramentas pensadas para o seu dia a dia.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Calendar className="h-8 w-8 text-primary" />}
              title="Agendamento Inteligente"
              description="Gestão visual de horários, bloqueios recorrentes e lista de espera automatizada."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-8 w-8 text-primary" />}
              title="Controle Financeiro"
              description="Caixa diário, relatórios de faturamento e controle de pagamentos pendentes."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-primary" />}
              title="Gestão de Atletas"
              description="Histórico de jogos, ranking interno e comunicação direta via WhatsApp."
            />
            <FeatureCard
              icon={<Trophy className="h-8 w-8 text-primary" />}
              title="Campeonatos"
              description="Organize torneios, chaves e tabelas de forma simples e rápida."
            />
            <FeatureCard
              icon={<LayoutDashboard className="h-8 w-8 text-primary" />}
              title="Dashboard Completo"
              description="Indicadores de ocupação, receita e retenção em tempo real."
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8 text-primary" />}
              title="Alta Performance"
              description="Sistema rápido, estável e disponível 24/7 para você e seus clientes."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="bg-primary text-primary-foreground rounded-3xl p-12 relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Pronto para transformar sua gestão?</h2>
              <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
                Junte-se a centenas de gestores que já modernizaram suas arenas com o Arena Digital.
              </p>
              <Link href="/sign-in">
                <Button size="lg" variant="secondary" className="h-14 px-10 text-lg font-bold bg-white text-[#FF6B00] hover:bg-gray-100 rounded-xl shadow-xl">
                  Acessar Agora
                </Button>
              </Link>
            </div>

            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-background">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img
              src="/logo_arena_front_bgbranco.png"
              alt="Arena Digital Logo"
              className="h-8 w-auto object-contain"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Arena Digital. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Termos</Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Privacidade</Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Suporte</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-all duration-300 group hover:-translate-y-1">
      <div className="mb-4 p-3 rounded-xl bg-primary/5 w-fit group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
