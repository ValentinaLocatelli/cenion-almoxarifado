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

export default function Entrada() {
  const { entradas, itens, addEntrada, updateEntrada, removeEntrada, setEntradaObservacao } =
    useEstoque();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [obsId, setObsId] = useState<string | null>(null);

  const editing = entradas.find((e) => e.id === editingId);
  const editingItem = itens.find((i) => i.id === editing?.itemId);
  const obsEntry = entradas.find((e) => e.id === obsId);

  const initial: MovimentoValues | undefined =
    editing && editingItem
      ? {
          produto: editingItem.produto,
          modelo: editingItem.modelo,
          fornecedor: editing.fornecedor,
          local: editing.local,
          tecnico: '',
          quantidade: String(editing.quantidade),
        }
      : undefined;

  const rows = [...entradas].reverse();

  return (
    <div className="space-y-6">
      <PageHeader title="Entradas">
        <Button
          type="button"
          onClick={() => {
            setEditingId(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          entrada
        </Button>
      </PageHeader>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Data de entrada</TableHead>
              <TableHead>Atualização</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhuma entrada registrada. Use “+ entrada” para começar.
                </TableCell>
              </TableRow>
            )}
            {rows.map((entrada) => {
              const item = itens.find((i) => i.id === entrada.itemId);
              return (
                <TableRow key={entrada.id}>
                  <TableCell>
                    <div className="font-medium">{item?.produto ?? '—'}</div>
                    <div className="text-sm text-muted-foreground">
                      {item?.modelo}
                      {entrada.fornecedor && ` · ${entrada.fornecedor}`}
                      {entrada.local && ` · ${entrada.local}`}
                    </div>
                    {entrada.observacao && (
                      <div className="mt-1 text-sm italic text-muted-foreground">
                        Obs.: {entrada.observacao}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{entrada.quantidade}</TableCell>
                  <TableCell>{formatDate(entrada.dataEntrada)}</TableCell>
                  <TableCell>{formatDateTime(entrada.atualizacao)}</TableCell>
                  <TableCell>
                    <RowActions
                      onEdit={() => {
                        setEditingId(entrada.id);
                        setFormOpen(true);
                      }}
                      onObservation={() => setObsId(entrada.id)}
                      onDelete={() => removeEntrada(entrada.id)}
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
        kind="entrada"
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={initial}
        onSubmit={(values) => {
          const payload = {
            produto: values.produto,
            modelo: values.modelo,
            fornecedor: values.fornecedor,
            local: values.local,
            quantidade: Number(values.quantidade),
          };
          if (editingId) updateEntrada(editingId, payload);
          else addEntrada(payload);
        }}
      />

      <ObservacaoDialog
        key={obsId ?? 'obs'}
        open={Boolean(obsId)}
        onOpenChange={(open) => !open && setObsId(null)}
        value={obsEntry?.observacao ?? ''}
        onSave={(text) => obsId && setEntradaObservacao(obsId, text)}
      />
    </div>
  );
}
