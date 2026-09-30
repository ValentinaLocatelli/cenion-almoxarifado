import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ViewToggleProps {
  view: 'table' | 'kanban';
  onViewChange: (view: 'table' | 'kanban') => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-muted/30 p-1">
      <Button
        variant="ghost"
        onClick={() => onViewChange('kanban')}
        className={cn(
          'rounded-xl',
          view === 'kanban'
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
            : 'text-foreground hover:bg-muted',
        )}
      >
        <LayoutGrid className="w-4 h-4 mr-2" />
        Kanban
      </Button>
      <Button
        variant="ghost"
        onClick={() => onViewChange('table')}
        className={cn(
          'rounded-xl',
          view === 'table'
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
            : 'text-foreground hover:bg-muted',
        )}
      >
        <List className="w-4 h-4 mr-2" />
        Tabela
      </Button>
    </div>
  );
}
