"use client"

import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { cn } from "@/lib/utils";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const { isCollapsed } = useSidebar();

    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <div
                className={cn(
                    "hidden md:block shrink-0 transition-all duration-300 ease-in-out",
                    isCollapsed ? "w-20" : "w-64"
                )}
            >
                <Sidebar
                    className={cn(
                        "fixed h-full transition-all duration-300 ease-in-out",
                        isCollapsed ? "w-20" : "w-64"
                    )}
                />
            </div>

            <div
                className="flex-1 flex flex-col transition-all duration-300 ease-in-out bg-[#F8F9FA]"
            >
                <Header />
                <main className="flex-1 p-4 md:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <DashboardLayoutContent>
                {children}
            </DashboardLayoutContent>
        </SidebarProvider>
    );
}
