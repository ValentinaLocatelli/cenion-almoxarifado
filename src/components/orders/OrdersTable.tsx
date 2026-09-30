import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import type { ServiceOrder } from '@/types';
import { PRODUCT_TYPE_LABELS } from '@/types';
import { cn } from '@/lib/utils';

interface OrdersTableProps {
  orders: ServiceOrder[];
  showActions?: boolean;
  detailView?: 'table' | 'kanban';
}

export function OrdersTable({ orders, showActions = true, detailView }: OrdersTableProps) {
 const sortedOrders = useMemo(
  () =>
    [...orders].sort((a, b) => {
      const aNumber = Number(a.omieOSNumber);
      const bNumber = Number(b.omieOSNumber);

      return aNumber - bNumber;
    }),
  [orders],
);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">OS</TableHead>
            <TableHead className="font-semibold">Cliente</TableHead>
            <TableHead className="font-semibold">Origem</TableHead>
            <TableHead className="font-semibold">Destino</TableHead>
            <TableHead className="font-semibold">Produto</TableHead>
            <TableHead className="font-semibold">Tipo</TableHead>
            <TableHead className="font-semibold">Técnico</TableHead>
            <TableHead className="font-semibold">Prioridade</TableHead>
            <TableHead className="font-semibold">Atualização</TableHead>
            {showActions && <TableHead className="w-12"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions ? 11 : 10} className="text-center py-12 text-muted-foreground">
                Nenhuma ordem de serviço encontrada
              </TableCell>
            </TableRow>
          ) : (
            sortedOrders.map((order) => (
              <TableRow key={order.id} className="data-table-row">
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    to={`/orders/${order.id}${detailView ? `?view=${detailView}` : ''}`}
                    className="hover:text-primary transition-colors"
                  >
                    {order.omieOSNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{order.clientName}</p>
                    {order.contactName && (
                      <p className="text-sm text-muted-foreground">{order.contactName}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{order.origin || <span className="text-muted-foreground">—</span>}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{order.destination || <span className="text-muted-foreground">—</span>}</span>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="max-w-[200px] truncate">{order.productDescription}</p>
                    {order.serialNumber && (
                      <p className="text-sm text-muted-foreground">S/N: {order.serialNumber}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn(
                    'inline-flex items-center gap-1.5 text-sm',
                    order.productType === 'BATTERY' ? 'text-amber-600' : 'text-blue-600'
                  )}>
                    {PRODUCT_TYPE_LABELS[order.productType]}
                    {order.isWarranty && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Garantia
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  {order.technicianName || (
                    <span className="text-muted-foreground">Não atribuído</span>
                  )}
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={order.priority} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {format(order.updatedAt, "dd/MM/yy HH:mm", { locale: ptBR })}
                  </div>
                </TableCell>
                {showActions && (
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link to={`/orders/${order.id}${detailView ? `?view=${detailView}` : ''}`} aria-label="Visualizar OS">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
