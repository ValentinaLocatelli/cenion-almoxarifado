import { FormEvent, useMemo, useState } from 'react';
import { Filter, Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RowActions } from '@/components/estoque/RowActions';
import { useEstoque } from '@/contexts/useEstoque';
import { firstName, normalizeText } from '@/lib/formatDate';
import type { Item } from '@/types/estoque';

function ItemForm({
  item,
  onSubmit,
  onCancel,
}: {
  item?: Item;
  onSubmit: (values: { produto: string; modelo: string; quantidadeMinima?: number }) => void;
  onCancel: () => void;
}) {
  const [produto, setProduto] = useState(item?.produto ?? '');
  const [modelo, setModelo] = useState(item?.modelo ?? '');
  const [minima, setMinima] = useState(
    item?.quantidadeMinima !== undefined ? String(item.quantidadeMinima) : '',
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!produto.trim() || !modelo.trim()) return;
    const parsed = minima.trim() === '' ? undefined : Number(minima);
    if (parsed !== undefined && (!Number.isInteger(parsed) || parsed < 0)) return;
    onSubmit({ produto, modelo, quantidadeMinima: parsed });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="item-produto">
          Produto <span className="text-destructive">*</span>
        </Label>
        <Input
          id="item-produto"
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          placeholder="Descreva o produto"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="item-modelo">
          Modelo <span className="text-destructive">*</span>
        </Label>
        <Input
          id="item-modelo"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          placeholder="Descreva o modelo"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="item-minima">
          Quantidade mínima <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="item-minima"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={minima}
          onChange={(e) => setMinima(e.target.value)}
          placeholder="Ex.: 10"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">{item ? 'Salvar alterações' : 'Adicionar item'}</Button>
      </DialogFooter>
    </form>
  );
}

export default function Itens() {
  const { itens, entradas, saidas, addItem, updateItem, removeItem } = useEstoque();
  const [formOpen, setFormOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState('');
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = itens.find((i) => i.id === editingId);

  // Saldo = tudo que já entrou (soma) menos tudo que já saiu (subtrai), por item
  const saldos = useMemo(() => {
    const map = new Map<string, number>();
    entradas.forEach((e) => map.set(e.itemId, (map.get(e.itemId) ?? 0) + e.quantidade));
    saidas.forEach((s) => map.set(s.itemId, (map.get(s.itemId) ?? 0) - s.quantidade));
    return map;
  }, [entradas, saidas]);

  const primeirosNomes = useMemo(
    () => Array.from(new Set(itens.map((i) => firstName(i.produto)).filter(Boolean))),
    [itens],
  );

  // Filtra só pelo primeiro nome do produto, ignorando modelo e demais palavras
  const visiveis = useMemo(() => {
    if (!filter) return itens;
    const alvo = normalizeText(filter);
    return itens.filter((i) => normalizeText(firstName(i.produto)) === alvo);
  }, [itens, filter]);

  const applyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilter(filterDraft.trim());
    setFilterOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Itens">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFilterDraft(filter);
            setFilterOpen(true);
          }}
        >
          <Filter className="mr-2 h-4 w-4" />
          filtro
        </Button>
        <Button
          type="button"
          onClick={() => {
            setEditingId(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          item
        </Button>
      </PageHeader>

      {filter && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtrando pelo primeiro nome:</span>
          <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">{filter}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setFilter('')}>
            <X className="mr-1 h-4 w-4" />
            Limpar filtro
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Quantidade mínima</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum item cadastrado. Itens aparecem aqui ao registrar entradas e saídas, ou use “+ item”.
                </TableCell>
              </TableRow>
            )}
            {itens.length > 0 && visiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum item com o primeiro nome “{filter}”.
                </TableCell>
              </TableRow>
            )}
            {visiveis.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.produto}</TableCell>
                <TableCell>{item.modelo}</TableCell>
                <TableCell>{item.quantidadeMinima ?? '—'}</TableCell>
                <TableCell className="font-medium">{saldos.get(item.id) ?? 0}</TableCell>
                <TableCell>
                  <RowActions
                    onEdit={() => {
                      setEditingId(item.id);
                      setFormOpen(true);
                    }}
                    onDelete={() => removeItem(item.id)}
                    deleteDescription="As entradas e saídas registradas para este item também serão excluídas."
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtrar itens</DialogTitle>
          </DialogHeader>
          <form onSubmit={applyFilter} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="filtro-nome">Primeiro nome do item</Label>
              <Input
                id="filtro-nome"
                list="filtro-nomes"
                value={filterDraft}
                onChange={(e) => setFilterDraft(e.target.value)}
                placeholder="Ex.: Contactor"
                autoFocus
              />
              <datalist id="filtro-nomes">
                {primeirosNomes.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilter('');
                  setFilterDraft('');
                  setFilterOpen(false);
                }}
              >
                Limpar
              </Button>
              <Button type="submit">Filtrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent key={editingId ?? 'novo'}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar item' : 'Novo item'}</DialogTitle>
          </DialogHeader>
          <ItemForm
            item={editing}
            onCancel={() => setFormOpen(false)}
            onSubmit={(values) => {
              if (editingId) updateItem(editingId, values);
              else addItem(values);
              setFormOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
