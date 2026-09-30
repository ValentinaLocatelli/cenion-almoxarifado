import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ViewToggle } from '@/components/orders/ViewToggle';
import { useAppData } from '@/contexts/AppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUnit } from '@/contexts/ActiveUnitContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type {
  ProductionOrder,
  ProductionOrderStatus,
  ProductionOrderType,
} from '@/types/production';

const statusLabels: Record<ProductionOrderStatus, string> = {
  OPEN: 'Aberta',
  ATTRIBUTED: 'Atribuída',
  IN_PRODUCTION: 'Em Produção',
  WAITING_PART: 'Aguardando Peça',
  IN_TESTING: 'Em Teste',
  FINISHING: 'Finalizando',
  COMPLETED: 'Concluída',
  DISPATCHED: 'Despachada',
  FINALIZED: 'Finalizada',
};

const typeLabels: Record<ProductionOrderType, string> = {
  BATTERY: 'Bateria',
  CHARGER_ONLY: 'Carregador',
};

function statusBadgeClass(status: ProductionOrderStatus): string {
  if (status === 'FINALIZED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'DISPATCHED') return 'bg-violet-100 text-violet-700';
  if (status === 'COMPLETED') return 'bg-teal-100 text-teal-700';
  if (status === 'WAITING_PART') return 'bg-orange-100 text-orange-700';
  if (status === 'IN_TESTING') return 'bg-cyan-100 text-cyan-700';
  if (status === 'FINISHING') return 'bg-fuchsia-100 text-fuchsia-700';
  if (status === 'IN_PRODUCTION') return 'bg-amber-100 text-amber-700';
  if (status === 'ATTRIBUTED') return 'bg-indigo-100 text-indigo-700';
  return 'bg-blue-100 text-blue-700';
}

export default function ProductionOrders() {
  const { user, isTechnician } = useAuth();
  const navigate = useNavigate();
  const { activeUnitId } = useActiveUnit();
  const {
    users,
    productionOrders,
    isLoading,
  } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductionOrderStatus | 'ALL'>('ALL');
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<ProductionOrderStatus>>(new Set());

  const view = searchParams.get('view') === 'kanban' ? 'kanban' : 'table';

  const sortedOrders = useMemo(
    () => [...productionOrders]
      .filter((order) => order.unitId === activeUnitId)
      .filter((order) => (isTechnician ? order.technicianId === user?.id : true))
      .sort((a, b) => a.vc - b.vc),
    [productionOrders, activeUnitId, isTechnician, user?.id],
  );

  const userNameById = useMemo(
    () => new Map(users.map((entry) => [entry.id, entry.name])),
    [users],
  );

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter((order) => {
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const searchText = [
        order.code,
        order.client.companyName,
        order.client.contactName,
        typeLabels[order.type],
      ]
        .join(' ')
        .toLowerCase();

      return searchText.includes(query);
    });
  }, [searchQuery, sortedOrders, statusFilter]);

  const displayStatus = (status: ProductionOrderStatus): ProductionOrderStatus => (
    isTechnician && status === 'ATTRIBUTED' ? 'OPEN' : status
  );

  const kanbanColumns: ProductionOrderStatus[] = isTechnician
    ? ['OPEN', 'IN_PRODUCTION', 'WAITING_PART', 'IN_TESTING', 'FINISHING', 'COMPLETED', 'DISPATCHED', 'FINALIZED']
    : ['OPEN', 'ATTRIBUTED', 'IN_PRODUCTION', 'WAITING_PART', 'IN_TESTING', 'FINISHING', 'COMPLETED', 'DISPATCHED', 'FINALIZED'];

  const handleViewChange = (nextView: 'table' | 'kanban') => {
    if (nextView === view) return;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('view', nextView);
    setSearchParams(nextSearchParams, { replace: true });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
  };

  const toggleColumn = (status: ProductionOrderStatus) => {
    setCollapsedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Ordens de Produção"
        description={isLoading ? 'Carregando ordens de produção...' : `${filteredOrders.length} ordens de produção`}
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ViewToggle view={view} onViewChange={handleViewChange} />

      </div>

      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por VC, cliente ou contato..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ProductionOrderStatus | 'ALL')}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Status</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={clearFilters}>Limpar</Button>
          </div>
        </div>
      </div>

      {!activeUnitId && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Selecione uma unidade de negócio no menu lateral para visualizar ordens e empresas vinculadas.
        </div>
      )}

      {view === 'table' ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Status</TableHead>
                <TableHead>VC</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Despacho</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Última edição por</TableHead>
                <TableHead>Criacao</TableHead>
                <TableHead>Atualizacao</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                    Nenhuma ordem de produção encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/production-orders/${order.id}?view=${view}`)}
                  >
                    <TableCell>
                      <Badge className={statusBadgeClass(displayStatus(order.status))}>{statusLabels[displayStatus(order.status)]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{order.code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.client.companyName}</p>
                        <p className="text-sm text-muted-foreground">{order.client.contactName}</p>
                      </div>
                    </TableCell>
                    <TableCell>{typeLabels[order.type]}</TableCell>
                    <TableCell>
                      {order.type === 'BATTERY'
                        ? `${order.batteryItems.length} configuração(ões)`
                        : '1 carregador'}
                    </TableCell>
                    <TableCell>{order.technicianName || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.status === 'DISPATCHED' || order.status === 'FINALIZED' ? (
                        <div className="space-y-0.5">
                          <p>{order.carrier || '-'}</p>
                          <p className="truncate max-w-[220px]">{order.trackingLink || '-'}</p>
                          <p>{order.deliveryDate ? format(order.deliveryDate, 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{order.createdBy ? userNameById.get(order.createdBy) ?? 'Usuario removido' : '-'}</TableCell>
                    <TableCell>{order.updatedBy ? userNameById.get(order.updatedBy) ?? 'Usuario removido' : '-'}</TableCell>
                    <TableCell>{format(order.createdAt, 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                    <TableCell>{format(order.updatedAt, 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações da ordem de produção">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenuItem onClick={() => navigate(`/production-orders/${order.id}?view=${view}`)}>
                            Abrir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
        <div className="flex h-[72dvh] min-h-[420px] gap-4 overflow-x-auto overflow-y-hidden pb-4 snap-x snap-mandatory">
          {kanbanColumns.map((status) => {
            const columnOrders = filteredOrders.filter((order) => displayStatus(order.status) === status);
            const isCollapsed = collapsedStatuses.has(status);

            if (isCollapsed) {
              return (
                <div
                  key={status}
                  className="shrink-0 snap-start h-full w-14 rounded-xl border border-border bg-muted/40 flex flex-col items-center py-3"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleColumn(status)}
                    aria-label="Expandir coluna"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="mt-2 text-xs bg-background px-2 py-0.5 rounded-full font-medium">
                    {columnOrders.length}
                  </span>
                  <div className="flex-1 flex items-center justify-center mt-3">
                    <span className="text-xs font-semibold [writing-mode:vertical-rl] rotate-180 text-center">
                      {statusLabels[status]}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={status} className="kanban-column shrink-0 snap-start h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">{statusLabels[status]}</h3>
                  <div className="flex items-center gap-1">
                    <span className="text-xs bg-muted px-2 py-1 rounded-full font-medium">
                      {columnOrders.length}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleColumn(status)}
                      aria-label="Ocultar coluna"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 overflow-y-auto pr-1">
                  {columnOrders.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma VC</div>
                  ) : (
                    columnOrders.map((order) => (
                      <div
                        key={order.id}
                        className="kanban-card border-t-4 border-t-status-open cursor-pointer"
                        onClick={() => navigate(`/production-orders/${order.id}?view=${view}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-sm">{order.code}</p>
                          <div className="flex items-center gap-1">
                            <Badge className={statusBadgeClass(displayStatus(order.status))}>{statusLabels[displayStatus(order.status)]}</Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações da ordem de produção">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                                <DropdownMenuItem onClick={() => navigate(`/production-orders/${order.id}?view=${view}`)}>
                                  Abrir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <p className="text-sm font-medium mb-1 break-words">{order.client.companyName}</p>
                        <p className="text-xs text-muted-foreground mb-2">Contato: {order.client.contactName || '-'}</p>
                        <p className="text-xs text-muted-foreground">
                          {typeLabels[order.type]} |{' '}
                          {order.type === 'BATTERY'
                            ? `${order.batteryItems.length} configuração(ões)`
                            : '1 carregador'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Criado por: {order.createdBy ? userNameById.get(order.createdBy) ?? 'Usuario removido' : '-'}
                        </p>
                        {(order.status === 'DISPATCHED' || order.status === 'FINALIZED') && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.carrier || '-'} | {order.deliveryDate ? format(order.deliveryDate, 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

    </div>
  );
}
