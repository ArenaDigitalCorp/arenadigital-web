'use client';

import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { ArenaProvider } from '@/contexts/ArenaContext';
import { UserProvider } from '@/contexts/UserContext';
import { NotificationsProvider } from '@/modules/notifications/context/NotificationsContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardSubscriptionGate } from '@/components/dashboard/DashboardSubscriptionGate';
import { WelcomeTutorialDialog } from '@/components/dashboard/WelcomeTutorialDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { Suspense, useState } from 'react';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] flex-col md:flex-row">
      {/* Mobile Menu Wrapper (Sheet) */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 bg-arena-navy-800 border-none w-64">
          <Sidebar
            className="w-full"
            onNavItemClick={() => setIsMobileMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar Sidebar */}
      <div
        className={cn(
          'hidden md:block shrink-0 transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <Sidebar
          className={cn(
            'fixed h-full transition-all duration-300 ease-in-out',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        />
      </div>

      <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out bg-arena-app-surface">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 h-10 w-10 rounded-lg bg-arena-navy-800 text-white shadow-md hover:bg-arena-navy-700 hover:text-white md:hidden"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Abrir menu"
          data-tutorial="mobile-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <main className="flex-1 min-w-0 p-4 pb-24 md:p-6 lg:p-8" data-tutorial="dashboard-main">
          <Suspense fallback={null}>
            <DashboardSubscriptionGate />
          </Suspense>
          {children}
        </main>
        <Suspense fallback={null}>
          <WelcomeTutorialDialog />
        </Suspense>
      </div>
    </div>
  );
}

export function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <SidebarProvider>
        <ArenaProvider>
          <NotificationsProvider>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
          </NotificationsProvider>
        </ArenaProvider>
      </SidebarProvider>
    </UserProvider>
  );
}
