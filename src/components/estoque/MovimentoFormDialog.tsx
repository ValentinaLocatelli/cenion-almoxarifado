import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEstoque } from '@/contexts/useEstoque';
import { emptyMovimento } from '@/components/estoque/emptyMovimento';

export interface MovimentoValues {
  produto: string;
  modelo: string;
  fornecedor: string;
  local: string;
  tecnico: string;
  quantidade: string;
}

interface MovimentoFormDialogProps {
  kind: 'entrada' | 'saida';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se informado, o formulário abre em modo de edição. */
  initial?: MovimentoValues;
  onSubmit: (values: MovimentoValues) => void;
}

const Required = () => <span className="text-destructive"> *</span>;

function FormBody({
  kind,
  initial,
  onSubmit,
  onCancel,
}: {
  kind: 'entrada' | 'saida';
  initial?: MovimentoValues;
  onSubmit: (values: MovimentoValues) => void;
  onCancel: () => void;
}) {
  const { itens, entradas } = useEstoque();
  const [values, setValues] = useState<MovimentoValues>(initial ?? emptyMovimento);
  const editing = Boolean(initial);

  const set = (key: keyof MovimentoValues) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  // Puxa automaticamente os dados de um item já cadastrado no histórico
  const pickItem = (itemId: string) => {
    const item = itens.find((i) => i.id === itemId);
    if (!item) return;
    const lastEntrada = [...entradas].reverse().find((e) => e.itemId === itemId);
    setValues((current) => ({
      ...current,
      produto: item.produto,
      modelo: item.modelo,
      ...(kind === 'entrada' && lastEntrada
        ? { fornecedor: lastEntrada.fornecedor, local: lastEntrada.local }
        : {}),
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantidade = Number(values.quantidade);
    if (!values.produto.trim() || !values.modelo.trim()) return;
    if (kind === 'entrada' && !values.local.trim()) return;
    if (kind === 'saida' && !values.tecnico.trim()) return;
    if (!Number.isInteger(quantidade) || quantidade < (editing ? 0 : 1)) return;
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!editing && itens.length > 0 && (
        <div className="space-y-2">
          <Label>Item já cadastrado</Label>
          <Select onValueChange={pickItem}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione para preencher automaticamente" />
            </SelectTrigger>
            <SelectContent>
              {itens.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.produto} — {item.modelo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="produto">
          Produto
          <Required />
        </Label>
        <Input id="produto" value={values.produto} onChange={set('produto')} placeholder="Descreva o produto" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="modelo">
          Modelo
          <Required />
        </Label>
        <Input id="modelo" value={values.modelo} onChange={set('modelo')} placeholder="Descreva o modelo" required />
      </div>

      {kind === 'entrada' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="fornecedor">
              Fornecedor <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="fornecedor" value={values.fornecedor} onChange={set('fornecedor')} placeholder="Descreva o fornecedor" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="local">
              Local
              <Required />
            </Label>
            <Input id="local" value={values.local} onChange={set('local')} placeholder="Descreva o local" required />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="tecnico">
            Técnico
            <Required />
          </Label>
          <Input id="tecnico" value={values.tecnico} onChange={set('tecnico')} placeholder="Descreva o técnico" required />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="quantidade">
          Quantidade
          <Required />
        </Label>
        <Input
          id="quantidade"
          type="number"
          inputMode="numeric"
          min={editing ? 0 : 1}
          step={1}
          value={values.quantidade}
          onChange={set('quantidade')}
          placeholder="Ex.: 10"
          required
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {editing ? 'Salvar alterações' : kind === 'entrada' ? 'Adicionar entrada' : 'Adicionar saída'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MovimentoFormDialog({ kind, open, onOpenChange, initial, onSubmit }: MovimentoFormDialogProps) {
  const label = kind === 'entrada' ? 'entrada' : 'saída';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? `Editar ${label}` : `Nova ${label}`}</DialogTitle>
        </DialogHeader>
        <FormBody
          kind={kind}
          initial={initial}
          onCancel={() => onOpenChange(false)}
          onSubmit={(values) => {
            onSubmit(values);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
