"use client"

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    MapPin,
    Settings,
    Trophy,
    Users,
    CreditCard,
    ChevronLeft,
    Store,
    Activity,
    ChevronDown,
    Menu,
    Package,
    BarChart2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/shared/Logo";
import { useSidebar } from "@/contexts/SidebarContext";
import { useArena } from "@/contexts/ArenaContext";
import { ArenaSelector } from "./ArenaSelector";

export function Sidebar({ className, onNavItemClick }: { className?: string, onNavItemClick?: () => void }) {
    const pathname = usePathname();
    const { isCollapsed, toggleSidebar } = useSidebar();
    const { selectedArena, selectedArenaDetails } = useArena();
    const isCashier = selectedArenaDetails?.role === "Caixa" && !selectedArenaDetails?.isOwner;
    const canAccessSubscription =
        Boolean(selectedArenaDetails?.isOwner) || selectedArenaDetails?.role === "Gestor";
    const arenaHref = selectedArena ? `/dashboard/arenas/${selectedArena}` : "/dashboard/arenas";
    const stationsHref = selectedArena ? `/dashboard/arenas/${selectedArena}/stations` : "/dashboard/stations";
    const financeHref = selectedArena ? `/dashboard/finance/${selectedArena}` : "/dashboard/finance";
    const productsHref = selectedArena ? `/dashboard/settings/products/${selectedArena}` : "/dashboard/settings/products";
    const loyaltyHref = selectedArena ? `/dashboard/loyalty/${selectedArena}` : "/dashboard/loyalty";
    const rotativoHref = selectedArena ? `/dashboard/rotativo/${selectedArena}` : "/dashboard/rotativo";
    const athletesHref = selectedArena ? `/dashboard/athletes/${selectedArena}` : "/dashboard/athletes";

    const cashierItems = isCashier && selectedArenaDetails?.assignedStationId ? [
        {
            icon: Store,
            label: "Minha estação",
            href: `/dashboard/arenas/${selectedArena}/stations/${selectedArenaDetails.assignedStationId}`,
            isActive: (p: string) => p.includes(`/dashboard/arenas/${selectedArena}/stations/`),
        },
    ] : null;

    const topItems = cashierItems ?? [
        {
            icon: LayoutDashboard,
            label: "Dashboard",
            href: "/dashboard",
            isActive: (p: string) => p === "/dashboard",
        },
        {
            icon: Users,
            label: "Atletas",
            href: athletesHref,
            isActive: (p: string) => p.startsWith("/dashboard/athletes/"),
        },
    ];

    const bottomItems = cashierItems ? [] : [
        {
            icon: Store,
            label: "Estações",
            href: stationsHref,
            isActive: (p: string) => p.includes("/stations"),
        },
        {
            icon: Package,
            label: "Produtos",
            href: productsHref,
            isActive: (p: string) => p.startsWith("/dashboard/settings/products/"),
        },
        {
            icon: CreditCard,
            label: "Financeiro",
            href: financeHref,
            isActive: (p: string) => p.startsWith("/dashboard/finance/"),
        },
        {
            icon: Trophy,
            label: "Programa de fidelidade",
            href: loyaltyHref,
            isActive: (p: string) => p.startsWith("/dashboard/loyalty/"),
        },
        {
            icon: Activity,
            label: "Rotativo",
            href: rotativoHref,
            isActive: (p: string) => p.startsWith("/dashboard/rotativo/"),
        },
    ];

    const settingsUsersHref = selectedArena ? `/dashboard/settings/users/${selectedArena}` : "/dashboard/settings/users";
    const settingsSubscriptionHref = selectedArena ? `/dashboard/settings/subscription/${selectedArena}` : "/dashboard/settings/subscription";
    const reportsHref = selectedArena ? `/dashboard/reports/${selectedArena}/status-pagamentos` : "/dashboard/reports";

    const mensalistasHref = selectedArena ? `/dashboard/arenas/${selectedArena}/mensalistas` : "/dashboard/arenas";

    const isEditingArena = !!pathname.match(/\/dashboard\/arenas\/[^\/]+\/edit$/);
    const isSettingsActive = (pathname.includes("/settings") && !pathname.startsWith("/dashboard/settings/products")) || isEditingArena;
    const isEspacosActive = pathname.startsWith("/dashboard/arenas/") && !pathname.includes("/stations") && !pathname.endsWith("/edit");
    const isReportsActive = pathname.startsWith("/dashboard/reports/");

    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(isSettingsActive);
    const [isEspacosOpen, setIsEspacosOpen] = useState<boolean>(isEspacosActive);
    const [isReportsOpen, setIsReportsOpen] = useState<boolean>(isReportsActive);
    const shouldShowSettingsOpen = !isCollapsed && (isSettingsOpen || isSettingsActive);
    const shouldShowEspacosOpen = !isCollapsed && (isEspacosOpen || isEspacosActive);
    const shouldShowReportsOpen = !isCollapsed && (isReportsOpen || isReportsActive);

    return (
        <div className={cn(
            "pb-12 min-h-screen bg-[#002B40] text-white transition-all duration-300 ease-in-out relative flex flex-col",
            isCollapsed ? "w-20" : "w-64",
            className
        )}>
            <div className="space-y-4 py-6 flex-1 overflow-x-hidden">
                <div className={cn("px-4 py-2 transition-all duration-300", isCollapsed ? "px-2" : "px-6")}>
                    <div className={cn(
                        "flex items-center mb-10 transition-all duration-300",
                        isCollapsed ? "justify-center" : "justify-between"
                    )}>
                        {!isCollapsed && <Logo className="scale-75 origin-left" />}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSidebar}
                            className="text-white/50 hover:text-white hover:bg-white/10 md:flex hidden"
                        >
                            {isCollapsed ? (
                                <Menu className="h-6 w-6" />
                            ) : (
                                <ChevronLeft className="h-6 w-6" />
                            )}
                        </Button>
                    </div>

                    <ArenaSelector isCollapsed={isCollapsed} />

                    <div className="space-y-2">
                        {topItems.map((item) => {
                            const isActive = item.isActive(pathname);

                            return (
                                <Button
                                    key={item.href}
                                    variant="ghost"
                                    className={cn(
                                        "w-full transition-colors flex items-center",
                                        isCollapsed ? "justify-center px-0" : "justify-start text-white/70 hover:text-white hover:bg-white/10",
                                        isActive && !isCollapsed && "text-[#FFC145] bg-white/5",
                                        isActive && isCollapsed && "text-[#FFC145] bg-white/10"
                                    )}
                                    asChild
                                    onClick={onNavItemClick}
                                >
                                    <Link href={item.href} title={isCollapsed ? item.label : ""}>
                                        <item.icon className={cn(
                                            "h-5 w-5 transition-all duration-300",
                                            !isCollapsed && "mr-3",
                                            isActive && "text-[#FFC145]"
                                        )} />
                                        {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                                    </Link>
                                </Button>
                            );
                        })}

                        {!isCashier && (
                        <div className="pt-2">
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full transition-colors flex items-center",
                                    isCollapsed ? "justify-center px-0" : "justify-between text-white/70 hover:text-white hover:bg-white/10",
                                    isEspacosActive && "text-[#FFC145] bg-white/5"
                                )}
                                onClick={() => !isCollapsed && setIsEspacosOpen(!isEspacosOpen)}
                                title={isCollapsed ? "Espaços" : ""}
                            >
                                <div className="flex items-center">
                                    <MapPin className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                                    {!isCollapsed && <span className="font-medium text-sm">Espaços</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 opacity-50 transition-transform duration-200",
                                            shouldShowEspacosOpen && "transform rotate-180"
                                        )}
                                    />
                                )}
                            </Button>

                            {shouldShowEspacosOpen && (
                                <div className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-2">
                                    <Button
                                        variant="ghost"
                                        asChild
                                        className={cn(
                                            "w-full justify-start h-9 text-sm font-normal",
                                            (isEspacosActive && !pathname.includes("/mensalistas"))
                                                ? "text-[#FFC145] bg-white/5"
                                                : "text-white/60 hover:text-white hover:bg-white/5"
                                        )}
                                        onClick={onNavItemClick}
                                    >
                                        <Link href={arenaHref}>Espaços</Link>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        asChild
                                        className={cn(
                                            "w-full justify-start h-9 text-sm font-normal",
                                            pathname.includes("/mensalistas")
                                                ? "text-[#FFC145] bg-white/5"
                                                : "text-white/60 hover:text-white hover:bg-white/5"
                                        )}
                                        onClick={onNavItemClick}
                                    >
                                        <Link href={mensalistasHref}>Mensalistas</Link>
                                    </Button>
                                </div>
                            )}
                        </div>
                        )}

                        {bottomItems.map((item) => {
                            const isActive = item.isActive(pathname);

                            return (
                                <Button
                                    key={item.href}
                                    variant="ghost"
                                    className={cn(
                                        "w-full transition-colors flex items-center",
                                        isCollapsed ? "justify-center px-0" : "justify-start text-white/70 hover:text-white hover:bg-white/10",
                                        isActive && !isCollapsed && "text-[#FFC145] bg-white/5",
                                        isActive && isCollapsed && "text-[#FFC145] bg-white/10"
                                    )}
                                    asChild
                                    onClick={onNavItemClick}
                                >
                                    <Link href={item.href} title={isCollapsed ? item.label : ""}>
                                        <item.icon className={cn(
                                            "h-5 w-5 transition-all duration-300",
                                            !isCollapsed && "mr-3",
                                            isActive && "text-[#FFC145]"
                                        )} />
                                        {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                                    </Link>
                                </Button>
                            );
                        })}

                        {!isCashier && (
                        <div className="pt-2">
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full transition-colors flex items-center",
                                    isCollapsed ? "justify-center px-0" : "justify-between text-white/70 hover:text-white hover:bg-white/10",
                                    isReportsActive && "text-[#FFC145] bg-white/5"
                                )}
                                onClick={() => !isCollapsed && setIsReportsOpen(!isReportsOpen)}
                                title={isCollapsed ? "Relatórios" : ""}
                            >
                                <div className="flex items-center">
                                    <BarChart2 className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                                    {!isCollapsed && <span className="font-medium text-sm">Relatórios</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 opacity-50 transition-transform duration-200",
                                            shouldShowReportsOpen && "transform rotate-180"
                                        )}
                                    />
                                )}
                            </Button>

                            {shouldShowReportsOpen && (
                                <div className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-2">
                                    <Button
                                        variant="ghost"
                                        asChild
                                        className={cn(
                                            "w-full justify-start h-9 text-sm font-normal",
                                            pathname.startsWith("/dashboard/reports/") && pathname.includes("status-pagamentos")
                                                ? "text-[#FFC145] bg-white/5"
                                                : "text-white/60 hover:text-white hover:bg-white/5"
                                        )}
                                        onClick={onNavItemClick}
                                    >
                                        <Link href={reportsHref}>Status Pagamentos</Link>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        asChild
                                        className={cn(
                                            "w-full justify-start h-9 text-sm font-normal",
                                            pathname.includes("clientes-overview")
                                                ? "text-[#FFC145] bg-white/5"
                                                : "text-white/60 hover:text-white hover:bg-white/5"
                                        )}
                                        onClick={onNavItemClick}
                                    >
                                        <Link href={selectedArena ? `/dashboard/reports/${selectedArena}/clientes-overview` : "/dashboard/reports"}>
                                            Clientes — Overview
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </div>
                        )}

                        {!isCashier && (
                        <div className="pt-2">
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full transition-colors flex items-center",
                                    isCollapsed ? "justify-center px-0" : "justify-between text-white/70 hover:text-white hover:bg-white/10",
                                    isSettingsActive && "text-[#FFC145] bg-white/5"
                                )}
                                onClick={() => !isCollapsed && setIsSettingsOpen(!isSettingsOpen)}
                                title={isCollapsed ? "Configurações" : ""}
                            >
                                <div className="flex items-center">
                                    <Settings className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                                    {!isCollapsed && <span className="font-medium text-sm">Configurações</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 opacity-50 transition-transform duration-200",
                                            shouldShowSettingsOpen && "transform rotate-180"
                                        )}
                                    />
                                )}
                            </Button>

                            {shouldShowSettingsOpen && (
                                <div className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-2">
                                    <Button
                                        variant="ghost"
                                        asChild
                                        className={cn(
                                            "w-full justify-start h-9 text-sm font-normal",
                                            (pathname.startsWith("/dashboard/settings/arenas") || isEditingArena)
                                                ? "text-[#FFC145] bg-white/5"
                                                : "text-white/60 hover:text-white hover:bg-white/5"
                                        )}
                                        onClick={onNavItemClick}
                                    >
                                        <Link href="/dashboard/settings/arenas">
                                            Arena
                                        </Link>
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        asChild
                                        className={cn(
                                            "w-full justify-start h-9 text-sm font-normal",
                                            pathname.startsWith("/dashboard/settings/users")
                                                ? "text-[#FFC145] bg-white/5"
                                                : "text-white/60 hover:text-white hover:bg-white/5"
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
                                                "w-full justify-start h-9 text-sm font-normal",
                                                pathname.startsWith("/dashboard/settings/subscription")
                                                    ? "text-[#FFC145] bg-white/5"
                                                    : "text-white/60 hover:text-white hover:bg-white/5"
                                            )}
                                            onClick={onNavItemClick}
                                        >
                                            <Link href={settingsSubscriptionHref}>
                                                Assinatura
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                        )}
                    </div>
                </div>
            </div>

            {!isCollapsed && (
                <div className="absolute bottom-6 left-6 text-[10px] text-white/30 whitespace-nowrap">
                    Arena Digital © 2025
                </div>
            )}
        </div>
    );
}
