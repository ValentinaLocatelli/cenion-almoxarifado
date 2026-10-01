import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RowActions } from '@/components/estoque/RowActions';
import { ObservacaoDialog } from '@/components/estoque/ObservacaoDialog';
import {
  MovimentoFormDialog,
  type MovimentoValues,
} from '@/components/estoque/MovimentoFormDialog';
import { useEstoque } from '@/contexts/useEstoque';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { toast } from 'sonner';

export default function Saida() {
  const { saidas, itens, addSaida, updateSaida, removeSaida, setSaidaObservacao } = useEstoque();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [obsId, setObsId] = useState<string | null>(null);

  const editing = saidas.find((e) => e.id === editingId);
  const editingItem = itens.find((i) => i.id === editing?.itemId);
  const obsEntry = saidas.find((e) => e.id === obsId);

  const initial: MovimentoValues | undefined =
    editing && editingItem
      ? {
          produto: editingItem.produto,
          modelo: editingItem.modelo,
          fornecedor: '',
          local: '',
          tecnico: editing.tecnico,
          quantidade: String(editing.quantidade),
        }
      : undefined;

  const rows = [...saidas].reverse();

  return (
    <div className="space-y-6">
      <PageHeader title="Saídas">
        <Button
          type="button"
          onClick={() => {
            setEditingId(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          saída
        </Button>
      </PageHeader>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Data de saída</TableHead>
              <TableHead>Atualização</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhuma saída registrada. Use “+ saída” para começar.
                </TableCell>
              </TableRow>
            )}
            {rows.map((saida) => {
              const item = itens.find((i) => i.id === saida.itemId);
              return (
                <TableRow key={saida.id}>
                  <TableCell>
                    <div className="font-medium">{item?.produto ?? '—'}</div>
                    <div className="text-sm text-muted-foreground">
                      {item?.modelo} · Técnico: {saida.tecnico}
                    </div>
                    {saida.observacao && (
                      <div className="mt-1 text-sm italic text-muted-foreground">
                        Obs.: {saida.observacao}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{saida.quantidade}</TableCell>
                  <TableCell>{formatDate(saida.dataSaida)}</TableCell>
                  <TableCell>{formatDateTime(saida.atualizacao)}</TableCell>
                  <TableCell>
                    <RowActions
                      onEdit={() => {
                        setEditingId(saida.id);
                        setFormOpen(true);
                      }}
                      onObservation={() => setObsId(saida.id)}
                      onDelete={() => removeSaida(saida.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <MovimentoFormDialog
        key={editingId ?? 'novo'}
        kind="saida"
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={initial}
        onSubmit={(values) => {
          const payload = {
            produto: values.produto,
            modelo: values.modelo,
            tecnico: values.tecnico,
            quantidade: Number(values.quantidade),
          };
          const erro = editingId ? updateSaida(editingId, payload) : addSaida(payload);
          if (erro) toast.error(erro);
        }}
      />

      <ObservacaoDialog
        key={obsId ?? 'obs'}
        open={Boolean(obsId)}
        onOpenChange={(open) => !open && setObsId(null)}
        value={obsEntry?.observacao ?? ''}
        onSave={(text) => obsId && setSaidaObservacao(obsId, text)}
      />
    </div>
  );
}
