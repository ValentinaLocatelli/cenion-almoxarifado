import { cn } from '@/lib/utils';
import type { OSStatus } from '@/types';
import { STATUS_LABELS } from '@/types';

interface StatusBadgeProps {
  status: OSStatus;
  className?: string;
}

const statusStyles: Record<OSStatus, string> = {
  IMPORTED_OPEN: 'status-open',
  ATTRIBUTED: 'status-attributed',
  IN_ANALYSIS: 'status-analysis',
  WAITING_PART: 'status-waiting',
  WAITING_BUDGET: 'status-waiting',
  WAITING_APPROVAL: 'status-waiting',
  WAITING_EXECUTION: 'status-execution',
  SENT_TO_CUSTOMER: 'status-waiting',
  APPROVED: 'status-approved',
  IN_EXECUTION: 'status-execution',
  FINISHED_TECH: 'status-finished',
  DISPATCHED: 'status-dispatched',
  AWAITING_RECEIPT: 'status-dispatched',
  INVOICED: 'status-invoiced',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('status-badge', statusStyles[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}
