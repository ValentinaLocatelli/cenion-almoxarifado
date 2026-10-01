import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownToLine, ArrowUpToLine, Package } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEstoque } from '@/contexts/useEstoque';
import { formatDateTime } from '@/lib/formatDate';

const MOVIMENTOS_VISIVEIS = 15;

interface PartRequestRow {
  id: string;
  order_type: 'VC' | 'OS';
  order_code: string;
  part_description: string;
  quantity: number;
  requested_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entradas, saidas, itens } = useEstoque();
  const [partRequests, setPartRequests] = useState<PartRequestRow[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const canViewPartRequests = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  useEffect(() => {
    if (!canViewPartRequests) return;

    let isCurrent = true;
    setIsLoadingRequests(true);
    void supabase
      .from('part_requests')
      .select('id,order_type,order_code,part_description,quantity,requested_at')
      .eq('received', false)
      .order('requested_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!isCurrent) return;
        if (error) {
          console.error('Falha ao carregar solicitações de peças:', error);
          setPartRequests([]);
        } else {
          setPartRequests((data ?? []) as PartRequestRow[]);
        }
        setIsLoadingRequests(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canViewPartRequests]);

  const cards = [
    { title: 'Entrada', description: `${entradas.length} registros`, icon: ArrowDownToLine, href: '/entrada' },
    { title: 'Saída', description: `${saidas.length} registros`, icon: ArrowUpToLine, href: '/saida' },
    { title: 'Itens', description: `${itens.length} cadastrados`, icon: Package, href: '/itens' },
  ];

  // Estoque atual do item = saldo (entradas somam, saídas subtraem), o mesmo da aba Itens.
  const emergencia = useMemo(() => {
    const totais = new Map<string, number>();
    entradas.forEach((e) => totais.set(e.itemId, (totais.get(e.itemId) ?? 0) + e.quantidade));
    saidas.forEach((s) => totais.set(s.itemId, (totais.get(s.itemId) ?? 0) - s.quantidade));
    return itens
      .filter(
        (item) =>
          item.quantidadeMinima !== undefined &&
          (totais.get(item.id) ?? 0) <= item.quantidadeMinima,
      )
      .map((item) => ({ item, atual: totais.get(item.id) ?? 0 }))
      .sort((a, b) => a.atual - b.atual);
  }, [entradas, saidas, itens]);

  const movimentos = useMemo(() => {
    const byId = new Map(itens.map((i) => [i.id, i]));
    return [
      ...entradas.map((e) => ({
        key: `e-${e.id}`,
        tipo: 'Entrada' as const,
        item: byId.get(e.itemId),
        quantidade: e.quantidade,
        atualizacao: e.atualizacao,
      })),
      ...saidas.map((s) => ({
        key: `s-${s.id}`,
        tipo: 'Saída' as const,
        item: byId.get(s.itemId),
        quantidade: s.quantidade,
        atualizacao: s.atualizacao,
      })),
    ]
      .sort((a, b) => b.atualizacao.localeCompare(a.atualizacao))
      .slice(0, MOVIMENTOS_VISIVEIS);
  }, [entradas, saidas, itens]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Dashboard" description="Visão geral do almoxarifado" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              type="button"
              onClick={() => navigate(card.href)}
              className="group rounded-xl border border-border bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/15">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-3 text-base font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {canViewPartRequests && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Solicitações de peças pendentes</h2>
            {partRequests.length > 0 && <Badge>{partRequests.length}</Badge>}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Identificação</TableHead>
                  <TableHead>Peça</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRequests ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Carregando solicitações...
                    </TableCell>
                  </TableRow>
                ) : partRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhuma solicitação pendente.
                    </TableCell>
                  </TableRow>
                ) : (
                  partRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell><Badge variant="outline">{request.order_type}</Badge></TableCell>
                      <TableCell className="font-medium">{request.order_code}</TableCell>
                      <TableCell>{request.part_description}</TableCell>
                      <TableCell>{request.quantity}</TableCell>
                      <TableCell>{formatDateTime(request.requested_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold">Item em emergência</h2>
          {emergencia.length > 0 && <Badge variant="destructive">{emergencia.length}</Badge>}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Quantidade mínima</TableHead>
                <TableHead>Modelo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emergencia.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Nenhum item em quantidade crítica.
                  </TableCell>
                </TableRow>
              )}
              {emergencia.map(({ item, atual }) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.produto}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      (saldo: {atual})
                    </span>
                  </TableCell>
                  <TableCell>{item.quantidadeMinima}</TableCell>
                  <TableCell>{item.modelo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Entradas e saídas</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma movimentação registrada.
                  </TableCell>
                </TableRow>
              )}
              {movimentos.map((m) => (
                <TableRow key={m.key}>
                  <TableCell className="font-medium">{m.item?.produto ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={m.tipo === 'Entrada' ? 'secondary' : 'outline'}>{m.tipo}</Badge>
                  </TableCell>
                  <TableCell>{m.quantidade}</TableCell>
                  <TableCell>{m.item?.modelo ?? '—'}</TableCell>
                  <TableCell>{formatDateTime(m.atualizacao)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
