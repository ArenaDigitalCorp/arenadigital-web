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
    ClipboardPen,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { UserMenu } from "@/components/auth/UserMenu";
import { Logo } from "@/components/shared/Logo";
import { useSidebar } from "@/contexts/SidebarContext";
import { useArena } from "@/contexts/ArenaContext";
import { ArenaSelector } from "./ArenaSelector";

/** Item ativo do menu — ligado a `--arena-accent` em globals.css */
const navActiveText = "text-arena-accent";

export function Sidebar({ className, onNavItemClick }: { className?: string, onNavItemClick?: () => void }) {
    const pathname = usePathname();
    const { user } = useUser();
    const { isCollapsed, toggleSidebar } = useSidebar();
    const { selectedArena, selectedArenaDetails } = useArena();

    // Perfis de acesso
    const isCashier = selectedArenaDetails?.role === "Caixa" && !selectedArenaDetails?.isOwner;
    const isAdmin = selectedArenaDetails?.isOwner || selectedArenaDetails?.role === "Gestor";
    const canAccessSubscription = Boolean(isAdmin);

    const arenaHref = selectedArena ? `/dashboard/arenas/${selectedArena}` : "/dashboard/arenas";
    const stationsHref = selectedArena ? `/dashboard/arenas/${selectedArena}/stations` : "/dashboard/stations";
    const financeHref = selectedArena ? `/dashboard/finance/${selectedArena}` : "/dashboard/finance";
    const productsHref = selectedArena ? `/dashboard/settings/products/${selectedArena}` : "/dashboard/settings/products";
    const loyaltyHref = selectedArena ? `/dashboard/loyalty/${selectedArena}` : "/dashboard/loyalty";
    const rotativoHref = selectedArena ? `/dashboard/rotativo/${selectedArena}` : "/dashboard/rotativo";
    const athletesHref = selectedArena ? `/dashboard/athletes/${selectedArena}` : "/dashboard/athletes";
    const mensalistasHref = selectedArena ? `/dashboard/arenas/${selectedArena}/mensalistas` : "/dashboard/arenas";

    // Caixa com estação atribuída → apenas "Minha Estação"
    const cashierWithStation = isCashier && selectedArenaDetails?.assignedStationId ? [
        {
            icon: Store,
            label: "Minha estação",
            href: `/dashboard/arenas/${selectedArena}/stations/${selectedArenaDetails.assignedStationId}`,
            isActive: (p: string) => p.includes(`/dashboard/arenas/${selectedArena}/stations/`),
        },
    ] : null;

    // Caixa sem estação atribuída → apenas menu "Estações"
    const cashierWithoutStation = isCashier && !selectedArenaDetails?.assignedStationId ? [
        {
            icon: Store,
            label: "Estações",
            href: stationsHref,
            isActive: (p: string) => p.includes("/stations"),
        },
    ] : null;

    // Item de menu efetivo para caixa
    const cashierItems = cashierWithStation ?? cashierWithoutStation;

    const espacosActive = (p: string) =>
        p.startsWith("/dashboard/arenas/") &&
        !p.includes("/stations") &&
        !p.includes("/mensalistas") &&
        !p.endsWith("/edit");

    const mensalistasActive = (p: string) => p.includes("/mensalistas");

    // Um único bloco de navegação: evita duplicar itens (ex.: dois “Espaços”) e mantém ordem pedida
    const mainNavItems =
        cashierItems ??
        [
            {
                icon: LayoutDashboard,
                label: "Dashboard",
                href: "/dashboard",
                isActive: (p: string) => p === "/dashboard",
            },
            {
                icon: Calendar,
                label: "Espaços",
                href: arenaHref,
                isActive: espacosActive,
            },
            {
                icon: Medal,
                label: "Atletas",
                href: athletesHref,
                isActive: (p: string) => p.startsWith("/dashboard/athletes/"),
            },
            {
                icon: Store,
                label: "Estações",
                href: stationsHref,
                isActive: (p: string) => p.includes("/stations"),
            },
            {
                icon: Package,
                label: "Catálogo",
                href: productsHref,
                isActive: (p: string) => p.startsWith("/dashboard/settings/products/"),
            },
            {
                icon: ClipboardPen,
                label: "Mensalistas",
                href: mensalistasHref,
                isActive: mensalistasActive,
            },
            {
                icon: RefreshCw,
                label: "Rotativo",
                href: rotativoHref,
                isActive: (p: string) => p.startsWith("/dashboard/rotativo/"),
            },
            {
                icon: Star,
                label: "Programa de fidelidade",
                href: loyaltyHref,
                isActive: (p: string) => p.startsWith("/dashboard/loyalty/"),
            },
            {
                icon: DollarSign,
                label: "Financeiro",
                href: financeHref,
                isActive: (p: string) => p.startsWith("/dashboard/finance/"),
            },
        ];

    const settingsUsersHref = selectedArena ? `/dashboard/settings/users/${selectedArena}` : "/dashboard/settings/users";
    const settingsSubscriptionHref = selectedArena ? `/dashboard/settings/subscription/${selectedArena}` : "/dashboard/settings/subscription";
    const reportsHref = selectedArena ? `/dashboard/reports/${selectedArena}/status-pagamentos` : "/dashboard/reports";

    const isEditingArena = !!pathname.match(/\/dashboard\/arenas\/[^\/]+\/edit$/);
    const isSettingsActive = (pathname.includes("/settings") && !pathname.startsWith("/dashboard/settings/products")) || isEditingArena;
    const isReportsActive = pathname.startsWith("/dashboard/reports/");

    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(isSettingsActive);
    const [isReportsOpen, setIsReportsOpen] = useState<boolean>(isReportsActive);
    const shouldShowSettingsOpen = !isCollapsed && (isSettingsOpen || isSettingsActive);
    const shouldShowReportsOpen = !isCollapsed && (isReportsOpen || isReportsActive);

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
                        "flex items-center transition-all duration-300",
                        isCollapsed ? "mb-6 justify-center" : "mb-10 justify-between"
                    )}>
                        {!isCollapsed && <Logo className="scale-75 origin-left" />}
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

                    <ArenaSelector isCollapsed={isCollapsed} />

                    <div className={cn(
                        "space-y-2",
                        isCollapsed && "flex flex-col items-center gap-2 space-y-0",
                    )}>
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

                        {!isCashier && (
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
                                        <Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                pathname.includes("clientes-overview")
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={selectedArena ? `/dashboard/reports/${selectedArena}/clientes-overview` : "/dashboard/reports"}>
                                                Atletas e clientes
                                            </Link>
                                        </Button>
                                        <Button
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
                                            <Link href={reportsHref}>Pagamentos</Link>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {!isCashier && isAdmin && (
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
                                        <Button
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
                                        </Button>

                                        {canAccessSubscription && (
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

                                        <Button
                                            variant="ghost"
                                            asChild
                                            className={cn(
                                                "h-9 w-full justify-start px-2 text-sm font-normal",
                                                (pathname.startsWith("/dashboard/settings/arenas") || isEditingArena)
                                                    ? cn(navActiveText, "bg-white/5 hover:bg-white/10 hover:text-arena-accent")
                                                    : "text-white hover:bg-white/5 hover:text-white"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href="/dashboard/settings/arenas">
                                                Perfil da Arena
                                            </Link>
                                        </Button>
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
                        "flex py-4",
                        isCollapsed ? "justify-center px-2" : "items-center gap-3 px-6",
                    )}
                >
                    <UserMenu />
                    {!isCollapsed && (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">
                            {(() => {
                                const meta = user?.user_metadata ?? {}
                                const firstName = typeof meta.firstName === 'string' ? meta.firstName.trim() : ''
                                return firstName || user?.email || 'Minha conta'
                            })()}
                        </span>
                    )}
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
