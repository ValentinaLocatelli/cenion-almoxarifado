import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { OrdersKanban } from '@/components/orders/OrdersKanban';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { ViewToggle } from '@/components/orders/ViewToggle';
import { useAppData } from '@/contexts/AppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUnit } from '@/contexts/ActiveUnitContext';
import type { OSStatus, Priority } from '@/types';

export default function AllOrders() {
  const { user, isTechnician, isManager } = useAuth();
  const { activeUnitId } = useActiveUnit();
  const { orders, users, isLoading } = useAppData();

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OSStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'ALL'>('ALL');
  const [technicianFilter, setTechnicianFilter] = useState('ALL');
  const [warrantyFilter, setWarrantyFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL');

  const view = searchParams.get('view') === 'kanban' ? 'kanban' : 'table';

  /*
   * COLUNAS DO KANBAN DO ADMINISTRADOR
   *
   * Finalizado (Técnico) e Finalizado não aparecem aqui.
   * A OS continua existindo no sistema, mas não fica
   * visível na área principal de Ordens de Serviço.
   */
  const managerKanbanColumns: OSStatus[] = [
    'IMPORTED_OPEN',
    'IN_ANALYSIS',
    'WAITING_PART',
    'WAITING_BUDGET',
    'WAITING_APPROVAL',
    'WAITING_EXECUTION',
    'IN_EXECUTION',
    'DISPATCHED',
    'AWAITING_RECEIPT',
    'FINISHED_TECH',
    'INVOICED',
  ];

  const filteredOrders = useMemo(() => {
    const ordersByUnit = activeUnitId
      ? orders.filter((order) => order.unitId === activeUnitId)
      : [];

    const visibleOrders = isTechnician
      ? ordersByUnit.filter((order) => order.technicianId === user?.id)
      : ordersByUnit;

    return visibleOrders.filter((order) => {
      /*
       * IMPORTANTE:
       *
       * Não mostrar na área "Ordens de Serviço":
       *
       * - Finalizado (Técnico)
       * - Finalizado
       *
       * Essas ordens não são apagadas do banco.
       * Apenas deixam de aparecer nesta tela.
       */
      // No portal técnico, a área de Ordens de Serviço mostra somente
      // OS que estão aguardando peça. Ordens finalizadas ou finalizadas
      // tecnicamente não devem aparecer.
      if (isTechnician) {
        if (order.status !== 'WAITING_PART') return false;
      } else if (
        order.status === 'FINISHED_TECH' ||
        order.status === 'INVOICED'
      ) {
        return false;
      }

      // Filtro de pesquisa
      if (searchQuery) {
        const query = searchQuery.toLowerCase();

        const matchesSearch =
          order.omieOSNumber.toLowerCase().includes(query) ||
          order.clientName.toLowerCase().includes(query) ||
          order.productDescription.toLowerCase().includes(query) ||
          order.serialNumber?.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      // Filtro de status
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      // Filtro de prioridade
      if (priorityFilter !== 'ALL' && order.priority !== priorityFilter) {
        return false;
      }

      // Filtro de técnico
      if (technicianFilter !== 'ALL') {
        if (
          technicianFilter === 'UNASSIGNED' &&
          order.technicianId
        ) {
          return false;
        }

        if (
          technicianFilter !== 'UNASSIGNED' &&
          order.technicianId !== technicianFilter
        ) {
          return false;
        }
      }

      // Filtro de garantia
      if (warrantyFilter !== 'ALL') {
        if (warrantyFilter === 'YES' && !order.isWarranty) {
          return false;
        }

        if (warrantyFilter === 'NO' && order.isWarranty) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    activeUnitId,
    isTechnician,
    user?.id,
    searchQuery,
    statusFilter,
    priorityFilter,
    technicianFilter,
    warrantyFilter,
  ]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setTechnicianFilter('ALL');
    setWarrantyFilter('ALL');
  };

  const handleViewChange = (nextView: 'table' | 'kanban') => {
    if (nextView === view) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('view', nextView);

    setSearchParams(nextSearchParams, {
      replace: true,
    });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Ordens de Serviço"
        description={
          isLoading
            ? 'Carregando ordens...'
            : `${filteredOrders.length} ordens de serviço encontradas`
        }
      />

      <div className="mb-6">
        <ViewToggle
          view={view}
          onViewChange={handleViewChange}
        />
      </div>

      <OrderFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        technicianFilter={technicianFilter}
        onTechnicianChange={setTechnicianFilter}
        warrantyFilter={warrantyFilter}
        onWarrantyChange={setWarrantyFilter}
        onClearFilters={clearFilters}
        technicians={users.filter(
          (u) =>
            u.role === 'TECNICO' &&
            u.active &&
            u.unitId === activeUnitId
        )}
        hideTechnicianFilter={isTechnician}
      />

      {view === 'table' ? (
        <OrdersTable
          orders={filteredOrders}
          detailView={view}
        />
      ) : (
        <OrdersKanban
          orders={filteredOrders}
          columns={
            isManager
              ? managerKanbanColumns
              : undefined
          }
          detailView={view}
        />
      )}
    </div>
  );
}