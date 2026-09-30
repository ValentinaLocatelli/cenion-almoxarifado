import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
  iconClassName?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  iconClassName,
}: StatsCardProps) {
  return (
    <div className={cn('bg-card rounded-xl border border-border p-6 card-hover', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
          {trend && (
            <p className={cn(
              'text-sm mt-2 font-medium',
              trend.positive ? 'text-status-finished' : 'text-destructive'
            )}>
              {trend.positive ? '+' : ''}{trend.value}% vs. mês anterior
            </p>
          )}
        </div>
        <div className={cn(
          'flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10',
          iconClassName
        )}>
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </div>
  );
}
