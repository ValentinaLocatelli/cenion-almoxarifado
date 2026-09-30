import { cn } from '@/lib/utils';
import type { Priority } from '@/types';
import { PRIORITY_LABELS } from '@/types';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

const priorityStyles: Record<Priority, string> = {
  LOW: 'priority-low',
  MEDIUM: 'priority-medium',
  HIGH: 'priority-high',
  CRITICAL: 'priority-critical',
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span className={cn('status-badge', priorityStyles[priority], className)}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
