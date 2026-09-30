import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OSStatus, Priority, User } from '@/types';
import { STATUS_LABELS, PRIORITY_LABELS } from '@/types';

interface OrderFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: OSStatus | 'ALL';
  onStatusChange: (value: OSStatus | 'ALL') => void;
  priorityFilter: Priority | 'ALL';
  onPriorityChange: (value: Priority | 'ALL') => void;
  technicianFilter: string;
  onTechnicianChange: (value: string) => void;
  warrantyFilter: 'ALL' | 'YES' | 'NO';
  onWarrantyChange: (value: 'ALL' | 'YES' | 'NO') => void;
  onClearFilters: () => void;
  technicians: User[];
  hideTechnicianFilter?: boolean;
}

export function OrderFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  technicianFilter,
  onTechnicianChange,
  warrantyFilter,
  onWarrantyChange,
  onClearFilters,
  technicians,
  hideTechnicianFilter = false,
}: OrderFiltersProps) {
  const hasActiveFilters = 
    searchQuery || 
    statusFilter !== 'ALL' || 
    priorityFilter !== 'ALL' || 
    (!hideTechnicianFilter && technicianFilter !== 'ALL') ||
    warrantyFilter !== 'ALL';

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por OS, cliente, produto..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={onPriorityChange}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!hideTechnicianFilter && (
            <Select value={technicianFilter} onValueChange={onTechnicianChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Técnico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Técnicos</SelectItem>
                <SelectItem value="UNASSIGNED">Não Atribuído</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={warrantyFilter} onValueChange={onWarrantyChange}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Garantia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              <SelectItem value="YES">Com Garantia</SelectItem>
              <SelectItem value="NO">Sem Garantia</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
