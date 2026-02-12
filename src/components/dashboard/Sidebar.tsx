"use client"

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Calendar,
    LayoutDashboard,
    MapPin,
    Settings,
    Trophy,
    Users,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    Store,
    Activity,
    ChevronDown,
    Menu
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/shared/Logo";
import { useSidebar } from "@/contexts/SidebarContext";

const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: MapPin, label: "Arena", href: "/dashboard/arenas" },
    { icon: CreditCard, label: "Financeiro", href: "/dashboard/finance" },
    { icon: Store, label: "Estações", href: "/dashboard/stations" },
    { icon: Trophy, label: "Programa de fidelidade", href: "/dashboard/loyalty" },
    { icon: Users, label: "Atletas", href: "/dashboard/athletes" },
];

export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname();
    const { isCollapsed, toggleSidebar } = useSidebar();

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
                            className="text-white/50 hover:text-white hover:bg-white/10"
                        >
                            {isCollapsed ? (
                                <Menu className="h-6 w-6" />
                            ) : (
                                <ChevronLeft className="h-6 w-6" />
                            )}
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {sidebarItems.map((item) => {
                            let isActive = item.href === "/dashboard"
                                ? pathname === "/dashboard"
                                : pathname.startsWith(item.href);

                            // Special case for Stations:
                            // 1. Make Stations active if path includes /stations
                            if (item.label === "Estações" && pathname.includes("/stations")) {
                                isActive = true;
                            }

                            // 2. Prevent Arena from being active if path includes /stations (to avoid double highlight)
                            if (item.label === "Arena" && pathname.includes("/stations")) {
                                isActive = false;
                            }

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

                        <div className="pt-2">
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full transition-colors flex items-center",
                                    isCollapsed ? "justify-center px-0" : "justify-between text-white/70 hover:text-white hover:bg-white/10"
                                )}
                                title={isCollapsed ? "Configurações" : ""}
                            >
                                <div className="flex items-center">
                                    <Settings className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                                    {!isCollapsed && <span className="font-medium text-sm">Configurações</span>}
                                </div>
                                {!isCollapsed && <ChevronDown className="h-4 w-4 opacity-50" />}
                            </Button>
                        </div>
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
