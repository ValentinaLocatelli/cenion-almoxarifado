import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  LogIn,
  LogOut as LogOutIcon,
  Package,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Battery,
  Zap,
  Settings,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUnit } from '@/contexts/ActiveUnitContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  managerOnly?: boolean;
  adminOnly?: boolean;
  requiresUsersAccess?: boolean;
  requiresBusinessUnitsAccess?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Entrada', href: '/entrada', icon: LogIn },
  { label: 'Saída', href: '/saida', icon: LogOutIcon },
  { label: 'Itens', href: '/itens', icon: Package },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function Sidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen = false,
  onMobileOpenChange,
}: SidebarProps) {
  const location = useLocation();
  const { user, logout, isManager, isAdmin, canManageUsers, canAccessBusinessUnits } = useAuth();
  const { activeUnitId, activeUnitName, availableUnits, canSwitchUnit, isLoading: isLoadingUnits, setActiveUnitId } = useActiveUnit();

  const filteredNavItems = navItems.filter((item) => {
    if (item.requiresUsersAccess && !canManageUsers) return false;
    if (item.requiresBusinessUnitsAccess && !canAccessBusinessUnits) return false;
    if (item.adminOnly) return isAdmin;
    if (item.managerOnly) return isManager;
    return true;
  });

  const renderNavigation = (isCollapsed: boolean, isMobile = false) => (
    <>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                <Battery className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-foreground">cenion | almoxarifado</span>
            </div>
          )}
          {isCollapsed && (
            <div className="flex items-center justify-center w-full">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;

              const linkContent = (
                <Link
                  to={item.href}
                  className={cn(
                    'sidebar-link',
                    isActive && 'sidebar-link-active',
                    isCollapsed && 'justify-center px-2'
                  )}
                  onClick={() => {
                    if (isMobile && onMobileOpenChange) onMobileOpenChange(false);
                  }}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              return (
                <li key={item.href}>
                  {isCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    linkContent
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Unit + User Section */}
        <div className="border-t border-sidebar-border p-4">
          {!isCollapsed ? (
            <div className="mb-3 border-b border-sidebar-border pb-3">
              <p className="mb-1 text-xs text-sidebar-foreground/60">Unidade ativa</p>
              {isLoadingUnits ? (
                <p className="text-sm text-sidebar-foreground/80">Carregando...</p>
              ) : canSwitchUnit ? (
                <Select value={activeUnitId} onValueChange={setActiveUnitId}>
                  <SelectTrigger className="h-9 border-sidebar-border bg-sidebar-accent text-sidebar-foreground">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-medium text-sidebar-foreground">{activeUnitName}</p>
              )}
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mb-3 flex justify-center border-b border-sidebar-border pb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-accent">
                    <Building2 className="h-4 w-4 text-sidebar-foreground" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{activeUnitName}</TooltipContent>
            </Tooltip>
          )}

          {!isCollapsed && user && (
            <div className="mb-3">
              <div className="flex items-start gap-2">
                <Avatar className="h-8 w-8 mt-0.5">
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">
                    {user.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                      <Link
                        to="/profile"
                        onClick={() => {
                          if (isMobile && onMobileOpenChange) onMobileOpenChange(false);
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
                  <span className={cn(
                    'inline-flex mt-1 text-xs px-2 py-0.5 rounded-full',
                    user.role === 'ADMIN'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-sidebar-accent text-sidebar-foreground/80'
                  )}>
                    {user.role === 'ADMIN' ? 'Administrador' : user.role === 'SUPERVISOR' ? 'Supervisor' : 'Técnico'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <div className="flex w-full flex-col items-center gap-2">
                {user && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to="/profile"
                        onClick={() => {
                          if (isMobile && onMobileOpenChange) onMobileOpenChange(false);
                        }}
                      >
                        <Avatar className="h-8 w-8">
                          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                          <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">
                            {user.name.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{user.name}</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        void logout();
                        if (isMobile && onMobileOpenChange) onMobileOpenChange(false);
                      }}
                      className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                      <LogOut className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sair</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  void logout();
                  if (isMobile && onMobileOpenChange) onMobileOpenChange(false);
                }}
                className="flex-1 justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Sair
              </Button>
            )}
          </div>
        </div>
      {!isMobile && (
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      )}
    </>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 hidden lg:flex flex-col',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {renderNavigation(collapsed)}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[86vw] max-w-[320px] p-0 bg-sidebar border-sidebar-border">
          <div className="h-full flex flex-col">
            {renderNavigation(false, true)}
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
