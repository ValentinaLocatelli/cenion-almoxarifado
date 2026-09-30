import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, ArrowLeft, FileDown, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppData } from '@/contexts/AppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductionOrder, ProductionOrderStatus, ProductionProductSpecification } from '@/types/production';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { SpecifyProductModal } from '@/components/production/SpecifyProductModal';
import { downloadProductionOrderAsPdf } from '@/lib/orderPdf';

const SELLER_NAMES = [
  'Eliezer Candaten',
  'Nerimar Gehlen',
  'Claudinei Mudrak',
  'Dione Alchieri',
  'Lucas Fiorentin',
  'André Vitor dos Santos',
];

const purposeLabels: Record<'SALE' | 'PURCHASE' | 'RENTAL', string> = {
  SALE: 'Venda',
  PURCHASE: 'Compra',
  RENTAL: 'Locação',
};

const statusLabels: Record<ProductionOrderStatus, string> = {
  OPEN: 'Aberta',
  ATTRIBUTED: 'Atribuída',
  IN_PRODUCTION: 'Em Produção',
  WAITING_PART: 'Aguardando Peça',
  IN_TESTING: 'Em Teste',
  FINISHING: 'Finalizando',
  COMPLETED: 'Concluída',
  DISPATCHED: 'Despachada',
  FINALIZED: 'Finalizada',
};

function toDraft(order: ProductionOrder, patch: Partial<ProductionOrder>) {
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
  };
}

