import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PackagePlus, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { ProductionOrder, ProductionOrderDraft } from '@/types/production';

type RequestKind = 'VC' | 'OS';

interface PartRequest {
  id: string;
  orderType: RequestKind;
  orderCode: string;
  partDescription: string;
  quantity: number;
  technicianId: string;
  technicianName: string;
  requestedAt: Date;
  received: boolean;
  receivedAt?: Date;
}

function toProductionOrderDraft(order: ProductionOrder, patch: Partial<ProductionOrder>): ProductionOrderDraft {
  const resolve = <K extends keyof ProductionOrder>(key: K): ProductionOrder[K] =>
    (key in patch ? patch[key] : order[key]) as ProductionOrder[K];

  return {
    code: order.code,
    vc: resolve('vc'),
    type: resolve('type'),
    status: resolve('status'),
    client: resolve('client'),
    delivery: resolve('delivery'),
    technicalSpecs: resolve('technicalSpecs'),
    productSpecification: resolve('productSpecification'),
    batteryItems: resolve('batteryItems'),
    chargerOnly: resolve('chargerOnly'),
    trackingNumber: resolve('trackingNumber'),
    trackingLink: resolve('trackingLink'),
    carrier: resolve('carrier'),
    deliveryDate: resolve('deliveryDate'),
    technicianId: resolve('technicianId'),
    technicianName: resolve('technicianName'),
    waitingPartDescription: resolve('waitingPartDescription'),
    waitingPartFromStatus: resolve('waitingPartFromStatus'),
    productionStartTime: resolve('productionStartTime'),
    productionEndTime: resolve('productionEndTime'),
    purchaseOrderAttachments: resolve('purchaseOrderAttachments'),
    productionAttachments: resolve('productionAttachments'),
  };
}

