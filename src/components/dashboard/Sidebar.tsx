"use client"

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    Calendar,
    Medal,
    Settings,
    Star,
    DollarSign,
    ChevronLeft,
    Store,
    RefreshCw,
    ChevronDown,
    Menu,
    Package,
    BarChart2,
    ClipboardList,
    GraduationCap,
    Megaphone,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { UserMenu } from "@/components/auth/UserMenu";
import { Logo } from "@/components/shared/Logo";
import { useSidebar } from "@/contexts/SidebarContext";
import { useArena } from "@/contexts/ArenaContext";
import { useDbUser } from "@/contexts/UserContext";
import { ArenaSelector } from "./ArenaSelector";
import { NotificationsBell } from "@/modules/notifications/components/NotificationsBell";

import { trackNavigation } from "@/lib/telemetry/client";

/** Item ativo do menu — ligado a `--arena-accent` em globals.css */
const navActiveText = "text-arena-accent";

export function Sidebar({ className, onNavItemClick }: { className?: string, onNavItemClick?: () => void }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { isCollapsed, toggleSidebar } = useSidebar();
    const { selectedArena, selectedArenaDetails } = useArena();
    const { dbUser } = useDbUser();

    // Perfis de acesso
    const isCashier = selectedArenaDetails?.role === "Caixa" && !selectedArenaDetails?.isOwner;
    const allowed = (key: string) => selectedArenaDetails?.resources.includes(key) === true;
    const managesArena = selectedArenaDetails?.isOwner || selectedArenaDetails?.role === "Gestor";
    const canManageUsers = managesArena && allowed("settings.users");
    const canManageSubscription = managesArena && allowed("settings.subscription");
    const canManageReceiving = managesArena && allowed("settings.receiving");
    const showSettings = selectedArenaDetails?.isOwner || canManageUsers || canManageSubscription || canManageReceiving || ["settings.arena", "settings.whatsapp", "settings.templates"].some(allowed);
    const hasBookings = ["bookings.single", "bookings.recurring", "bookings.requests"].some(allowed);
    const hasReports = ["reports.customers", "reports.payments", "reports.stations"].some(allowed);

    const publicationsHref = selectedArena ? `/dashboard/publications/${selectedArena}` : "/dashboard/publications";
    const arenaHref = selectedArena ? `/dashboard/arenas/${selectedArena}` : "/dashboard/arenas";
    const stationsHref = selectedArena ? `/dashboard/arenas/${selectedArena}/stations` : "/dashboard/stations";
    const financeHref = selectedArena ? `/dashboard/finance/${selectedArena}` : "/dashboard/finance";
    const productsHref = selectedArena ? `/dashboard/settings/products/${selectedArena}` : "/dashboard/settings/products";
    const loyaltyHref = selectedArena ? `/dashboard/loyalty/${selectedArena}` : "/dashboard/loyalty";
    const rotativoHref = selectedArena ? `/dashboard/rotativo/${selectedArena}` : "/dashboard/rotativo";
    const athletesHref = selectedArena ? `/dashboard/athletes/${selectedArena}` : "/dashboard/athletes";
    const turmasHref = selectedArena ? `/dashboard/turmas/${selectedArena}` : "/dashboard/turmas";
    const mensalistasHref = selectedArena ? `/dashboard/arenas/${selectedArena}/mensalistas` : "/dashboard/arenas";
    const preReservasHref = selectedArena ? `/dashboard/arenas/${selectedArena}/pre-reservas` : "/dashboard/arenas";
    const avulsasHref = selectedArena ? `/dashboard/arenas/${selectedArena}/avulsas` : "/dashboard/arenas";

    const espacosActive = (p: string) =>
        p.startsWith("/dashboard/arenas/") &&
        !p.includes("/stations") &&
        !p.includes("/mensalistas") &&
        !p.includes("/pre-reservas") &&
        !p.includes("/avulsas") &&
        !p.includes("/publications") &&
        !p.includes("/mobile-content") &&
        // Só a edição da própria arena (Perfil da Arena) sai daqui — edição de um
        // espaço específico (/spaces/{id}/edit) continua contando como Espaços.
        !/\/dashboard\/arenas\/[^/]+\/edit$/.test(p);

    const mensalistasActive = (p: string) => p.includes("/mensalistas");

    // Um único bloco de navegação: evita duplicar itens (ex.: dois “Espaços”) e mantém ordem pedida
    const mainNavItems =
        [
            {
                icon: LayoutDashboard,
                label: "Dashboard",
                tutorialKey: "dashboard",
                resource: "dashboard",
                href: "/dashboard",
                isActive: (p: string) => p === "/dashboard",
            },
            {
                icon: Calendar,
                label: "Espaços",
                tutorialKey: "spaces",
                resource: "spaces",
                href: arenaHref,
                isActive: espacosActive,
            },
            {
                icon: Megaphone,
                label: "Publicações",
                tutorialKey: "publications",
                resource: "publications",
                href: publicationsHref,
                isActive: (p: string) => p.startsWith("/dashboard/publications") || p.includes("/mobile-content"),
            },
            {
                icon: Medal,
                label: "Atletas",
                tutorialKey: "athletes",
                resource: "athletes",
                href: athletesHref,
                isActive: (p: string) => p.startsWith("/dashboard/athletes/"),
            },
            {
                icon: GraduationCap,
                label: "Turmas",
                tutorialKey: "turmas",
                resource: "classes",
                href: turmasHref,
                isActive: (p: string) => p.startsWith("/dashboard/turmas/"),
            },
            {
                icon: Store,
                label: isCashier && selectedArenaDetails?.assignedStationId ? "Minha estação" : "Estações",
                tutorialKey: "stations",
                resource: "stations",
                href: isCashier && selectedArenaDetails?.assignedStationId ? stationsHref + "/" + selectedArenaDetails.assignedStationId : stationsHref,
                isActive: (p: string) => p.includes("/stations"),
            },
            {
                icon: Package,
                label: "Catálogo",
                tutorialKey: "catalog",
                resource: "catalog",
                href: productsHref,
                isActive: (p: string) => p.startsWith("/dashboard/settings/products/"),
            },
            {
                icon: RefreshCw,
                label: "Rotativo",
                tutorialKey: "rotativo",
                resource: "rotativo",
                href: rotativoHref,
                isActive: (p: string) => p.startsWith("/dashboard/rotativo/"),
            },
            {
                icon: Star,
                label: "Programa de fidelidade",
                tutorialKey: "loyalty",
                resource: "loyalty",
                href: loyaltyHref,
                isActive: (p: string) => p.startsWith("/dashboard/loyalty/"),
            },
            {
                icon: DollarSign,
                label: "Financeiro",
                tutorialKey: "finance",
                resource: "finance",
                href: allowed("finance.overview") ? financeHref : financeHref + (allowed("finance.cash") ? "/caixa" : "/cadastros-auxiliares"),
                isActive: (p: string) => p.startsWith("/dashboard/finance/"),
            },
        ].filter(item => item.resource === "finance" ? ["finance.overview", "finance.cash", "finance.settings"].some(allowed) : allowed(item.resource));

    const settingsUsersHref = selectedArena ? `/dashboard/settings/users/${selectedArena}` : "/dashboard/settings/users";
    const settingsSubscriptionHref = selectedArena ? `/dashboard/settings/subscription/${selectedArena}` : "/dashboard/settings/subscription";
    const settingsWhatsappHref = selectedArena ? `/dashboard/settings/whatsapp/${selectedArena}` : "/dashboard/settings/whatsapp";
    const settingsTemplatesHref = selectedArena ? `/dashboard/settings/templates-mensagens/${selectedArena}` : "/dashboard/settings/templates-mensagens";
    const reportsHref = selectedArena ? `/dashboard/reports/${selectedArena}/status-pagamentos` : "/dashboard/reports";

    const isEditingArena = !!pathname.match(/\/dashboard\/arenas\/[^\/]+\/edit$/);
    const isReceivingActive = isEditingArena && canManageReceiving && (searchParams.get("tab") === "receiving" || !allowed("settings.arena"));
    const isSettingsActive = (pathname.includes("/settings") && !pathname.startsWith("/dashboard/settings/products")) || isEditingArena;
    const isReportsActive = pathname.startsWith("/dashboard/reports/");
    const isBookingsActive = pathname.includes("/mensalistas") || pathname.includes("/pre-reservas") || pathname.includes("/avulsas");
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(isSettingsActive);
    const [isReportsOpen, setIsReportsOpen] = useState<boolean>(isReportsActive);
    const [isBookingsOpen, setIsBookingsOpen] = useState<boolean>(isBookingsActive);
    const shouldShowSettingsOpen = !isCollapsed && (isSettingsOpen || isSettingsActive);
    const shouldShowReportsOpen = !isCollapsed && (isReportsOpen || isReportsActive);
    const shouldShowBookingsOpen = !isCollapsed && (isBookingsOpen || isBookingsActive);

    return (
        <div className={cn(
            "flex min-h-screen flex-col bg-arena-navy-800 text-white transition-all duration-300 ease-in-out",
            isCollapsed ? "w-20" : "w-64",
            className
        )}>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                <div className="space-y-4 py-6">
                <div className={cn("px-4 py-2 transition-all duration-300", isCollapsed ? "px-2" : "px-6")}>
                    <div className={cn(
                        "flex transition-all duration-300",
                        isCollapsed
                            ? "mb-6 flex-col items-center gap-2"
                            : "mb-10 items-center justify-between"
                    )}>
                        {!isCollapsed && <Logo className="scale-75 origin-left" />}
                        <div className={cn("flex items-center", isCollapsed ? "flex-col gap-2" : "gap-1")}>
                            {["dashboard", "rotativo", "bookings.single"].some(allowed) && <NotificationsBell isCollapsed={isCollapsed} />}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleSidebar}
                                className={cn(
                                    "cursor-pointer text-white/50 hover:text-white hover:bg-white/10 md:flex hidden",
                                    isCollapsed && "h-10 w-10 shrink-0 rounded-md",
                                )}
                            >
                                {isCollapsed ? (
                                    <Menu className="h-6 w-6" />
                                ) : (
                                    <ChevronLeft className="h-6 w-6" />
                                )}
                            </Button>
                        </div>
                    </div>

                    <ArenaSelector isCollapsed={isCollapsed} />

                    <div className={cn(
                        "space-y-2",
                        isCollapsed && "flex flex-col items-center gap-2 space-y-0",
                    )} data-tutorial="sidebar-navigation">
                        {mainNavItems.map((item) => {
                            const isActive = item.isActive(pathname);

                            return (
                                <Button
                                    key={item.label}
                                    variant="ghost"
                                    className={cn(
                                        "transition-colors flex items-center rounded-md",
                                        isCollapsed
                                            ? cn(
                                                  "h-10 w-10 shrink-0 justify-center p-0",
                                                  isActive
                                                      ? cn(navActiveText, "bg-white/10 hover:bg-white/15")
                                                      : "text-white hover:bg-white/10 hover:text-white",
                                              )
                                            : cn(
                                                  "w-full gap-1.5 justify-start text-white hover:bg-white/10 hover:text-white",
                                                  isActive &&
                                                      cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent"),
                                              ),
                                    )}
                                    asChild
                                    onClick={onNavItemClick}
                                >
                                    <Link
                                        href={item.href}
                                        title={isCollapsed ? item.label : ""}
                                        data-tutorial-menu={item.tutorialKey}
                                        className={cn(isCollapsed && "flex size-full items-center justify-center")}
                                    >
                                        <item.icon className={cn(
                                            "h-5 w-5 transition-all duration-300",
                                            !isCollapsed && "mr-2",
                                            isActive && navActiveText
                                        )} />
                                        {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                                    </Link>
                                </Button>
                            );
                        })}

                        {hasBookings && (
                        <div>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "cursor-pointer transition-colors flex items-center rounded-md",
                                    isCollapsed
                                        ? cn(
                                              "h-10 w-10 shrink-0 justify-center p-0",
                                              isBookingsActive
                                                  ? cn(navActiveText, "bg-white/10 hover:bg-white/15")
                                                  : "text-white hover:bg-white/10 hover:text-white",
                                          )
                                        : cn(
                                              "w-full justify-between px-3 text-white hover:bg-white/10 hover:text-white",
                                              isBookingsActive &&
                                                  cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent"),
                                          ),
                                )}
                                onClick={() => !isCollapsed && setIsBookingsOpen(!isBookingsOpen)}
                                title={isCollapsed ? "Gestão Reservas" : ""}
                                data-tutorial-menu="memberships"
                            >
                                <div
                                    className={cn(
                                        "flex items-center gap-1.5",
                                        isCollapsed ? "size-full justify-center" : "min-w-0 flex-1",
                                    )}
                                >
                                    <ClipboardList className={cn("h-5 w-5 shrink-0", !isCollapsed && "mr-2")} />
                                    {!isCollapsed && <span className="font-medium text-sm">Gestão Reservas</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 shrink-0 transition-transform duration-200",
                                            isBookingsActive ? navActiveText : "text-white",
                                            shouldShowBookingsOpen && "rotate-180"
                                        )}
                                    />
                                )}
                            </Button>

                            {shouldShowBookingsOpen && (
                                <div className="mt-0.5 flex items-stretch gap-2 pl-3">
                                    <div
                                        className="flex w-5 shrink-0 flex-col items-center py-1"
                                        aria-hidden
                                    >
                                        <div className="min-h-5 w-px flex-1 rounded-full bg-white/15" />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        {allowed("bookings.single") && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                pathname.includes("/avulsas")
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={avulsasHref}>Avulsos</Link>
                                        </Button>)}
                                        {allowed("bookings.recurring") && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                mensalistasActive(pathname)
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={mensalistasHref}>Mensalistas</Link>
                                        </Button>)}
                                        {allowed("bookings.requests") && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                pathname.includes("/pre-reservas")
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={preReservasHref}>Pré-reservas</Link>
                                        </Button>)}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {hasReports && (
                        <div>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "cursor-pointer transition-colors flex items-center rounded-md",
                                    isCollapsed
                                        ? cn(
                                              "h-10 w-10 shrink-0 justify-center p-0",
                                              isReportsActive
                                                  ? cn(navActiveText, "bg-white/10 hover:bg-white/15")
                                                  : "text-white hover:bg-white/10 hover:text-white",
                                          )
                                        : cn(
                                              "w-full justify-between px-3 text-white hover:bg-white/10 hover:text-white",
                                              isReportsActive &&
                                                  cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent"),
                                          ),
                                )}
                                onClick={() => !isCollapsed && setIsReportsOpen(!isReportsOpen)}
                                title={isCollapsed ? "Relatórios" : ""}
                                data-tutorial-menu="reports"
                            >
                                <div
                                    className={cn(
                                        "flex items-center gap-1.5",
                                        isCollapsed ? "size-full justify-center" : "min-w-0 flex-1",
                                    )}
                                >
                                    <BarChart2 className={cn("h-5 w-5 shrink-0", !isCollapsed && "mr-2")} />
                                    {!isCollapsed && <span className="font-medium text-sm">Relatórios</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 shrink-0 transition-transform duration-200",
                                            isReportsActive ? navActiveText : "text-white",
                                            shouldShowReportsOpen && "rotate-180"
                                        )}
                                    />
                                )}
                            </Button>

                            {shouldShowReportsOpen && (
                                <div className="mt-0.5 flex items-stretch gap-2 pl-3">
                                    <div
                                        className="flex w-5 shrink-0 flex-col items-center py-1"
                                        aria-hidden
                                    >
                                        <div className="min-h-5 w-px flex-1 rounded-full bg-white/15" />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        {allowed("reports.customers") && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                pathname.includes("clientes-overview")
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={() => {
                                                trackNavigation("Atletas e clientes", selectedArena ? `/dashboard/reports/${selectedArena}/clientes-overview` : "/dashboard/reports");
                                                onNavItemClick?.();
                                            }}
                                        >
                                            <Link href={selectedArena ? `/dashboard/reports/${selectedArena}/clientes-overview` : "/dashboard/reports"}>
                                                Atletas e clientes
                                            </Link>
                                        </Button>)}
                                        {allowed("reports.payments") && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                pathname.startsWith("/dashboard/reports/") && pathname.includes("status-pagamentos")
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={reportsHref}>Pagamentos Reservas</Link>
                                        </Button>)}
                                        {allowed("reports.stations") && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                pathname.includes("movimentacao-estacoes")
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={selectedArena ? `/dashboard/reports/${selectedArena}/movimentacao-estacoes` : "/dashboard/reports"}>
                                                Movimentação Estações
                                            </Link>
                                        </Button>)}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {showSettings && (
                        <div>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "cursor-pointer transition-colors flex items-center rounded-md",
                                    isCollapsed
                                        ? cn(
                                              "h-10 w-10 shrink-0 justify-center p-0",
                                              isSettingsActive
                                                  ? cn(navActiveText, "bg-white/10 hover:bg-white/15")
                                                  : "text-white hover:bg-white/10 hover:text-white",
                                          )
                                        : cn(
                                              "w-full justify-between px-3 text-white hover:bg-white/10 hover:text-white",
                                              isSettingsActive &&
                                                  cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent"),
                                          ),
                                )}
                                onClick={() => !isCollapsed && setIsSettingsOpen(!isSettingsOpen)}
                                title={isCollapsed ? "Configurações" : ""}
                                data-tutorial-menu="settings"
                            >
                                <div
                                    className={cn(
                                        "flex items-center gap-1.5",
                                        isCollapsed ? "size-full justify-center" : "min-w-0 flex-1",
                                    )}
                                >
                                    <Settings className={cn("h-5 w-5 shrink-0", !isCollapsed && "mr-2")} />
                                    {!isCollapsed && <span className="font-medium text-sm">Configurações</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 shrink-0 transition-transform duration-200",
                                            isSettingsActive ? navActiveText : "text-white",
                                            shouldShowSettingsOpen && "rotate-180"
                                        )}
                                    />
                                )}
                            </Button>

                            {shouldShowSettingsOpen && (
                                <div className="mt-0.5 flex items-stretch gap-2 pl-3">
                                    <div
                                        className="flex w-5 shrink-0 flex-col items-center py-1"
                                        aria-hidden
                                    >
                                        <div className="min-h-5 w-px flex-1 rounded-full bg-white/15" />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        {selectedArenaDetails?.isOwner && (
                                            <Button variant="ghost" asChild onClick={onNavItemClick}
                                                className={cn("h-9 w-full justify-start px-2 text-sm font-normal", pathname.startsWith("/dashboard/settings/profiles") ? navActiveText : "text-white")}>
                                                <Link href={`/dashboard/settings/profiles/${selectedArena}`}>Perfis e permissões</Link>
                                            </Button>
                                        )}
                                        {canManageUsers && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                pathname.startsWith("/dashboard/settings/users")
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={settingsUsersHref}>
                                                Usuários
                                            </Link>
                                        </Button>)}

                                        {canManageSubscription && (
                                            <Button
                                                variant="ghost"
                                                asChild
                                                className={cn(
                                                    "h-9 w-full justify-start px-2 text-sm font-normal",
                                                    pathname.startsWith("/dashboard/settings/subscription")
                                                        ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                        : "text-white hover:bg-white/5 hover:text-white"
                                                )}
                                                onClick={onNavItemClick}
                                            >
                                                <Link href={settingsSubscriptionHref}>
                                                    Assinatura
                                                </Link>
                                            </Button>
                                        )}

                                        {allowed("settings.arena") && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                (pathname.startsWith("/dashboard/settings/arenas") || (isEditingArena && !isReceivingActive))
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href="/dashboard/settings/arenas">
                                                Perfil da Arena
                                            </Link>
                                        </Button>)}

                                        {canManageReceiving && (
                                            <Button variant="ghost" asChild onClick={onNavItemClick}
                                                className={cn("h-9 w-full justify-start px-2 text-sm font-normal", isReceivingActive ? navActiveText : "text-white")}>
                                                <Link href={`/dashboard/arenas/${selectedArena}/edit?tab=receiving`}>Dados de recebimento</Link>
                                            </Button>
                                        )}

                                        {allowed("settings.whatsapp") && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                pathname.startsWith("/dashboard/settings/whatsapp")
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={settingsWhatsappHref}>
                                                WhatsApp
                                            </Link>
                                        </Button>)}

                                        {allowed("settings.templates") && (<Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                pathname.startsWith("/dashboard/settings/templates-mensagens")
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={settingsTemplatesHref}>
                                                Templates Mensagens
                                            </Link>
                                        </Button>)}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}
                    </div>
                </div>
                </div>
            </div>

            <div className="mt-auto shrink-0 border-t border-white/10">
                <div
                    className={cn(
                        "py-4",
                        isCollapsed ? "px-2" : "px-4",
                    )}
                >
                    <UserMenu
                        showName={!isCollapsed}
                        accountHref={canManageUsers ? settingsUsersHref : undefined}
                        platformAccessLevel={dbUser?.platform_access_level ?? null}
                        className={isCollapsed ? "justify-center px-0" : undefined}
                    />
                </div>
                {!isCollapsed && (
                    <div className="px-6 pb-4 text-[10px] text-white/30 whitespace-nowrap">
                        Arena Digital © 2026
                    </div>
                )}
            </div>
        </div>
    );
}