function statusBadgeClass(status: ProductionOrderStatus): string {
  if (status === 'FINALIZED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'DISPATCHED') return 'bg-violet-100 text-violet-700';
  if (status === 'COMPLETED') return 'bg-teal-100 text-teal-700';
  if (status === 'WAITING_PART') return 'bg-orange-100 text-orange-700';
  if (status === 'IN_TESTING') return 'bg-cyan-100 text-cyan-700';
  if (status === 'FINISHING') return 'bg-fuchsia-100 text-fuchsia-700';
  if (status === 'IN_PRODUCTION') return 'bg-amber-100 text-amber-700';
  if (status === 'ATTRIBUTED') return 'bg-indigo-100 text-indigo-700';
  return 'bg-blue-100 text-blue-700';
}


function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Falha ao carregar arquivo: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

interface ProductionHistoryEntry {
  id: string;
  previousStatus: ProductionOrderStatus;
  newStatus: ProductionOrderStatus;
  userName: string;
  notes?: string;
  createdAt: Date;
}

export default function ProductionOrderDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const backView = searchParams.get('view') === 'kanban' ? 'kanban' : 'table';
  const backToList = `/production-orders?view=${backView}`;
  const { user, isManager, isTechnician } = useAuth();
  const { users, productionOrders, updateProductionOrder } = useAppData();
  const order = useMemo(() => productionOrders.find((entry) => entry.id === id), [productionOrders, id]);
  const technicians = useMemo(
    () => users.filter((entry) => entry.role === 'TECNICO' && entry.active && entry.unitId === order?.unitId),
    [users, order?.unitId],
  );
  const sellers = SELLER_NAMES;
  const [assignedTechnicianId, setAssignedTechnicianId] = useState('UNASSIGNED');
  const [assignedSellerName, setAssignedSellerName] = useState('UNASSIGNED');
  const [waitingPartInput, setWaitingPartInput] = useState('');
  const [dispatchCarrier, setDispatchCarrier] = useState('');
  const [dispatchTrackingLink, setDispatchTrackingLink] = useState('');
  const [dispatchTrackingNumber, setDispatchTrackingNumber] = useState('');
  const [dispatchDeliveryDate, setDispatchDeliveryDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSpecifyModalOpen, setIsSpecifyModalOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<ProductionHistoryEntry[]>([]);
  const [showVcUpdatePanel, setShowVcUpdatePanel] = useState(false);
  const [selectedVcStatus, setSelectedVcStatus] = useState<ProductionOrderStatus | ''>('');

  const loadHistory = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('production_order_history')
      .select('*')
      .eq('production_order_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      setHistoryEntries([]);
      return;
    }

    const mapped = (data ?? []).map((row) => ({
      id: String(row.id),
      previousStatus: String(row.previous_status ?? 'OPEN') as ProductionOrderStatus,
      newStatus: String(row.new_status ?? 'OPEN') as ProductionOrderStatus,
      userName: String(row.user_name ?? 'Sistema'),
      notes: typeof row.notes === 'string' ? row.notes : undefined,
      createdAt: new Date(String(row.created_at)),
    }));
    setHistoryEntries(mapped);
  }, [id]);

  useEffect(() => {
    if (!order) return;
    setAssignedTechnicianId(order.technicianId ?? 'UNASSIGNED');
    setAssignedSellerName(
      order.client.sellerName && sellers.includes(order.client.sellerName)
        ? order.client.sellerName
        : 'UNASSIGNED',
    );
    setWaitingPartInput(order.waitingPartDescription ?? '');
    setDispatchCarrier(order.carrier ?? '');
    setDispatchTrackingLink(order.trackingLink ?? '');
    setDispatchTrackingNumber(order.trackingNumber ?? '');
    setDispatchDeliveryDate(order.deliveryDate ? format(order.deliveryDate, 'yyyy-MM-dd') : '');
  }, [order, sellers]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Ordem de produção não encontrada</h2>
        <Button asChild>
          <Link to={backToList}>Voltar para lista</Link>
        </Button>
      </div>
    );
  }

  if (isTechnician && order.technicianId !== user?.id) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso negado</h2>
        <p className="text-muted-foreground mb-4">Você só pode visualizar OPs atribuídas ao seu usuário.</p>
        <Button asChild>
          <Link to={backToList}>Voltar para lista</Link>
        </Button>
      </div>
    );
  }

  const savePatch = async (
    patch: Partial<ProductionOrder>,
    successMessage: string,
    historyNote?: string,
    forceHistory = false,
  ) => {
    setIsSaving(true);
    try {
      const previousStatus = order.status;
      const nextStatus = patch.status ?? previousStatus;
      const draft = toDraft(order, patch);
      await updateProductionOrder(order.id, {
        ...draft,
        actorUserId: user?.id,
      });

      const shouldLogHistory = forceHistory || nextStatus !== previousStatus || Boolean(historyNote?.trim());
      if (shouldLogHistory) {
        await supabase.from('production_order_history').insert({
          unit_id: order.unitId,
          production_order_id: order.id,
          previous_status: previousStatus,
          new_status: nextStatus,
          user_id: user?.id ?? 'SYSTEM',
          user_name: user?.name ?? 'Sistema',
          notes: historyNote?.trim() || null,
        });
      }

      await loadHistory();
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a ordem de produção.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignTechnician = async () => {
    if (!order.productSpecification) {
      toast.error('Especifique o produto antes de atribuir um técnico.');
      return;
    }
    const nextTechnicianId = assignedTechnicianId === 'UNASSIGNED' ? undefined : assignedTechnicianId;
    const nextTechnicianName = nextTechnicianId
      ? technicians.find((tech) => tech.id === nextTechnicianId)?.name
      : undefined;
    let nextStatus = order.status;
    if (order.status === 'OPEN' && nextTechnicianId) nextStatus = 'ATTRIBUTED';
    if (order.status === 'ATTRIBUTED' && !nextTechnicianId) nextStatus = 'OPEN';
    const assignmentNote = nextTechnicianName
      ? `Técnico atribuído: ${nextTechnicianName}.`
      : 'Técnico removido da VC.';
    await savePatch(
      {
        technicianId: nextTechnicianId,
        technicianName: nextTechnicianName,
        status: nextStatus,
      },
      'Técnico atribuído com sucesso.',
      assignmentNote,
      true,
    );
  };

  const handleAssignSeller = async () => {
    const nextSellerName = assignedSellerName === 'UNASSIGNED' ? '' : assignedSellerName;
    const assignmentNote = nextSellerName
      ? `Vendedor atribuído: ${nextSellerName}.`
      : 'Vendedor removido da VC.';
    await savePatch(
      {
        client: {
          ...order.client,
          sellerName: nextSellerName,
        },
      },
      'Vendedor atribuído com sucesso.',
      assignmentNote,
      true,
    );
  };

  const handleSaveProductSpecification = async (spec: ProductionProductSpecification) => {
    await savePatch(
      {
        productSpecification: {
          ...spec,
          specifiedBy: user?.name,
          specifiedAt: new Date(),
        },
      },
      'Produto especificado com sucesso.',
      'Produto especificado.',
      true,
    );
    setIsSpecifyModalOpen(false);
  };



  const handleStartProduction = async () => {
    await savePatch(
      {
        status: 'IN_PRODUCTION',
        productionStartTime: order.productionStartTime ?? new Date(),
        waitingPartDescription: undefined,
        waitingPartFromStatus: undefined,
      },
      'Produção iniciada.',
      'Produção iniciada pelo técnico.',
    );
  };

  const VC_UPDATE_OPTIONS: { value: ProductionOrderStatus; label: string; disabled?: boolean }[] = [
    { value: 'IN_PRODUCTION', label: 'Em Produção' },
    { value: 'WAITING_PART', label: 'Aguardando Peça (automático, via a aba Peças)', disabled: true },
    { value: 'COMPLETED', label: 'Produção Finalizada' },
    { value: 'IN_TESTING', label: 'Em Teste' },
    { value: 'FINISHING', label: 'Finalizando' },
    { value: 'FINALIZED', label: 'Finalizada (envia para o comercial)' },
  ];

  const handleUpdateVcStatus = async () => {
    if (!selectedVcStatus) {
      toast.error('Selecione o novo status da VC.');
      return;
    }
    if (selectedVcStatus === 'WAITING_PART') {
      toast.error('"Aguardando Peça" só é definido automaticamente ao solicitar uma peça na aba Peças.');
      return;
    }
    if (selectedVcStatus === order.status) {
      toast.error('A VC já está nesse status.');
      return;
    }
    const patch: Partial<ProductionOrder> =
      selectedVcStatus === 'COMPLETED'
        ? { status: selectedVcStatus, productionEndTime: order.productionEndTime ?? new Date() }
        : { status: selectedVcStatus };
    await savePatch(
      patch,
      'VC atualizada.',
      `Status atualizado para "${statusLabels[selectedVcStatus]}" via Atualizar VC.`,
    );
    setSelectedVcStatus('');
    setShowVcUpdatePanel(false);
  };

  const handleWaitPart = async () => {
    const reason = waitingPartInput.trim();
    if (!reason) {
      toast.error('Informe a peça/insumo aguardado.');
      return;
    }
    await savePatch(
      {
        status: 'WAITING_PART',
        waitingPartDescription: reason,
        waitingPartFromStatus: 'IN_PRODUCTION',
      },
      'VC movida para Aguardando Peça.',
      `Aguardando peça/insumo: ${reason}.`,
    );
  };

  const handleResumeProduction = async () => {
    await savePatch(
      {
        status: 'IN_PRODUCTION',
        waitingPartDescription: undefined,
        waitingPartFromStatus: undefined,
      },
      'Produção retomada.',
      'Peça/insumo recebido. Produção retomada.',
    );
  };

  const handleCompleteProduction = async () => {
    await savePatch(
      {
        status: 'COMPLETED',
        productionEndTime: new Date(),
        waitingPartDescription: undefined,
        waitingPartFromStatus: undefined,
      },
      'VC concluída pelo técnico.',
      'Produção concluída pelo técnico.',
    );
  };

  const handleDispatch = async () => {
    const carrier = dispatchCarrier.trim();
    const trackingLink = dispatchTrackingLink.trim();
    const deliveryDate = dispatchDeliveryDate ? new Date(`${dispatchDeliveryDate}T00:00:00`) : undefined;
    if (!carrier || !trackingLink || !deliveryDate) {
      toast.error('Preencha logística, link de rastreio e data.');
      return;
    }
    await savePatch(
      {
        status: 'DISPATCHED',
        carrier,
        trackingLink,
        trackingNumber: dispatchTrackingNumber.trim() || undefined,
        deliveryDate,
      },
      'Despacho registrado com sucesso.',
      `Despacho registrado. Logística: ${carrier}.`,
    );
  };

  const handleFinalize = async () => {
    await savePatch({ status: 'FINALIZED' }, 'Ordem de produção finalizada.', 'VC finalizada após confirmação de entrega.');
  };

  const handleProductionAttachments = async (files: FileList | null) => {
    if (!files) return;
    const selectedFiles = Array.from(files).slice(0, 20);
    try {
      const mapped = await Promise.all(
        selectedFiles.map(async (file) => ({
          fileName: file.name,
          dataUrl: await readFileAsDataUrl(file),
          mimeType: file.type || undefined,
          sizeBytes: file.size,
          uploadedAt: new Date(),
        })),
      );
      await savePatch(
        {
          productionAttachments: [...(order.productionAttachments ?? []), ...mapped].slice(0, 20),
        },
        'Anexos da produção salvos.',
        `${mapped.length} anexo(s) adicionado(s) à produção.`,
        true,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar anexos.');
    }
  };

  const removeProductionAttachment = async (index: number) => {
    await savePatch(
      {
        productionAttachments: (order.productionAttachments ?? []).filter((_, itemIndex) => itemIndex !== index),
      },
      'Anexo removido.',
      'Anexo da produção removido.',
      true,
    );
  };

  const canTechnicianAct = isTechnician && order.technicianId === user?.id;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-2 px-0">
            <Link to={backToList}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para ordens de produção
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{order.code}</h1>
          <p className="text-muted-foreground">{order.client.companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void downloadProductionOrderAsPdf(order)}
            title="Extrair PDF com todas as informações da ordem"
          >
            <FileDown className="mr-2 h-4 w-4" />
            Extrair PDF
          </Button>
          <Badge className={statusBadgeClass(order.status)}>{statusLabels[order.status]}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <p><strong>Tipo:</strong> {order.type === 'BATTERY' ? 'Bateria' : 'Carregador'}</p>
          <p><strong>Técnico:</strong> {order.technicianName || '-'}</p>
          <p><strong>Vendedor:</strong> {order.client.sellerName || '-'}</p>
          <p><strong>Contato:</strong> {order.client.contactName || '-'}</p>
          <p><strong>Telefone:</strong> {order.client.contactPhone || '-'}</p>
          <p><strong>Criada em:</strong> {format(order.createdAt, 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
          <p><strong>Atualizada em:</strong> {format(order.updatedAt, 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Especificação do Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.productSpecification ? (
              <>
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                  <p><strong>Capacidade:</strong> {order.productSpecification.capacityAh} AH</p>
                  <p><strong>Tensão:</strong> {order.productSpecification.voltageV} V</p>
                  <p><strong>Conector Carga:</strong> {order.productSpecification.chargeConnector === 'YES' ? 'Sim' : 'Não'}</p>
                  {order.productSpecification.chargeConnector === 'YES' && <p><strong>Modelo:</strong> {order.productSpecification.chargeConnectorModel || '-'}</p>}
                  <p><strong>Conector Descarga:</strong> {order.productSpecification.dischargeConnector === 'YES' ? 'Sim' : 'Não'}</p>
                  <p><strong>Corte de Elevação:</strong> {order.productSpecification.liftCutoff === 'YES' ? 'Sim' : 'Não'}</p>
                  <p><strong>Metro do Cabo:</strong> {order.productSpecification.cableLengthM || '-'}</p>
                  <p><strong>Comunicação CAN:</strong> {order.productSpecification.canCommunication === 'YES' ? 'Sim' : order.productSpecification.canCommunication === 'NO' ? 'Não' : '-'}</p>
                  <p><strong>Modelo do Carregador:</strong> {order.productSpecification.chargerModel}</p>
                  <p><strong>Modelo do BMS:</strong> {order.productSpecification.bmsModel === 'DALY' ? 'Daly' : 'Udan'}</p>
                  <p><strong>Peso:</strong> {order.productSpecification.weightKg || '-'}</p>
                  <p><strong>Ponte:</strong> {order.productSpecification.bridge === 'YES' ? 'Sim' : 'Não'}</p>
                  {order.productSpecification.bridge === 'YES' && <p><strong>Tipo de Conector:</strong> {order.productSpecification.bridgeConnectorType || '-'}</p>}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Produto ainda não especificado. Sem essa etapa, a VC não pode ser atribuída a um técnico.
                </p>
                <Button onClick={() => setIsSpecifyModalOpen(true)} disabled={isSaving}>
                  Especificar produto
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Entrega e Ordem de Compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>Finalidade:</strong> {order.delivery.purpose ? purposeLabels[order.delivery.purpose] : '-'}</p>
          <p><strong>Endereço:</strong> {order.delivery.address || '-'}</p>
          <p><strong>Cidade/UF:</strong> {order.delivery.city || '-'} / {order.delivery.state || '-'}</p>
          <p><strong>CEP:</strong> {order.delivery.zipCode || '-'}</p>
          <div>
            <p className="font-medium mb-2">Documentos da Ordem de Compra</p>
            {(order.purchaseOrderAttachments ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nenhum documento anexado.</p>
            ) : (
              <div className="space-y-1">
                {(order.purchaseOrderAttachments ?? []).map((attachment, index) => (
                  <a key={`${attachment.fileName}-${index}`} href={attachment.dataUrl} download={attachment.fileName} className="block underline">
                    {attachment.fileName}
                  </a>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Especificações Técnicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>Corrente do produto:</strong> {order.technicalSpecs?.current || '-'}</p>
          <p><strong>Tensão do produto:</strong> {order.technicalSpecs?.voltage || '-'}</p>
          <div>
            <p className="font-medium mb-2">Desenho Técnico Comercial</p>
            {order.technicalSpecs?.commercialDrawing ? (
              <a
                href={order.technicalSpecs.commercialDrawing.dataUrl}
                download={order.technicalSpecs.commercialDrawing.fileName}
                className="block underline"
              >
                {order.technicalSpecs.commercialDrawing.fileName}
              </a>
            ) : (
              <p className="text-muted-foreground">Nenhum arquivo anexado.</p>
            )}
          </div>
          <div>
            <p className="font-medium mb-2">Desenho Técnico de Montagem Geral</p>
            {order.technicalSpecs?.assemblyDrawing ? (
              <a
                href={order.technicalSpecs.assemblyDrawing.dataUrl}
                download={order.technicalSpecs.assemblyDrawing.fileName}
                className="block underline"
              >
                {order.technicalSpecs.assemblyDrawing.fileName}
              </a>
            ) : (
              <p className="text-muted-foreground">Nenhum arquivo anexado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {canTechnicianAct && (
        <Card>
          <CardHeader>
            <CardTitle>Fluxo do Técnico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(order.status === 'OPEN' || order.status === 'ATTRIBUTED') && (
                <Button onClick={() => void handleStartProduction()} disabled={isSaving}>Iniciar Produção</Button>
              )}
              {order.status === 'IN_PRODUCTION' && (
                <Button onClick={() => void handleCompleteProduction()} disabled={isSaving}>Concluir Produção</Button>
              )}
              {order.status === 'WAITING_PART' && (
                <Button onClick={() => void handleResumeProduction()} disabled={isSaving}>Retomar Produção</Button>
              )}
            </div>

            {(order.status === 'IN_PRODUCTION' || order.status === 'WAITING_PART') && (
              <div className="space-y-2 max-w-2xl">
                <Label>Aguardando peça/insumo</Label>
                <Textarea
                  value={waitingPartInput}
                  onChange={(event) => setWaitingPartInput(event.target.value)}
                  placeholder="Ex: aguardando BMS 48V, conector de descarga..."
                />
                {order.status === 'IN_PRODUCTION' && (
                  <Button variant="outline" onClick={() => void handleWaitPart()} disabled={isSaving}>
                    Pausar e mover para Aguardando Peça
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="production-attachments">Fotos/Documentos da Produção</Label>
              <Input
                id="production-attachments"
                type="file"
                multiple
                onChange={(event) => void handleProductionAttachments(event.target.files)}
              />
              {(order.productionAttachments ?? []).length > 0 && (
                <div className="space-y-1">
                  {(order.productionAttachments ?? []).map((attachment, index) => (
                    <div key={`${attachment.fileName}-${index}`} className="flex items-center justify-between rounded-md border px-2 py-1 text-sm">
                      <a href={attachment.dataUrl} download={attachment.fileName} className="truncate underline">
                        {attachment.fileName}
                      </a>
                      <Button variant="ghost" size="sm" onClick={() => void removeProductionAttachment(index)}>
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {canTechnicianAct && order.status !== 'DISPATCHED' && order.status !== 'FINALIZED' && (
        <Card>
          <CardHeader>
            <CardTitle>Atualizar VC</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(order.status === 'OPEN' || order.status === 'ATTRIBUTED') ? (
              <Button onClick={() => void handleStartProduction()} disabled={isSaving}>Iniciar Produção</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowVcUpdatePanel((current) => !current)}
                >
                  Atualizar VC
                </Button>
                {showVcUpdatePanel && (
                  <div className="flex flex-wrap items-center gap-2 max-w-xl">
                    <Select
                      value={selectedVcStatus}
                      onValueChange={(value) => setSelectedVcStatus(value as ProductionOrderStatus)}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Selecione o novo status" />
                      </SelectTrigger>
                      <SelectContent>
                        {VC_UPDATE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => void handleUpdateVcStatus()} disabled={isSaving || !selectedVcStatus}>
                      Confirmar
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {isManager && (order.status === 'COMPLETED' || order.status === 'DISPATCHED') && (
        <Card>
          <CardHeader>
            <CardTitle>{order.status === 'DISPATCHED' ? 'Confirmar Finalização' : 'Registrar Despacho'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Empresa de Logística</Label>
                <Input value={dispatchCarrier} onChange={(event) => setDispatchCarrier(event.target.value)} />
              </div>
              <div>
                <Label>Link de Rastreio</Label>
                <Input value={dispatchTrackingLink} onChange={(event) => setDispatchTrackingLink(event.target.value)} />
              </div>
              <div>
                <Label>Código de Rastreio</Label>
                <Input value={dispatchTrackingNumber} onChange={(event) => setDispatchTrackingNumber(event.target.value)} />
              </div>
              <div>
                <Label>Data prevista/recebimento</Label>
                <Input type="date" value={dispatchDeliveryDate} onChange={(event) => setDispatchDeliveryDate(event.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {order.status === 'COMPLETED' && (
                <Button onClick={() => void handleDispatch()} disabled={isSaving}>
                  <Upload className="w-4 h-4 mr-2" />
                  Confirmar despacho
                </Button>
              )}
              {order.status === 'DISPATCHED' && (
                <Button onClick={() => void handleFinalize()} disabled={isSaving}>
                  Finalizar VC
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico da Ordem de Produção</CardTitle>
        </CardHeader>
        <CardContent>
          {historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum histórico registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {historyEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge className={statusBadgeClass(entry.previousStatus)}>{statusLabels[entry.previousStatus]}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge className={statusBadgeClass(entry.newStatus)}>{statusLabels[entry.newStatus]}</Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    <strong>{entry.userName}</strong> em {format(entry.createdAt, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                  {entry.notes && <p className="mt-1 text-sm text-muted-foreground">{entry.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SpecifyProductModal
        open={isSpecifyModalOpen}
        onOpenChange={setIsSpecifyModalOpen}
        initialValue={order.productSpecification}
        onSave={handleSaveProductSpecification}
        isSaving={isSaving}
      />

    </div>
  );
}
