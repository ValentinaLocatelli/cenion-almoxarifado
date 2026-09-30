import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, Battery, Zap, MoreHorizontal, Edit, Trash2, Download, ChevronRight, ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { ServiceOrder, OSStatus } from '@/types';
import { STATUS_LABELS } from '@/types';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import { toast } from 'sonner';
import { downloadOrderAsPdf } from '@/lib/orderPdf';

interface OrdersKanbanProps {
  orders: ServiceOrder[];
  columns?: OSStatus[];
  detailView?: 'table' | 'kanban';
}

const defaultColumns: OSStatus[] = [
  'IMPORTED_OPEN',
  'IN_ANALYSIS',
  'WAITING_PART',
  'WAITING_BUDGET',
  'WAITING_APPROVAL',
  'WAITING_EXECUTION',
  'IN_EXECUTION',
  'FINISHED_TECH',
  'DISPATCHED',
  'AWAITING_RECEIPT',
];

const columnColors: Partial<Record<OSStatus, string>> = {
  IMPORTED_OPEN: 'border-t-status-open',
  IN_ANALYSIS: 'border-t-status-analysis',
  WAITING_PART: 'border-t-status-waiting',
  WAITING_BUDGET: 'border-t-status-waiting',
  WAITING_APPROVAL: 'border-t-status-waiting',
  WAITING_EXECUTION: 'border-t-status-execution',
  IN_EXECUTION: 'border-t-status-execution',
  FINISHED_TECH: 'border-t-status-finished',
  DISPATCHED: 'border-t-status-dispatched',
  AWAITING_RECEIPT: 'border-t-status-dispatched',
  INVOICED: 'border-t-status-invoiced',
};

export function OrdersKanban({ orders, columns = defaultColumns, detailView }: OrdersKanbanProps) {
  const { isAdmin } = useAuth();
  const { deleteOrder } = useAppData();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<ServiceOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<OSStatus>>(new Set());
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [orders],
  );

  const getOrdersByStatus = (status: OSStatus) => {
    if (status === 'IMPORTED_OPEN') {
      return sortedOrders.filter(
        (order) => order.status === 'IMPORTED_OPEN' || order.status === 'ATTRIBUTED'
      );
    }

    return sortedOrders.filter((order) => order.status === status);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteOrder(deleteTarget.id);
      toast.success('OS excluída com sucesso');
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível excluir a OS.';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleColumn = (status: OSStatus) => {
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
    <>
      <div className="flex h-[72dvh] min-h-[420px] gap-4 overflow-x-auto overflow-y-hidden pb-4 snap-x snap-mandatory">
        {columns.map((status) => {
        const columnOrders = getOrdersByStatus(status);
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
                  {STATUS_LABELS[status]}
                </span>
              </div>
            </div>
          );
        }
        
        return (
          <div key={status} className="kanban-column shrink-0 snap-start h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">{STATUS_LABELS[status]}</h3>
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
              {columnOrders.map((order) => (
                <div
                  key={order.id}
                  className={cn(
                    'kanban-card block border-t-4 cursor-pointer',
                    columnColors[status]
                  )}
                  onClick={() => navigate(`/orders/${order.id}${detailView ? `?view=${detailView}` : ''}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {order.omieOSNumber}
                      </span>
                      <PriorityBadge priority={order.priority} />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 -mr-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                        <DropdownMenuItem
                          onClick={() => {
                            downloadOrderAsPdf(order);
                            toast.success('Download do PDF iniciado');
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/orders/${order.id}${detailView ? `?view=${detailView}` : ''}`}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        {isAdmin && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(order)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <p className="text-sm font-medium mb-1 break-words">{order.clientName}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {order.productDescription}
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {order.productType === 'BATTERY' ? (
                        <Battery className="w-3.5 h-3.5" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      {order.productType === 'BATTERY' ? 'Bateria' : 'Carregador'}
                    </span>
                    
                    {order.isWarranty && (
                      <span className="text-status-finished font-medium">Garantia</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    {order.technicianName ? (
                      <span className="flex items-center gap-1 text-xs">
                        <User className="w-3.5 h-3.5" />
                        {order.technicianName}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não atribuído</span>
                    )}
                    
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {format(order.updatedAt, "dd/MM", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
              
              {columnOrders.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhuma OS
                </div>
              )}
            </div>
          </div>
        );
        })}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A OS ${deleteTarget.omieOSNumber} será removida permanentemente. Esta ação não pode ser desfeita.`
                : 'Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
