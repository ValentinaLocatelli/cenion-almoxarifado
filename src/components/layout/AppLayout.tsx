import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
        mobileOpen={isMobileSidebarOpen}
        onMobileOpenChange={setIsMobileSidebarOpen}
      />
      <main
        className={cn(
          'pl-0 transition-all duration-300',
          isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <div className="h-14 px-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-semibold">cenion | almoxarifado</span>
          </div>
        </div>
        <div className="p-4 sm:p-5 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