export default function Parts() {
  const { user } = useAuth();
  const { orders, productionOrders, updateProductionOrder } = useAppData();

  const [kind, setKind] = useState<RequestKind | ''>('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<PartRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  // Somente VC/OS atribuídas ao técnico logado, mesma regra usada no Dashboard.
  const assignedVcs = useMemo(
    () => productionOrders.filter((order) => order.technicianId === user?.id),
    [productionOrders, user?.id],
  );
  const assignedOs = useMemo(
    () => orders.filter((order) => order.technicianId === user?.id),
    [orders, user?.id],
  );

  const codeOptions = kind === 'VC' ? assignedVcs.map((o) => o.code) : kind === 'OS' ? assignedOs.map((o) => o.omieOSNumber) : [];

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingRequests(true);
    const { data, error } = await supabase
      .from('part_requests')
      .select('*')
      .eq('technician_id', user.id)
      .order('requested_at', { ascending: false });

    if (error) {
      toast.error('Não foi possível carregar o histórico de peças.');
      setRequests([]);
      setIsLoadingRequests(false);
      return;
    }

    const mapped: PartRequest[] = (data ?? []).map((row) => ({
      id: String(row.id),
      orderType: (row.order_type as RequestKind) ?? 'VC',
      orderCode: String(row.order_code ?? ''),
      partDescription: String(row.part_description ?? ''),
      quantity: Number(row.quantity ?? 0),
      technicianId: String(row.technician_id ?? ''),
      technicianName: String(row.technician_name ?? ''),
      requestedAt: new Date(String(row.requested_at)),
      received: Boolean(row.received),
      receivedAt: row.received_at ? new Date(String(row.received_at)) : undefined,
    }));
    setRequests(mapped);
    setIsLoadingRequests(false);
  }, [user?.id]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const resetForm = () => {
    setKind('');
    setCode('');
    setDescription('');
    setQuantity('');
  };

  const isFormComplete = Boolean(kind) && Boolean(code) && description.trim().length > 0 && Boolean(quantity);

  const handleSubmit = async () => {
    if (!isFormComplete || !user?.id) {
      toast.error('Preencha os 4 campos: tipo, código, peça e quantidade.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('part_requests').insert({
        order_type: kind,
        order_code: code,
        part_description: description.trim(),
        quantity: Number(quantity),
        technician_id: user.id,
        technician_name: user.name,
        received: false,
      });

      if (insertError) throw insertError;

      // A mudança automática de status só se aplica a VC em Ordem de Produção.
      if (kind === 'VC') {
        const productionOrder = assignedVcs.find((o) => o.code === code);
        if (productionOrder && productionOrder.status !== 'WAITING_PART') {
          const previousStatus = productionOrder.status;
          const draft = toProductionOrderDraft(productionOrder, {
            status: 'WAITING_PART',
            waitingPartDescription: description.trim(),
            waitingPartFromStatus: previousStatus === 'IN_PRODUCTION' ? 'IN_PRODUCTION' : undefined,
          });
          await updateProductionOrder(productionOrder.id, { ...draft, actorUserId: user.id });
          await supabase.from('production_order_history').insert({
            unit_id: productionOrder.unitId,
            production_order_id: productionOrder.id,
            previous_status: previousStatus,
            new_status: 'WAITING_PART',
            user_id: user.id,
            user_name: user.name,
            notes: `Peça solicitada: ${description.trim()} (qtd. ${quantity}).`,
          });
        }
      }

      toast.success('Solicitação de peça enviada.');
      resetForm();
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar solicitação de peça.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceived = async (request: PartRequest) => {
    if (request.received || !user?.id) return;
    setReceivingId(request.id);
    try {
      const { error: updateError } = await supabase
        .from('part_requests')
        .update({ received: true, received_at: new Date().toISOString() })
        .eq('id', request.id);

      if (updateError) throw updateError;

      if (request.orderType === 'VC') {
        const productionOrder = productionOrders.find((o) => o.code === request.orderCode);
        if (productionOrder && productionOrder.status === 'WAITING_PART') {
          const draft = toProductionOrderDraft(productionOrder, {
            status: 'IN_PRODUCTION',
            waitingPartDescription: undefined,
            waitingPartFromStatus: undefined,
          });
          await updateProductionOrder(productionOrder.id, { ...draft, actorUserId: user.id });
          await supabase.from('production_order_history').insert({
            unit_id: productionOrder.unitId,
            production_order_id: productionOrder.id,
            previous_status: 'WAITING_PART',
            new_status: 'IN_PRODUCTION',
            user_id: user.id,
            user_name: user.name,
            notes: `Peça recebida: ${request.partDescription}. Produção retomada.`,
          });
        }
      }

      toast.success('Peça marcada como recebida.');
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao confirmar recebimento.');
    } finally {
      setReceivingId(null);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Peças" description="Solicite peças para as VC/OS atribuídas a você." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5" />
            Solicitar Peça
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <Label>Atribuir VC ou OS *</Label>
              <Select
                value={kind}
                onValueChange={(value) => {
                  setKind(value as RequestKind);
                  setCode('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VC">VC</SelectItem>
                  <SelectItem value="OS">OS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Código da {kind || 'VC/OS'} *</Label>
              <Select value={code} onValueChange={setCode} disabled={!kind}>
                <SelectTrigger>
                  <SelectValue placeholder={kind ? 'Selecione o código' : 'Selecione o tipo primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {codeOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Nenhuma {kind} atribuída a você.
                    </div>
                  ) : (
                    codeOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {kind && code && (
            <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
              <div className="space-y-2 md:col-span-2">
                <Label>Peça *</Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Descreva a peça necessária"
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <Select value={quantity} onValueChange={setQuantity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a quantidade" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {Array.from({ length: 100 }, (_, index) => index + 1).map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button onClick={() => void handleSubmit()} disabled={!isFormComplete || isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Solicitações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRequests ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma peça solicitada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Peça</TableHead>
                  <TableHead>Qtd.</TableHead>
                  <TableHead>Solicitado por</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(request.requestedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{request.orderType}</TableCell>
                    <TableCell className="font-medium">{request.orderCode}</TableCell>
                    <TableCell className="max-w-xs truncate" title={request.partDescription}>
                      {request.partDescription}
                    </TableCell>
                    <TableCell>{request.quantity}</TableCell>
                    <TableCell>{request.technicianName}</TableCell>
                    <TableCell>
                      {request.received ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Recebida</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!request.received && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleReceived(request)}
                          disabled={receivingId === request.id}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Peça Recebida
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
