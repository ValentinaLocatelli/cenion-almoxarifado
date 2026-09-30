import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Battery, 
  Zap, 
  MapPin, 
  Phone, 
  Mail,
  FileText,
  Upload,
  History,
  CheckCircle,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  X,
  ChevronsUpDown,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PRODUCT_TYPE_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  blobToDataUrl,
  downloadPdfFromDataUrl,
  generateQuotePdfBlob,
  generateWarrantyNoCostPdfBlob,
} from '@/lib/orderPdf';
import { mapServiceOrderRow } from '@/lib/supabaseMappers';
import type { ApprovalDecision, OSStatus, ServiceOrder } from '@/types';

interface ServiceRow {
  id: string;
  serviceId: string | null;
  type: string;
  unitValue: number;
  quantity: number;
}

interface ServiceCatalogOption {
  id: string;
  serviceType: string;
  description: string;
  value: number;
}

interface QuoteImageDraft {
  id: string;
  fileName: string;
  dataUrl: string;
}

interface ManualOrderAction {
  label: string;
  nextStatus: OSStatus;
  successMessage: string;
  historyNote: string;
}

const DEFAULT_COMMERCIAL_CONDITIONS = {
  proposalValidity: '05 dias',
  paymentMethod: 'Boleto / Depósito',
  paymentTerms: '63 dias',
  deliveryDeadline: '30 dias úteis após aprovação',
  freightType: 'FOB',
  warrantyTerms: '03 meses após emissão da Nota Fiscal',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Falha ao carregar arquivo: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const typed = error as Record<string, unknown>;
    const parts = [typed.message, typed.details, typed.hint, typed.code]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .map((part) => String(part));
    if (parts.length > 0) return parts.join(' | ');
  }
  return fallback;
}

export default function OrderDetail() {
  const { user, isManager, isTechnician } = useAuth();
  const { orders, history: historyEntries, users, updateOrder, createHistory } = useAppData();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const backView = searchParams.get('view') === 'kanban' ? 'kanban' : 'table';
  const backToOrders = `/orders?view=${backView}`;
  const listOrder = useMemo(() => orders.find((entry) => entry.id === id), [orders, id]);
  const [fullOrder, setFullOrder] = useState<ServiceOrder>();
  const [isLoadingFullOrder, setIsLoadingFullOrder] = useState(false);
  const order = fullOrder ?? listOrder;
  const history = useMemo(
    () =>
      historyEntries
        .filter((entry) => entry.osId === id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [historyEntries, id]
  );
  const technicians = useMemo(
    () => users.filter((technician) => technician.role === 'TECNICO' && technician.active),
    [users]
  );
  const [currentStatus, setCurrentStatus] = useState<OSStatus>('IMPORTED_OPEN');
  const [assignedTechnicianId, setAssignedTechnicianId] = useState('UNASSIGNED');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isWarrantyNoCostModalOpen, setIsWarrantyNoCostModalOpen] = useState(false);
  const [isGeneratingWarrantyPdf, setIsGeneratingWarrantyPdf] = useState(false);
  const [warrantyDiagnosis, setWarrantyDiagnosis] = useState('');
  const [warrantySolution, setWarrantySolution] = useState('');
  const [pdfClientName, setPdfClientName] = useState('');
  const [pdfClientCnpj, setPdfClientCnpj] = useState('');
  const [pdfContactName, setPdfContactName] = useState('');
  const [pdfClientEmail, setPdfClientEmail] = useState('');
  const [pdfClientPhone, setPdfClientPhone] = useState('');
  const [pdfDiagnosis, setPdfDiagnosis] = useState('');
  const [pdfSolution, setPdfSolution] = useState('');
  const [pdfProposalValidity, setPdfProposalValidity] = useState(DEFAULT_COMMERCIAL_CONDITIONS.proposalValidity);
  const [pdfPaymentMethod, setPdfPaymentMethod] = useState(DEFAULT_COMMERCIAL_CONDITIONS.paymentMethod);
  const [pdfPaymentTerms, setPdfPaymentTerms] = useState(DEFAULT_COMMERCIAL_CONDITIONS.paymentTerms);
  const [pdfDeliveryDeadline, setPdfDeliveryDeadline] = useState(DEFAULT_COMMERCIAL_CONDITIONS.deliveryDeadline);
  const [pdfFreightType, setPdfFreightType] = useState(DEFAULT_COMMERCIAL_CONDITIONS.freightType);
  const [pdfWarrantyTerms, setPdfWarrantyTerms] = useState(DEFAULT_COMMERCIAL_CONDITIONS.warrantyTerms);
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([
    { id: '1', serviceId: null, type: '', unitValue: 0, quantity: 1 },
  ]);
  const [openServiceRowId, setOpenServiceRowId] = useState<string | null>(null);
  const [quoteImageDrafts, setQuoteImageDrafts] = useState<QuoteImageDraft[]>([]);
  const [waitingPartInput, setWaitingPartInput] = useState('');
  const [dispatchCarrier, setDispatchCarrier] = useState('');
  const [dispatchTrackingLink, setDispatchTrackingLink] = useState('');
  const [dispatchDeliveryDate, setDispatchDeliveryDate] = useState('');
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision | null>(null);
  const [approvalAttachment, setApprovalAttachment] = useState<ServiceOrder['approvalAttachment']>();
  const [isSavingApproval, setIsSavingApproval] = useState(false);
  const [isRemovingQuotePdf, setIsRemovingQuotePdf] = useState(false);
  const [isRemovingApprovalAttachment, setIsRemovingApprovalAttachment] = useState(false);
  const [solutionDraft, setSolutionDraft] = useState('');
  const [problemDraft, setProblemDraft] = useState('');
  const [technicalNotesDraft, setTechnicalNotesDraft] = useState('');
  const [technicalAttachmentDraft, setTechnicalAttachmentDraft] = useState<ServiceOrder['technicalAttachment']>();
  const [deliveryEvidenceDrafts, setDeliveryEvidenceDrafts] = useState<NonNullable<ServiceOrder['deliveryEvidenceAttachments']>>([]);
  const [isSavingTechnicalDetails, setIsSavingTechnicalDetails] = useState(false);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogOption[]>([]);
  const [isIrreparableModalOpen, setIsIrreparableModalOpen] = useState(false);
  const [irreparableReasonInput, setIrreparableReasonInput] = useState('');
  const [isMarkingIrreparable, setIsMarkingIrreparable] = useState(false);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [receiptComment, setReceiptComment] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editClientCnpj, setEditClientCnpj] = useState('');
  const [editClientEmail, setEditClientEmail] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editProductType, setEditProductType] = useState<'BATTERY' | 'CHARGER'>('BATTERY');
  const [editProductDescription, setEditProductDescription] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editPriority, setEditPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [editIsWarranty, setEditIsWarranty] = useState(false);
  const [editOrigin, setEditOrigin] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [manualAction, setManualAction] = useState<ManualOrderAction | null>(null);
  const [manualActionReason, setManualActionReason] = useState('');
  const [isManualActionSaving, setIsManualActionSaving] = useState(false);
  const assignedTechnicianName =
    assignedTechnicianId === 'UNASSIGNED'
      ? null
      : technicians.find((technician) => technician.id === assignedTechnicianId)?.name ?? null;

  const canManuallyControlOrder =
    user?.role === 'ADMIN'
    || (user?.role === 'SUPERVISOR' && user.permissions.manualOrderControl);
  const canAssignedTechnicianControl = isTechnician && user?.id === order?.technicianId;
  const canManageWorkflowStatus = canManuallyControlOrder || canAssignedTechnicianControl;
  const canOpenQuotePdfModal = isManager && (
    currentStatus === 'WAITING_BUDGET'
    || currentStatus === 'WAITING_APPROVAL'
    || currentStatus === 'SENT_TO_CUSTOMER'
    || currentStatus === 'IN_EXECUTION'
  );
  const serviceOptionLabel = (item: ServiceCatalogOption) =>
    `${item.serviceType} - ${item.description} (R$ ${item.value.toFixed(2)})`;

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    setFullOrder(undefined);
    setIsLoadingFullOrder(true);

    const loadFullOrder = async () => {
      const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (!isMounted) return;

      if (error) {
        console.error('Falha ao carregar OS completa:', error);
        toast.error(getErrorMessage(error, 'Não foi possível carregar os detalhes da OS.'));
        setIsLoadingFullOrder(false);
        return;
      }

      setFullOrder(mapServiceOrderRow(data as Record<string, unknown>));
      setIsLoadingFullOrder(false);
    };

    void loadFullOrder();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!listOrder) return;
    setFullOrder((current) => {
      if (current && current.updatedAt.getTime() >= listOrder.updatedAt.getTime()) return current;
      return listOrder;
    });
  }, [listOrder]);

  useEffect(() => {
    if (!order) return;

    setCurrentStatus(order.status);
    setAssignedTechnicianId(order.technicianId ?? 'UNASSIGNED');
    setPdfClientName(order.clientName ?? '');
    setPdfClientCnpj(order.clientCnpj ?? '');
    setPdfContactName(order.contactName ?? '');
    setPdfClientEmail(order.clientEmail ?? '');
    setPdfClientPhone(order.clientPhone ?? '');
    setPdfDiagnosis(order.problemDescription ?? '');
    setPdfSolution(order.solutionDescription ?? '');
    setPdfProposalValidity(DEFAULT_COMMERCIAL_CONDITIONS.proposalValidity);
    setPdfPaymentMethod(DEFAULT_COMMERCIAL_CONDITIONS.paymentMethod);
    setPdfPaymentTerms(DEFAULT_COMMERCIAL_CONDITIONS.paymentTerms);
    setPdfDeliveryDeadline(DEFAULT_COMMERCIAL_CONDITIONS.deliveryDeadline);
    setPdfFreightType(DEFAULT_COMMERCIAL_CONDITIONS.freightType);
    setPdfWarrantyTerms(DEFAULT_COMMERCIAL_CONDITIONS.warrantyTerms);
    setQuoteImageDrafts([]);
    setWaitingPartInput(order.waitingPartDescription ?? '');
    setDispatchCarrier(order.carrier ?? '');
    setDispatchTrackingLink(order.trackingLink ?? '');
    setDispatchDeliveryDate(order.deliveryDate ? format(order.deliveryDate, 'yyyy-MM-dd') : '');
    setApprovalDecision(order.approvalDecision ?? null);
    setApprovalAttachment(order.approvalAttachment);
    setProblemDraft(order.problemDescription ?? '');
    setSolutionDraft(order.solutionDescription ?? '');
    setTechnicalNotesDraft(order.technicalNotes ?? '');
    setTechnicalAttachmentDraft(order.technicalAttachment);
    setDeliveryEvidenceDrafts(order.deliveryEvidenceAttachments ?? []);
  }, [order]);

  useEffect(() => {
    if (!isManager) return;
    const loadServiceCatalog = async () => {
      const { data, error } = await supabase
        .from('service_catalog')
        .select('id,service_type,description,value')
        .eq('active', true)
        .order('service_type', { ascending: true })
        .order('description', { ascending: true });
      if (error) {
        console.error('Falha ao carregar lista de serviços:', error);
        return;
      }
      setServiceCatalog(
        (data ?? []).map((row) => ({
          id: String(row.id),
          serviceType: String(row.service_type ?? ''),
          description: String(row.description ?? ''),
          value: Number(row.value ?? 0),
        })),
      );
    };
    void loadServiceCatalog();
  }, [isManager]);

  if (!order && isLoadingFullOrder) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        Carregando ordem de serviço...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Ordem não encontrada</h2>
        <p className="text-muted-foreground mb-4">A ordem de serviço solicitada não existe.</p>
        <Button asChild>
          <Link to={backToOrders}>Voltar para lista</Link>
        </Button>
      </div>
    );
  }

  if (isTechnician && order.technicianId !== user?.id) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso negado</h2>
        <p className="text-muted-foreground mb-4">Você só pode visualizar ordens de serviço atribuídas ao seu usuário.</p>
        <Button asChild>
          <Link to={backToOrders}>Voltar para lista</Link>
        </Button>
      </div>
    );
  }

  const canTechnicianStartAnalysis =
    isTechnician
    && user?.id === order.technicianId
    && (currentStatus === 'IMPORTED_OPEN' || currentStatus === 'ATTRIBUTED');
  const canTechnicianStartExecution =
    isTechnician
    && user?.id === order.technicianId
    && currentStatus === 'WAITING_EXECUTION';
  const canTechnicianFinishExecution =
    isTechnician
    && user?.id === order.technicianId
    && currentStatus === 'IN_EXECUTION';
  const canEditTechnicalDetails =
    isTechnician
    && user?.id === order.technicianId
    && (currentStatus === 'IN_ANALYSIS' || currentStatus === 'IN_EXECUTION');
  const canEditTechnicalSection = isManager || canEditTechnicalDetails;

  const handleSaveOrder = async () => {
    if (!order) return;

    const nextTechnicianId = assignedTechnicianId === 'UNASSIGNED' ? undefined : assignedTechnicianId;
    const nextTechnicianName = nextTechnicianId
      ? technicians.find((technician) => technician.id === nextTechnicianId)?.name
      : undefined;

    let nextStatus = currentStatus;

    if (currentStatus === 'IMPORTED_OPEN' && nextTechnicianId) {
      nextStatus = 'ATTRIBUTED';
    }

    if (currentStatus === 'ATTRIBUTED' && !nextTechnicianId) {
      nextStatus = 'IMPORTED_OPEN';
    }

    const previousStatus = order.status;
    const previousTechnicianId = order.technicianId;

    try {
      await updateOrder(order.id, {
        technicianId: nextTechnicianId,
        technicianName: nextTechnicianName,
        status: nextStatus,
      });
      setCurrentStatus(nextStatus);

      if (previousStatus !== nextStatus) {
        await createHistory({
          osId: order.id,
          previousStatus,
          newStatus: nextStatus,
          userId: user?.id ?? 'SYSTEM',
          userName: user?.name ?? 'Sistema',
          notes: 'Status ajustado pela atribuição de técnico.',
          createdAt: new Date(),
        });
      }

      if (previousTechnicianId !== nextTechnicianId) {
        await createHistory({
          osId: order.id,
          previousStatus: nextStatus,
          newStatus: nextStatus,
          userId: user?.id ?? 'SYSTEM',
          userName: user?.name ?? 'Sistema',
          notes: `Técnico ${nextTechnicianName ? `atribuído: ${nextTechnicianName}` : 'removido da OS'}.`,
          createdAt: new Date(),
        });
      }

      toast.success('Ordem de serviço salva com sucesso');
    } catch {
      toast.error('Não foi possível salvar a ordem de serviço');
    }
  };

  const updateStatus = async (nextStatus: OSStatus, successMessage: string, notes?: string) => {
    if (!order) return;

    const previousStatus = order.status;
    const now = new Date();
    const patch: Partial<ServiceOrder> = {
      status: nextStatus,
    };

    if (nextStatus === 'IN_ANALYSIS' && !order.analysisStartTime) {
      patch.analysisStartTime = now;
    }

    if (nextStatus === 'WAITING_BUDGET') {
      patch.analysisEndTime = now;
    }

    if (nextStatus === 'IN_EXECUTION' && !order.executionStartTime) {
      patch.executionStartTime = now;
    }

    if (nextStatus === 'FINISHED_TECH' && !order.executionEndTime) {
      patch.executionEndTime = now;
    }

    try {
      await updateOrder(order.id, patch);
      setCurrentStatus(nextStatus);

      await createHistory({
        osId: order.id,
        previousStatus,
        newStatus: nextStatus,
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes,
        createdAt: now,
      });

      toast.success(successMessage);
      return true;
    } catch {
      toast.error('Não foi possível atualizar o status');
      return false;
    }
  };

  const manualOrderActions: ManualOrderAction[] = (() => {
    if (!canManuallyControlOrder) return [];

    if (currentStatus === 'IMPORTED_OPEN' || currentStatus === 'ATTRIBUTED') {
      return [{
        label: 'Iniciar Análise',
        nextStatus: 'IN_ANALYSIS',
        successMessage: 'Análise iniciada manualmente.',
        historyNote: 'Análise iniciada por controle manual.',
      }];
    }

    if (currentStatus === 'IN_ANALYSIS') {
      return [{
        label: 'Finalizar Análise',
        nextStatus: 'WAITING_BUDGET',
        successMessage: 'Análise finalizada manualmente.',
        historyNote: 'Análise finalizada por controle manual.',
      }];
    }

    if (currentStatus === 'WAITING_EXECUTION') {
      return [{
        label: 'Iniciar Execução',
        nextStatus: 'IN_EXECUTION',
        successMessage: 'Execução iniciada manualmente.',
        historyNote: 'Execução iniciada por controle manual.',
      }];
    }

    if (currentStatus === 'IN_EXECUTION') {
      return [{
        label: 'Finalizar Execução',
        nextStatus: 'FINISHED_TECH',
        successMessage: 'Execução finalizada manualmente.',
        historyNote: 'Execução finalizada por controle manual.',
      }];
    }

    return [];
  })();

  const openManualActionModal = (action: ManualOrderAction) => {
    setManualAction(action);
    setManualActionReason('');
  };

  const handleConfirmManualAction = async () => {
    if (!manualAction || !manualActionReason.trim()) return;

    const actorRole = user?.role === 'ADMIN' ? 'Admin' : 'Supervisor';
    const reason = manualActionReason.trim();

    setIsManualActionSaving(true);
    try {
      const didUpdate = await updateStatus(
        manualAction.nextStatus,
        manualAction.successMessage,
        `${manualAction.historyNote} ${actorRole}: ${user?.name ?? 'Sistema'}. Motivo: ${reason}.`,
      );
      if (!didUpdate) return;
      setManualAction(null);
      setManualActionReason('');
    } finally {
      setIsManualActionSaving(false);
    }
  };

  const handleMarkIrreparable = async () => {
    if (!order) return;
    if (!irreparableReasonInput.trim()) {
      toast.error('Informe o motivo pelo qual o equipamento não tem conserto.');
      return;
    }

    setIsMarkingIrreparable(true);
    const previousStatus = order.status;
    const now = new Date();

    try {
      await updateOrder(order.id, {
        status: 'FINISHED_TECH',
        irreparable: true,
        irreparableReason: irreparableReasonInput.trim(),
        analysisEndTime: now,
      });
      setCurrentStatus('FINISHED_TECH');

      await createHistory({
        osId: order.id,
        previousStatus,
        newStatus: 'FINISHED_TECH',
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes: `Equipamento marcado como Sem Conserto. Motivo: ${irreparableReasonInput.trim()}`,
        createdAt: now,
      });

      setIsIrreparableModalOpen(false);
      setIrreparableReasonInput('');
      toast.success('Equipamento marcado como Sem Conserto. OS finalizada para despacho.');
    } catch {
      toast.error('Não foi possível registrar o Sem Conserto.');
    } finally {
      setIsMarkingIrreparable(false);
    }
  };

  const moveToWaitingPart = async () => {
    if (!order) return;

    const pieceDescription = waitingPartInput.trim();
    if (!pieceDescription) {
      toast.error('Informe qual peça está aguardando.');
      return;
    }

    if (currentStatus !== 'IN_ANALYSIS' && currentStatus !== 'IN_EXECUTION') {
      toast.error('Só é possível aguardar peça durante análise ou execução.');
      return;
    }

    const previousStatus = currentStatus;

    try {
      await updateOrder(order.id, {
        waitingPartFromStatus: currentStatus as 'IN_ANALYSIS' | 'IN_EXECUTION',
        waitingPartDescription: pieceDescription,
        status: 'WAITING_PART',
      });
      setCurrentStatus('WAITING_PART');

      await createHistory({
        osId: order.id,
        previousStatus,
        newStatus: 'WAITING_PART',
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes: `Aguardando peça: ${pieceDescription}.`,
        createdAt: new Date(),
      });

      toast.success('Ordem movida para Aguardando Peça.');
    } catch {
      toast.error('Não foi possível mover para Aguardando Peça');
    }
  };

  const receiveWaitingPart = async () => {
    if (!order) return;

    const returnStatus = order.waitingPartFromStatus ?? 'IN_ANALYSIS';
    const previousStatus = order.status;
    const waitingPartDescription = order.waitingPartDescription;

    try {
      await updateOrder(order.id, {
        status: returnStatus,
        waitingPartFromStatus: undefined,
        waitingPartDescription: undefined,
      });
      setWaitingPartInput('');
      setCurrentStatus(returnStatus);

      await createHistory({
        osId: order.id,
        previousStatus,
        newStatus: returnStatus,
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes: `Peça recebida${waitingPartDescription ? `: ${waitingPartDescription}` : ''}.`,
        createdAt: new Date(),
      });

      toast.success(`Peça recebida. Ordem voltou para ${returnStatus === 'IN_EXECUTION' ? 'Em Execução' : 'Em Análise'}.`);
    } catch {
      toast.error('Não foi possível registrar o recebimento da peça');
    }
  };

  const handleDispatchOrder = async () => {
    if (!order) return;

    const carrier = dispatchCarrier.trim();
    const trackingLink = dispatchTrackingLink.trim();
    const deliveryDate = dispatchDeliveryDate ? new Date(`${dispatchDeliveryDate}T00:00:00`) : undefined;

    if (!carrier || !trackingLink || !deliveryDate) {
      toast.error('Preencha transportadora, link de rastreio e data de entrega.');
      return;
    }

    const previousStatus = order.status;

    try {
      await updateOrder(order.id, {
        carrier,
        trackingLink,
        deliveryDate,
        status: 'DISPATCHED',
      });
      setCurrentStatus('DISPATCHED');

      await createHistory({
        osId: order.id,
        previousStatus,
        newStatus: 'DISPATCHED',
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes: `Despacho realizado. Logística: ${carrier}. Rastreio: ${trackingLink}. Entrega prevista: ${format(deliveryDate, 'dd/MM/yyyy', { locale: ptBR })}.`,
        createdAt: new Date(),
      });

      toast.success('Despacho realizado com sucesso.');
    } catch {
      toast.error('Não foi possível registrar o despacho');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!order) return;
    const previousStatus = order.status;
    const deliveryDate = dispatchDeliveryDate
      ? new Date(`${dispatchDeliveryDate}T00:00:00`)
      : order.deliveryDate;

    if (deliveryEvidenceDrafts.length === 0) {
      toast.error('Anexe pelo menos uma evidência da entrega para confirmar.');
      return;
    }

    try {
      await updateOrder(order.id, {
        status: 'AWAITING_RECEIPT',
        deliveryDate,
        deliveryEvidenceAttachments: deliveryEvidenceDrafts,
      });
      setCurrentStatus('AWAITING_RECEIPT');

      await createHistory({
        osId: order.id,
        previousStatus,
        newStatus: 'AWAITING_RECEIPT',
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes: `Despacho confirmado. Aguardando confirmação de recebimento pelo cliente. Data prevista: ${deliveryDate ? format(deliveryDate, 'dd/MM/yyyy', { locale: ptBR }) : 'não informada'}.`,
        createdAt: new Date(),
      });

      toast.success('Despacho confirmado. Aguardando recebimento pelo cliente.');
    } catch {
      toast.error('Não foi possível confirmar o despacho.');
    }
  };

  const handleConfirmReceipt = async () => {
    if (!order) return;

    const confirmedAt = receiptDate ? new Date(`${receiptDate}T00:00:00`) : new Date();
    const previousStatus = order.status;

    setIsConfirmingReceipt(true);
    try {
      await updateOrder(order.id, {
        status: 'INVOICED',
        deliveryConfirmed: receiptConfirmed,
        deliveryComment: receiptComment.trim() || undefined,
        deliveryConfirmedAt: confirmedAt,
      });
      setCurrentStatus('INVOICED');

      const notes = [
        `Recebimento confirmado. Produto entregue: ${receiptConfirmed ? 'Sim' : 'Não'}.`,
        receiptComment.trim() ? `Comentário: ${receiptComment.trim()}` : '',
        `Data: ${format(confirmedAt, 'dd/MM/yyyy', { locale: ptBR })}.`,
      ].filter(Boolean).join(' ');

      await createHistory({
        osId: order.id,
        previousStatus,
        newStatus: 'INVOICED',
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes,
        createdAt: new Date(),
      });

      toast.success('Recebimento confirmado. OS finalizada com sucesso.');
    } catch {
      toast.error('Não foi possível confirmar o recebimento.');
    } finally {
      setIsConfirmingReceipt(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!order) return;
    setEditClientName(order.clientName);
    setEditClientCnpj(order.clientCnpj ?? '');
    setEditClientEmail(order.clientEmail ?? '');
    setEditClientPhone(order.clientPhone ?? '');
    setEditContactName(order.contactName ?? '');
    setEditProductType(order.productType);
    setEditProductDescription(order.productDescription);
    setEditSerialNumber(order.serialNumber ?? '');
    setEditPriority(order.priority);
    setEditIsWarranty(order.isWarranty);
    setEditOrigin(order.origin ?? '');
    setEditDestination(order.destination ?? '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!order) return;
    if (!editClientName.trim() || !editProductDescription.trim()) {
      toast.error('Nome do cliente e descrição do produto são obrigatórios.');
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateOrder(order.id, {
        clientName: editClientName.trim(),
        clientCnpj: editClientCnpj.trim() || undefined,
        clientEmail: editClientEmail.trim() || undefined,
        clientPhone: editClientPhone.trim() || undefined,
        contactName: editContactName.trim() || undefined,
        productType: editProductType,
        productDescription: editProductDescription.trim(),
        serialNumber: editSerialNumber.trim() || undefined,
        priority: editPriority,
        isWarranty: editIsWarranty,
        origin: editOrigin.trim() || undefined,
        destination: editDestination.trim() || undefined,
      });

      await createHistory({
        osId: order.id,
        previousStatus: order.status,
        newStatus: order.status,
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes: 'Dados da OS editados pelo gestor.',
        createdAt: new Date(),
      });

      setIsEditModalOpen(false);
      toast.success('OS atualizada com sucesso.');
    } catch {
      toast.error('Não foi possível salvar as alterações.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const addServiceRow = () => {
    setServiceRows((currentRows) => [
      ...currentRows,
      {
        id: crypto.randomUUID(),
        serviceId: null,
        type: '',
        unitValue: 0,
        quantity: 1,
      },
    ]);
  };

  const removeServiceRow = (id: string) => {
    setServiceRows((currentRows) => currentRows.filter((row) => row.id !== id));
  };

  const updateServiceRow = (
    id: string,
    field: 'serviceId' | 'type' | 'unitValue' | 'quantity',
    value: string | number | null,
  ) => {
    setServiceRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== id) return row;
        return { ...row, [field]: value };
      }),
    );
  };

  const handleServiceCatalogSelection = (id: string, selectedServiceId: string) => {
    if (selectedServiceId === 'NONE') {
      updateServiceRow(id, 'serviceId', null);
      updateServiceRow(id, 'type', '');
      return;
    }

    const selected = serviceCatalog.find((item) => item.id === selectedServiceId);
    if (!selected) return;

    updateServiceRow(id, 'serviceId', selected.id);
    updateServiceRow(id, 'type', selected.serviceType);
    updateServiceRow(id, 'unitValue', selected.value);
  };

  const totalServicesValue = serviceRows.reduce(
    (sum, row) => sum + row.unitValue * row.quantity,
    0,
  );

  const handleImagesSelection = async (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = Math.max(0, 6 - quoteImageDrafts.length);
    if (remainingSlots === 0) {
      toast.error('Limite de 6 imagens atingido.');
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    try {
      const nextDrafts = await Promise.all(
        selectedFiles.map(async (file) => ({
          id: crypto.randomUUID(),
          fileName: file.name,
          dataUrl: await readFileAsDataUrl(file),
        })),
      );
      setQuoteImageDrafts((current) => [...current, ...nextDrafts].slice(0, 6));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar imagens.';
      toast.error(message);
    }
  };

  const removeQuoteImageDraft = (id: string) => {
    setQuoteImageDrafts((current) => current.filter((draft) => draft.id !== id));
  };

  const handleDeliveryEvidenceSelection = async (files: FileList | null) => {
    if (!files) return;

    const selectedFiles = Array.from(files);
    const nextFiles = selectedFiles.slice(0, 10);

    try {
      const attachments = await Promise.all(
        nextFiles.map(async (file) => ({
          fileName: file.name,
          dataUrl: await readFileAsDataUrl(file),
          mimeType: file.type || undefined,
          sizeBytes: file.size,
          uploadedAt: new Date(),
        })),
      );

      setDeliveryEvidenceDrafts((current) => {
        const merged = [...current, ...attachments];
        return merged.slice(0, 10);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar evidências de entrega.';
      toast.error(message);
    }
  };

  const removeDeliveryEvidenceDraft = (index: number) => {
    setDeliveryEvidenceDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  };

  const handleGenerateQuotePdf = async () => {
    if (!order) return;

    const validServices = serviceRows.filter((row) => row.type.trim() && row.quantity > 0 && row.unitValue > 0);

    if (validServices.length === 0) {
      toast.error('Adicione ao menos um serviço com tipo, quantidade e valor.');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const blob = await generateQuotePdfBlob(order, {
        clientName: pdfClientName || order.clientName,
        clientCnpj: pdfClientCnpj || order.clientCnpj || '-',
        contactName: pdfContactName,
        clientEmail: pdfClientEmail,
        clientPhone: pdfClientPhone,
        diagnosis: pdfDiagnosis || problemDraft || '-',
        solution: pdfSolution || solutionDraft || '-',
        proposalValidity: pdfProposalValidity || DEFAULT_COMMERCIAL_CONDITIONS.proposalValidity,
        paymentMethod: pdfPaymentMethod || DEFAULT_COMMERCIAL_CONDITIONS.paymentMethod,
        paymentTerms: pdfPaymentTerms || DEFAULT_COMMERCIAL_CONDITIONS.paymentTerms,
        deliveryDeadline: pdfDeliveryDeadline || DEFAULT_COMMERCIAL_CONDITIONS.deliveryDeadline,
        freightType: pdfFreightType || DEFAULT_COMMERCIAL_CONDITIONS.freightType,
        warrantyTerms: pdfWarrantyTerms || DEFAULT_COMMERCIAL_CONDITIONS.warrantyTerms,
        services: validServices.map((row) => ({
          type: row.type,
          quantity: row.quantity,
          unitValue: row.unitValue,
        })),
        imageDataUrls: quoteImageDrafts.map((draft) => draft.dataUrl),
      });

      const dataUrl = await blobToDataUrl(blob);
      const fileName = `${order.omieOSNumber}-orcamento.pdf`;

      const shouldAdvance = currentStatus === 'WAITING_BUDGET';

      await updateOrder(order.id, {
        quotePdf: {
          fileName,
          dataUrl,
          generatedAt: new Date(),
        },
        quoteServices: validServices.map((row) => ({
          type: row.type,
          quantity: row.quantity,
          unitValue: row.unitValue,
        })),
        quoteTotalValue: totalServicesValue,
        ...(shouldAdvance && { status: 'WAITING_APPROVAL' as const }),
      });

      
      downloadPdfFromDataUrl(dataUrl, fileName);
      setIsPdfModalOpen(false);
      toast.success(shouldAdvance ? 'PDF gerado. OS avançada para Aguardando Aprovação.' : 'PDF gerado e salvo com sucesso.');
    } catch (error) {
      console.error('Falha ao gerar/salvar PDF de aprovação:', error);
      const message = getErrorMessage(error, 'Não foi possível gerar o PDF.');
      toast.error(message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleOpenQuotePdfModal = () => {
    setPdfDiagnosis(problemDraft || '');
    setPdfSolution(solutionDraft || '');
    setIsPdfModalOpen(true);
  };

  const handleOpenWarrantyNoCostModal = () => {
    setWarrantyDiagnosis(problemDraft || '');
    setWarrantySolution(solutionDraft || '');
    setIsWarrantyNoCostModalOpen(true);
  };

  const handleGenerateWarrantyNoCostPdf = async () => {
    if (!order) return;
    setIsGeneratingWarrantyPdf(true);
    try {
      const blob = await generateWarrantyNoCostPdfBlob(order, {
        diagnosis: warrantyDiagnosis || problemDraft || '-',
        solution: warrantySolution || solutionDraft || '-',
      });
      const dataUrl = await blobToDataUrl(blob);
      const fileName = `${order.omieOSNumber}-garantia.pdf`;
      const now = new Date();
const previousStatus = order.status;

await updateOrder(order.id, {
  quotePdf: { fileName, dataUrl, generatedAt: now },
  status: 'FINISHED_TECH',
  executionEndTime: order.executionEndTime ?? now,
});

setCurrentStatus('FINISHED_TECH');

await createHistory({
  osId: order.id,
  previousStatus,
  newStatus: 'FINISHED_TECH',
  userId: user?.id ?? 'SYSTEM',
  userName: user?.name ?? 'Sistema',
  notes:
    'Garantia sem custo acionada. Laudo de garantia gerado e OS finalizada pelo técnico.',
  createdAt: now,
});

      if (shouldAdvance) {
        setCurrentStatus('WAITING_APPROVAL');
        await createHistory({
          osId: order.id,
          previousStatus: 'WAITING_BUDGET',
          newStatus: 'WAITING_APPROVAL',
          userId: user?.id ?? 'SYSTEM',
          userName: user?.name ?? 'Sistema',
          notes: 'Laudo de garantia gerado e OS enviada para aprovação.',
          createdAt: new Date(),
        });
      }

      downloadPdfFromDataUrl(dataUrl, fileName);
      setIsWarrantyNoCostModalOpen(false);
     toast.success('Laudo de garantia gerado. OS movida para Finalizado Técnico.');
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível gerar o PDF.');
      toast.error(message);
    } finally {
      setIsGeneratingWarrantyPdf(false);
    }
  };

  const handleApprovalAttachmentSelection = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setApprovalAttachment({
        fileName: file.name,
        dataUrl,
        mimeType: file.type || undefined,
        sizeBytes: file.size,
        uploadedAt: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar anexo de aprovação.';
      toast.error(message);
    }
  };

  const handleSaveApprovalDecision = async () => {
    if (!order) return;
    if (!approvalDecision) {
      toast.error('Selecione Aprovado ou Não Aprovado.');
      return;
    }

    setIsSavingApproval(true);
    const previousStatus = order.status;
    const nextStatus: OSStatus = approvalDecision === 'APPROVED' ? 'WAITING_EXECUTION' : 'FINISHED_TECH';
    const note =
      approvalDecision === 'APPROVED'
        ? 'Aprovação registrada como APROVADO. OS movida para Aguardando Execução.'
        : 'Orçamento não aprovado pelo cliente. OS movida para Finalizado (Técnico) para despacho de retorno.';

    try {
      await updateOrder(order.id, {
        status: nextStatus,
        approvalDecision,
        approvalAttachment,
        approvalDate: new Date(),
      });
      setCurrentStatus(nextStatus);

      await createHistory({
        osId: order.id,
        previousStatus,
        newStatus: nextStatus,
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes: note,
        createdAt: new Date(),
      });

      toast.success('Aprovação salva com sucesso.');
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível salvar a decisão de aprovação.');
      if (message.toLowerCase().includes('approval_decision') || message.toLowerCase().includes('approval_attachment')) {
        toast.error('Banco desatualizado para aprovação. Execute o SQL de migração add_approval_fields_and_waiting_execution.sql.');
      } else {
        toast.error(message);
      }
    } finally {
      setIsSavingApproval(false);
    }
  };

  const handleRemoveQuotePdf = async () => {
    if (!order?.quotePdf) return;
    setIsRemovingQuotePdf(true);
    try {
      await updateOrder(order.id, { quotePdf: undefined });
      toast.success('PDF removido com sucesso.');
    } catch {
      toast.error('Não foi possível remover o PDF salvo.');
    } finally {
      setIsRemovingQuotePdf(false);
    }
  };

  const handleRemoveApprovalAttachment = async () => {
    if (!order?.approvalAttachment) return;
    setIsRemovingApprovalAttachment(true);
    try {
      await updateOrder(order.id, { approvalAttachment: undefined });
      setApprovalAttachment(undefined);
      toast.success('Anexo de aprovação removido com sucesso.');
    } catch {
      toast.error('Não foi possível remover o anexo de aprovação.');
    } finally {
      setIsRemovingApprovalAttachment(false);
    }
  };

  const handleTechnicalAttachmentSelection = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setTechnicalAttachmentDraft({
        fileName: file.name,
        dataUrl,
        mimeType: file.type || undefined,
        sizeBytes: file.size,
        uploadedAt: new Date(),
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Falha ao carregar anexo técnico.'));
    }
  };

  const handleSaveTechnicalDetails = async () => {
    if (!order) return;
    const nextProblem = problemDraft.trim() || undefined;
    const nextSolution = solutionDraft.trim() || undefined;
    const nextNotes = technicalNotesDraft.trim() || undefined;
    const nextAttachment = technicalAttachmentDraft;

    const describeFieldValue = (value?: string) => {
      const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
      if (!normalized) return 'sem conteúdo';
      return normalized.length <= 200 ? normalized : `${normalized.slice(0, 200)}…`;
    };

    const fieldChanges: string[] = [];
    if ((order.problemDescription ?? undefined) !== nextProblem) {
      fieldChanges.push(`Problema: "${describeFieldValue(nextProblem)}"`);
    }
    if ((order.solutionDescription ?? undefined) !== nextSolution) {
      fieldChanges.push(`Solução: "${describeFieldValue(nextSolution)}"`);
    }
    if ((order.technicalNotes ?? undefined) !== nextNotes) {
      fieldChanges.push(`Observações: "${describeFieldValue(nextNotes)}"`);
    }

    const currentAttachmentName = order.technicalAttachment?.fileName ?? '';
    const nextAttachmentName = nextAttachment?.fileName ?? '';
    if (currentAttachmentName !== nextAttachmentName) {
      fieldChanges.push(`Anexo: ${nextAttachmentName ? `"${nextAttachmentName}"` : 'removido'}`);
    }

    setIsSavingTechnicalDetails(true);
    try {
      await updateOrder(order.id, {
        problemDescription: nextProblem,
        solutionDescription: nextSolution,
        technicalNotes: nextNotes,
        technicalAttachment: nextAttachment,
      });
      await createHistory({
        osId: order.id,
        previousStatus: order.status,
        newStatus: order.status,
        userId: user?.id ?? 'SYSTEM',
        userName: user?.name ?? 'Sistema',
        notes: fieldChanges.length > 0
          ? `Detalhes técnicos atualizados: ${fieldChanges.join(' | ')}.`
          : 'Detalhes técnicos salvos sem alterações de conteúdo.',
        createdAt: new Date(),
      });
      toast.success('Detalhes técnicos salvos com sucesso.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível salvar os detalhes técnicos.'));
    } finally {
      setIsSavingTechnicalDetails(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to={backToOrders}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{order.omieOSNumber}</h1>
            <StatusBadge status={currentStatus} />
            <PriorityBadge priority={order.priority} />
            {order.isWarranty && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                Garantia
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">{order.clientName}</p>
        </div>
        {canTechnicianStartAnalysis ? (
          <Button
            onClick={() =>
              void updateStatus(
                'IN_ANALYSIS',
                'Análise iniciada com sucesso.',
                'Análise iniciada pelo técnico.',
              )
            }
          >
            Iniciar Análise
          </Button>
        ) : canTechnicianStartExecution ? (
          <Button
            onClick={() =>
              void updateStatus(
                'IN_EXECUTION',
                'Execução iniciada com sucesso.',
                'Execução iniciada pelo técnico.',
              )
            }
          >
            Iniciar Execução
          </Button>
        ) : canTechnicianFinishExecution ? (
          <Button
            onClick={() =>
              void updateStatus(
                'FINISHED_TECH',
                'Execução finalizada com sucesso.',
                'Execução finalizada pelo técnico.',
              )
            }
          >
            Finalizar
          </Button>
        ) : isManager ? (
          <Button
            onClick={() =>
              void (currentStatus === 'WAITING_APPROVAL'
                ? handleSaveApprovalDecision()
                : handleSaveOrder())
            }
            disabled={isSavingApproval}
          >
            Salvar
          </Button>
        ) : null}
        {isManager && (
          <Button variant="outline" onClick={handleOpenEditModal}>
            Editar OS
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-8 space-y-6">
          {/* Product Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {order.productType === 'BATTERY' ? (
                  <Battery className="w-5 h-5" />
                ) : (
                  <Zap className="w-5 h-5" />
                )}
                Produto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-medium">{PRODUCT_TYPE_LABELS[order.productType]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="font-medium">{order.productDescription}</p>
                </div>
                {order.serialNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground">Número de Série</p>
                    <p className="font-medium font-mono">{order.serialNumber}</p>
                  </div>
                )}
                {(order.origin || order.destination) && (
                  <div className="grid grid-cols-2 gap-4">
                    {order.origin && (
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Origem
                        </p>
                        <p className="font-medium">{order.origin}</p>
                      </div>
                    )}
                    {order.destination && (
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Destino
                        </p>
                        <p className="font-medium">{order.destination}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes Técnicos</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="problem" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="problem">Problema</TabsTrigger>
                  <TabsTrigger value="solution">Solução</TabsTrigger>
                  <TabsTrigger value="attachments">Anexos</TabsTrigger>
                  <TabsTrigger value="technical-notes">Observações</TabsTrigger>
                </TabsList>
                <TabsContent value="problem" className="pt-4">
                  {canEditTechnicalSection ? (
                    <div className="space-y-2">
                      <Label htmlFor="problem-draft">Problema Identificado</Label>
                      <Textarea
                        id="problem-draft"
                        value={problemDraft}
                        onChange={(event) => setProblemDraft(event.target.value)}
                        placeholder="Descrever o problema identificado..."
                        className="min-h-28"
                      />
                    </div>
                  ) : order.problemDescription ? (
                    <p className="text-sm">{order.problemDescription}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum problema registrado ainda.</p>
                  )}
                </TabsContent>
                <TabsContent value="solution" className="pt-4">
                  {canEditTechnicalSection ? (
                    <div className="space-y-2">
                      <Label htmlFor="solution-draft">Solução Técnica</Label>
                      <Textarea
                        id="solution-draft"
                        value={solutionDraft}
                        onChange={(event) => setSolutionDraft(event.target.value)}
                        placeholder="Descreva a solução executada..."
                        className="min-h-28"
                      />
                    </div>
                  ) : order.solutionDescription ? (
                    <p className="text-sm">{order.solutionDescription}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma solução registrada ainda.</p>
                  )}
                </TabsContent>
                <TabsContent value="attachments" className="pt-4">
                  {canEditTechnicalSection ? (
                    <div className="space-y-2">
                      <Label htmlFor="technical-attachment">Anexo Técnico</Label>
                      <Input
                        id="technical-attachment"
                        type="file"
                        onChange={(event) => void handleTechnicalAttachmentSelection(event.target.files?.[0] ?? null)}
                      />
                      {technicalAttachmentDraft?.fileName ? (
                        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
                          <a
                            href={technicalAttachmentDraft.dataUrl}
                            download={technicalAttachmentDraft.fileName}
                            className="text-primary underline truncate pr-2"
                          >
                            {technicalAttachmentDraft.fileName}
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => setTechnicalAttachmentDraft(undefined)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum anexo técnico selecionado.</p>
                      )}
                    </div>
                  ) : order.technicalAttachment ? (
                    <a
                      href={order.technicalAttachment.dataUrl}
                      download={order.technicalAttachment.fileName}
                      className="text-sm text-primary underline"
                    >
                      {order.technicalAttachment.fileName}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum anexo técnico registrado.</p>
                  )}
                </TabsContent>
                <TabsContent value="technical-notes" className="pt-4">
                  {canEditTechnicalSection ? (
                    <div className="space-y-2">
                      <Label htmlFor="technical-notes-draft">Observações Técnicas</Label>
                      <Textarea
                        id="technical-notes-draft"
                        value={technicalNotesDraft}
                        onChange={(event) => setTechnicalNotesDraft(event.target.value)}
                        placeholder="Ex: medições, peças utilizadas, testes executados..."
                        className="min-h-28"
                      />
                    </div>
                  ) : order.technicalNotes ? (
                    <p className="text-sm">{order.technicalNotes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma observação técnica registrada.</p>
                  )}
                </TabsContent>
              </Tabs>
              {canEditTechnicalSection && (
                <div className="pt-4">
                  <Button onClick={() => void handleSaveTechnicalDetails()} disabled={isSavingTechnicalDetails}>
                    {isSavingTechnicalDetails ? 'Salvando...' : 'Salvar Detalhes Técnicos'}
                  </Button>
                </div>
              )}

              {order.irreparable && (
                <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 space-y-1">
                  <p className="text-sm font-semibold text-destructive">Sem Conserto</p>
                  <p className="text-sm text-muted-foreground">{order.irreparableReason}</p>
                </div>
              )}

              {canManageWorkflowStatus && currentStatus === 'IN_ANALYSIS' && !order.irreparable && (
                <div className="pt-2">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setIsIrreparableModalOpen(true)}
                  >
                    Sem Conserto
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum histórico registrado.
                  </p>
                ) : (
                  history.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex gap-4 pb-4",
                        index !== history.length - 1 && "border-b border-border"
                      )}
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{entry.userName}</span>
                          <span className="text-muted-foreground text-sm">alterou status para</span>
                          <StatusBadge status={entry.newStatus} />
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(entry.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Sidebar */}
        <div className="xl:col-span-4 space-y-6">

          <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Painel de ações e acompanhamento da OS
          </div>

          {/* Workflow Actions */}
          {canManageWorkflowStatus && (
            <Card>
              <CardHeader>
                <CardTitle>Ações da OS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(currentStatus === 'IN_ANALYSIS' || currentStatus === 'IN_EXECUTION') && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="waiting-part-input">Peça aguardada</Label>
                      <Input
                        id="waiting-part-input"
                        value={waitingPartInput}
                        onChange={(event) => setWaitingPartInput(event.target.value)}
                        placeholder="Ex: Módulo BMS 48V / IGBT / Ventilador..."
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => void moveToWaitingPart()}
                    >
                      Aguardar Peça
                    </Button>
                    {canAssignedTechnicianControl && currentStatus === 'IN_ANALYSIS' && (
                    <Button
                      className="w-full"
                      onClick={() =>
                        void updateStatus(
                          'WAITING_BUDGET',
                          'Análise finalizada. Aguardando geração do orçamento.',
                          'Análise técnica concluída.'
                        )
                      }
                    >
                      Finalizar Análise
                    </Button>
                    )}
                  </>
                )}

                {manualOrderActions.length > 0 && (
                  <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                    <p className="text-sm font-medium">Controle manual</p>
                    <p className="text-xs text-muted-foreground">
                      Use quando for necessário avançar a OS por limitação operacional do técnico.
                    </p>
                    {manualOrderActions.map((action) => (
                      <Button
                        key={`${action.nextStatus}-${action.label}`}
                        className="w-full"
                        variant="outline"
                        onClick={() => openManualActionModal(action)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}

                {currentStatus === 'WAITING_PART' && (
                  <>
                    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                      <span className="font-medium">Peça aguardada:</span>{' '}
                      {order.waitingPartDescription || 'Não informado'}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => void receiveWaitingPart()}
                    >
                      Peça Chegou
                    </Button>
                  </>
                )}

                {!['IN_ANALYSIS', 'IN_EXECUTION', 'WAITING_PART'].includes(currentStatus) && manualOrderActions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma ação de peça disponível para o status atual.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Receipt Confirmation */}
          {isManager && currentStatus === 'AWAITING_RECEIPT' && (
            <Card>
              <CardHeader>
                <CardTitle>Confirmar Recebimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(order.carrier || order.trackingLink || order.deliveryDate) && (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm space-y-1">
                    {order.carrier && <p><span className="text-muted-foreground">Transportadora:</span> {order.carrier}</p>}
                    {order.trackingLink && (
                      <p>
                        <span className="text-muted-foreground">Rastreio:</span>{' '}
                        <a href={order.trackingLink} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          {order.trackingLink}
                        </a>
                      </p>
                    )}
                    {order.deliveryDate && (
                      <p><span className="text-muted-foreground">Data prevista:</span> {format(order.deliveryDate, 'dd/MM/yyyy', { locale: ptBR })}</p>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="receipt-confirmed"
                    checked={receiptConfirmed}
                    onChange={(e) => setReceiptConfirmed(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="receipt-confirmed">Produto entregue ao cliente</Label>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-comment">Comentário</Label>
                  <Textarea
                    id="receipt-comment"
                    value={receiptComment}
                    onChange={(e) => setReceiptComment(e.target.value)}
                    placeholder="Ex: Boleto enviado por e-mail, cliente confirmou recebimento da NF..."
                    className="min-h-20"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-date">Data de Recebimento</Label>
                  <Input
                    id="receipt-date"
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => void handleConfirmReceipt()}
                  disabled={isConfirmingReceipt}
                >
                  {isConfirmingReceipt ? 'Confirmando...' : 'Confirmar Recebimento'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Dispatch Action */}
          {isManager && (currentStatus === 'FINISHED_TECH' || currentStatus === 'DISPATCHED') && (
            <Card>
              <CardHeader>
                <CardTitle>{currentStatus === 'DISPATCHED' ? 'Confirmar Entrega' : 'Registrar Despacho'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="dispatch-carrier">Empresa de Logística</Label>
                  <Input
                    id="dispatch-carrier"
                    value={dispatchCarrier}
                    onChange={(event) => setDispatchCarrier(event.target.value)}
                    placeholder="Ex: Jadlog, Correios, DHL..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dispatch-tracking-link">Link do Rastreio</Label>
                  <Input
                    id="dispatch-tracking-link"
                    value={dispatchTrackingLink}
                    onChange={(event) => setDispatchTrackingLink(event.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dispatch-delivery-date">Data de Entrega</Label>
                  <Input
                    id="dispatch-delivery-date"
                    type="date"
                    value={dispatchDeliveryDate}
                    onChange={(event) => setDispatchDeliveryDate(event.target.value)}
                  />
                </div>
                {currentStatus === 'DISPATCHED' && (
                  <div className="space-y-2">
                    <Label htmlFor="delivery-evidence-files">Evidências da Entrega (fotos/arquivos)</Label>
                    <Input
                      id="delivery-evidence-files"
                      type="file"
                      multiple
                      onChange={(event) => void handleDeliveryEvidenceSelection(event.target.files)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {deliveryEvidenceDrafts.length} arquivo(s) anexado(s). Máximo: 10.
                    </p>
                    {deliveryEvidenceDrafts.length > 0 && (
                      <div className="space-y-2">
                        {deliveryEvidenceDrafts.map((attachment, index) => (
                          <div
                            key={`${attachment.fileName}-${index}`}
                            className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"
                          >
                            <a
                              href={attachment.dataUrl}
                              download={attachment.fileName}
                              className="text-primary underline truncate pr-2"
                            >
                              {attachment.fileName}
                            </a>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => removeDeliveryEvidenceDraft(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {currentStatus === 'FINISHED_TECH' ? (
                  <Button className="w-full" onClick={() => void handleDispatchOrder()}>
                    Confirmar Despacho
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => void handleConfirmDelivery()}>
                    Confirmar Entrega
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Approval Decision */}
          {isManager && currentStatus === 'WAITING_APPROVAL' && (
            <Card>
              <CardHeader>
                <CardTitle>Aprovação do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Defina o resultado da aprovação e anexe o arquivo recebido do cliente.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className={cn(
                      'w-full',
                      approvalDecision === 'APPROVED'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    )}
                    onClick={() => setApprovalDecision('APPROVED')}
                  >
                    Aprovado
                  </Button>
                  <Button
                    type="button"
                    className={cn(
                      'w-full',
                      approvalDecision === 'REJECTED'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    )}
                    onClick={() => setApprovalDecision('REJECTED')}
                  >
                    Não Aprovado
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="approval-attachment">Upload da Aprovação</Label>
                  <Input
                    id="approval-attachment"
                    type="file"
                    onChange={(event) => void handleApprovalAttachmentSelection(event.target.files?.[0] ?? null)}
                  />
                  {approvalAttachment?.fileName && (
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
                      <a
                        href={approvalAttachment.dataUrl}
                        download={approvalAttachment.fileName}
                        className="text-primary underline truncate pr-2"
                      >
                        {approvalAttachment.fileName}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setApprovalAttachment(undefined)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          )}

          {/* Quote PDF */}
          {isManager && (
            <Card>
              <CardHeader>
                <CardTitle>Orçamento (PDF)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Gere o PDF do orçamento e clique em Salvar para enviar para aprovação.
                </p>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleOpenQuotePdfModal}
                  disabled={!canOpenQuotePdfModal}
                >
                  Gerar PDF de Aprovação
                </Button>

                {order.isWarranty && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleOpenWarrantyNoCostModal}
                    disabled={!canOpenQuotePdfModal}
                  >
                    Garantia sem Custo
                  </Button>
                )}

                {order.quotePdf && (
                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => downloadPdfFromDataUrl(order.quotePdf!.dataUrl, order.quotePdf!.fileName)}
                    >
                      Baixar PDF Salvo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={isRemovingQuotePdf}
                      onClick={() => void handleRemoveQuotePdf()}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {!canOpenQuotePdfModal && (
                  <p className="text-xs text-muted-foreground">
                    Disponível para gestores em Aguardando Aprovação, Enviado ao Cliente ou Em Execução.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Atribuição</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Técnico Responsável</p>
                <p className="font-medium">
                  {assignedTechnicianName || order.technicianName || 'Não atribuído'}
                </p>
              </div>
              {isManager ? (
                <>
                  <Select value={assignedTechnicianId} onValueChange={setAssignedTechnicianId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNASSIGNED">Não atribuído</SelectItem>
                      {technicians.map((technician) => (
                        <SelectItem key={technician.id} value={technician.id}>
                          {technician.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => void handleSaveOrder()}
                  >
                    Salvar Atribuição
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <p className="font-medium">{order.clientName}</p>
              </div>
              {order.contactName && (
                <div>
                  <p className="text-sm text-muted-foreground">Contato</p>
                  <p className="font-medium">{order.contactName}</p>
                </div>
              )}
              {order.clientCnpj && (
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ</p>
                  <p className="font-medium">{order.clientCnpj}</p>
                </div>
              )}
              {order.clientEmail && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> E-mail
                  </p>
                  <p className="font-medium">{order.clientEmail}</p>
                </div>
              )}
              {order.clientPhone && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> Telefone
                  </p>
                  <p className="font-medium">{order.clientPhone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Tempos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criação</span>
                <span>{format(order.createdAt, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última Atualização</span>
                <span>{format(order.updatedAt, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
              </div>
              {order.analysisStartTime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Início Análise</span>
                  <span>{format(order.analysisStartTime, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                </div>
              )}
              {order.analysisEndTime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fim Análise</span>
                  <span>{format(order.analysisEndTime, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                </div>
              )}
              {order.executionStartTime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Início Execução</span>
                  <span>{format(order.executionStartTime, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                </div>
              )}
              {order.executionEndTime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fim Execução</span>
                  <span>{format(order.executionEndTime, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchase Order */}
          {(order.purchaseOrderNumber || order.approvalDate || order.approvalDecision || order.approvalAttachment) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Aprovação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {order.purchaseOrderNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ordem de Compra</span>
                    <span className="font-mono">{order.purchaseOrderNumber}</span>
                  </div>
                )}
                {order.approvalDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Aprovação</span>
                    <span>{format(order.approvalDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}
                {order.approvalDecision && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resultado</span>
                    <span className={cn(
                      'font-medium',
                      order.approvalDecision === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {order.approvalDecision === 'APPROVED' ? 'Aprovado' : 'Não Aprovado'}
                    </span>
                  </div>
                )}
                {order.approvalAttachment && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Anexo</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={order.approvalAttachment.dataUrl}
                        download={order.approvalAttachment.fileName}
                        className="font-mono text-primary underline"
                      >
                        {order.approvalAttachment.fileName}
                      </a>
                      {isManager && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={isRemovingApprovalAttachment}
                          onClick={() => void handleRemoveApprovalAttachment()}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Shipping */}
          {(order.carrier || order.trackingLink || order.trackingNumber || order.deliveryDate || order.deliveryEvidenceAttachments?.length) && (
            <Card>
              <CardHeader>
                <CardTitle>Despacho</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {order.carrier && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transportadora</span>
                    <span>{order.carrier}</span>
                  </div>
                )}
                {(order.trackingLink || order.trackingNumber) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Link de Rastreio</span>
                    {order.trackingLink ? (
                      <a
                        href={order.trackingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-primary underline"
                      >
                        Abrir Link
                      </a>
                    ) : (
                      <span className="font-mono">{order.trackingNumber}</span>
                    )}
                  </div>
                )}
                {order.deliveryDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data de Entrega</span>
                    <span>{format(order.deliveryDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}
                {order.deliveryEvidenceAttachments && order.deliveryEvidenceAttachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">Evidências da Entrega</p>
                    <div className="space-y-2">
                      {order.deliveryEvidenceAttachments.map((attachment, index) => (
                        <div key={`${attachment.fileName}-${index}`} className="flex items-center justify-between">
                          <a
                            href={attachment.dataUrl}
                            download={attachment.fileName}
                            className="font-mono text-primary underline truncate pr-2"
                          >
                            {attachment.fileName}
                          </a>
                          <span className="text-xs text-muted-foreground">
                            {format(attachment.uploadedAt, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(order.deliveryConfirmed || order.deliveryComment || order.deliveryConfirmedAt) && (
            <Card>
              <CardHeader>
                <CardTitle>Confirmação de Recebimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produto entregue</span>
                  <span>{order.deliveryConfirmed ? 'Sim' : 'Não'}</span>
                </div>
                {order.deliveryConfirmedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data de recebimento</span>
                    <span>{format(order.deliveryConfirmedAt, 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                )}
                {order.deliveryComment && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Comentário</span>
                    <p className="text-sm">{order.deliveryComment}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      <Dialog open={!!manualAction} onOpenChange={(open) => {
        if (isManualActionSaving) return;
        if (!open) {
          setManualAction(null);
          setManualActionReason('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar ação manual</DialogTitle>
            <DialogDescription>
              {manualAction
                ? `Você está prestes a executar: ${manualAction.label}. Informe o motivo para registrar no histórico.`
                : 'Informe o motivo para registrar no histórico.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="manual-action-reason">Motivo *</Label>
              <Textarea
                id="manual-action-reason"
                value={manualActionReason}
                onChange={(event) => setManualActionReason(event.target.value)}
                placeholder="Ex: técnico sem acesso no momento, fechamento solicitado por telefone..."
                className="min-h-24"
                disabled={isManualActionSaving}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setManualAction(null);
                  setManualActionReason('');
                }}
                disabled={isManualActionSaving}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleConfirmManualAction()}
                disabled={isManualActionSaving || !manualActionReason.trim()}
              >
                {isManualActionSaving ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!isSavingEdit) setIsEditModalOpen(open); }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar OS {order.omieOSNumber}</DialogTitle>
            <DialogDescription>
              Edite os dados básicos da ordem de serviço.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-client-name">Cliente *</Label>
                <Input id="edit-client-name" value={editClientName} onChange={(e) => setEditClientName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-client-cnpj">CNPJ</Label>
                <Input id="edit-client-cnpj" value={editClientCnpj} onChange={(e) => setEditClientCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-client-email">E-mail</Label>
                <Input id="edit-client-email" type="email" value={editClientEmail} onChange={(e) => setEditClientEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-client-phone">Telefone</Label>
                <Input id="edit-client-phone" value={editClientPhone} onChange={(e) => setEditClientPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-contact-name">Nome do Contato</Label>
                <Input id="edit-contact-name" value={editContactName} onChange={(e) => setEditContactName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-serial-number">Número de Série</Label>
                <Input id="edit-serial-number" value={editSerialNumber} onChange={(e) => setEditSerialNumber(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-product-description">Descrição do Produto *</Label>
              <Textarea id="edit-product-description" value={editProductDescription} onChange={(e) => setEditProductDescription(e.target.value)} className="min-h-20" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo de Produto</Label>
                <Select value={editProductType} onValueChange={(v) => setEditProductType(v as 'BATTERY' | 'CHARGER')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BATTERY">Bateria</SelectItem>
                    <SelectItem value="CHARGER">Carregador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baixa</SelectItem>
                    <SelectItem value="MEDIUM">Média</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="CRITICAL">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-origin">Origem</Label>
                <Input id="edit-origin" value={editOrigin} onChange={(e) => setEditOrigin(e.target.value)} placeholder="Ex: São Paulo - SP" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-destination">Destino</Label>
                <Input id="edit-destination" value={editDestination} onChange={(e) => setEditDestination(e.target.value)} placeholder="Ex: Rio de Janeiro - RJ" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-warranty"
                checked={editIsWarranty}
                onChange={(e) => setEditIsWarranty(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="edit-warranty">Produto em Garantia</Label>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSaveEdit()} disabled={isSavingEdit}>
                {isSavingEdit ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isIrreparableModalOpen} onOpenChange={(open) => {
        if (!isMarkingIrreparable) {
          setIsIrreparableModalOpen(open);
          if (!open) setIrreparableReasonInput('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como Sem Conserto</DialogTitle>
            <DialogDescription>
              Esta ação finalizará a OS e a enviará para despacho de retorno ao cliente. Informe o motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="irreparable-reason">Motivo *</Label>
              <Textarea
                id="irreparable-reason"
                value={irreparableReasonInput}
                onChange={(e) => setIrreparableReasonInput(e.target.value)}
                placeholder="Ex: Dano irreparável no módulo BMS, custo de reparo inviável..."
                className="min-h-24"
                disabled={isMarkingIrreparable}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => { setIsIrreparableModalOpen(false); setIrreparableReasonInput(''); }}
                disabled={isMarkingIrreparable}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleMarkIrreparable()}
                disabled={isMarkingIrreparable || !irreparableReasonInput.trim()}
              >
                {isMarkingIrreparable ? 'Registrando...' : 'Confirmar Sem Conserto'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto max-w-6xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>Gerar PDF de Aprovação</DialogTitle>
              <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-md shrink-0">
                OS {order.omieOSNumber}
              </span>
            </div>
            <DialogDescription>
              Preencha os dados do cliente e serviços para montar a proposta. A página de imagens é opcional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pdf-client-name">Cliente</Label>
                <Input
                  id="pdf-client-name"
                  value={pdfClientName}
                  onChange={(event) => setPdfClientName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdf-client-cnpj">CNPJ</Label>
                <Input
                  id="pdf-client-cnpj"
                  value={pdfClientCnpj}
                  onChange={(event) => setPdfClientCnpj(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdf-contact-name">Contato</Label>
                <Input
                  id="pdf-contact-name"
                  value={pdfContactName}
                  onChange={(event) => setPdfContactName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdf-client-email">E-mail</Label>
                <Input
                  id="pdf-client-email"
                  value={pdfClientEmail}
                  onChange={(event) => setPdfClientEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdf-client-phone">Telefone</Label>
                <Input
                  id="pdf-client-phone"
                  value={pdfClientPhone}
                  onChange={(event) => setPdfClientPhone(event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pdf-diagnosis">Diagnóstico</Label>
                <Textarea
                  id="pdf-diagnosis"
                  value={pdfDiagnosis}
                  onChange={(event) => setPdfDiagnosis(event.target.value)}
                  placeholder="Descrição do diagnóstico técnico"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdf-solution">Solução</Label>
                <Textarea
                  id="pdf-solution"
                  value={pdfSolution}
                  onChange={(event) => setPdfSolution(event.target.value)}
                  placeholder="Descrição da solução aplicada/proposta"
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Serviços</Label>
                <Button type="button" size="sm" variant="outline" onClick={addServiceRow}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Serviço
                </Button>
              </div>

              <div className="space-y-2">
                {serviceRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-5">
                      <Label>Tipo</Label>
                      <Popover
                        open={openServiceRowId === row.id}
                        onOpenChange={(open) => setOpenServiceRowId(open ? row.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full min-w-0 justify-between font-normal"
                          >
                            <span className="truncate text-left">
                              {row.type || 'Selecione um serviço'}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[420px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Digite para filtrar serviço..." />
                            <CommandList>
                              <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                              <CommandGroup>
                                {serviceCatalog.map((item) => {
                                  const isSelected = row.serviceId === item.id;
                                  return (
                                    <CommandItem
                                      key={item.id}
                                      value={serviceOptionLabel(item)}
                                      onSelect={() => {
                                        handleServiceCatalogSelection(row.id, item.id);
                                        setOpenServiceRowId(null);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          isSelected ? 'opacity-100' : 'opacity-0',
                                        )}
                                      />
                                      {serviceOptionLabel(item)}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Qtd.</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(event) => updateServiceRow(row.id, 'quantity', Number(event.target.value))}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label>Valor Unitário</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.unitValue}
                        onChange={(event) => updateServiceRow(row.id, 'unitValue', Number(event.target.value))}
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={serviceRows.length === 1}
                        onClick={() => removeServiceRow(row.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="sm:col-span-12 text-xs text-muted-foreground">
                      Total da linha: R$ {(row.quantity * row.unitValue).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-sm font-semibold">
                Total dos serviços: R$ {totalServicesValue.toFixed(2)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdf-images">Imagens da página 2 (opcional, até 6)</Label>
              <Input
                id="pdf-images"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  void handleImagesSelection(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <p className="text-xs text-muted-foreground">
                {quoteImageDrafts.length} imagem(ns) selecionada(s). Você pode adicionar mais arquivos até 6.
              </p>
              {quoteImageDrafts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {quoteImageDrafts.map((draft, index) => (
                    <div key={draft.id} className="border rounded-md p-2 space-y-2">
                      <div className="aspect-video bg-muted rounded-sm overflow-hidden">
                        <img
                          src={draft.dataUrl}
                          alt={`Prévia da imagem ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs truncate">{draft.fileName}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeQuoteImageDraft(draft.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Label>Condições Comerciais</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pdf-proposal-validity">Validade da Proposta</Label>
                  <Input
                    id="pdf-proposal-validity"
                    value={pdfProposalValidity}
                    onChange={(event) => setPdfProposalValidity(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdf-payment-method">Forma de Pagamento</Label>
                  <Input
                    id="pdf-payment-method"
                    value={pdfPaymentMethod}
                    onChange={(event) => setPdfPaymentMethod(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdf-payment-terms">Condições de Pagamento</Label>
                  <Input
                    id="pdf-payment-terms"
                    value={pdfPaymentTerms}
                    onChange={(event) => setPdfPaymentTerms(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdf-delivery-deadline">Prazo de Entrega</Label>
                  <Input
                    id="pdf-delivery-deadline"
                    value={pdfDeliveryDeadline}
                    onChange={(event) => setPdfDeliveryDeadline(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdf-freight-type">Frete</Label>
                  <Input
                    id="pdf-freight-type"
                    value={pdfFreightType}
                    onChange={(event) => setPdfFreightType(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdf-warranty-terms">Garantia</Label>
                  <Input
                    id="pdf-warranty-terms"
                    value={pdfWarrantyTerms}
                    onChange={(event) => setPdfWarrantyTerms(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsPdfModalOpen(false)} disabled={isGeneratingPdf}>
                Cancelar
              </Button>
              <Button onClick={handleGenerateQuotePdf} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? 'Gerando PDF...' : 'Gerar PDF'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWarrantyNoCostModalOpen} onOpenChange={setIsWarrantyNoCostModalOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto max-w-2xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>Garantia sem Custo</DialogTitle>
              <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-md shrink-0">
                OS {order.omieOSNumber}
              </span>
            </div>
            <DialogDescription>
              Gera um laudo de garantia sem tabela de serviços ou valores.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="warranty-diagnosis">Diagnóstico</Label>
              <Textarea
                id="warranty-diagnosis"
                value={warrantyDiagnosis}
                onChange={(event) => setWarrantyDiagnosis(event.target.value)}
                placeholder="Descrição do diagnóstico técnico"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warranty-solution">Solução</Label>
              <Textarea
                id="warranty-solution"
                value={warrantySolution}
                onChange={(event) => setWarrantySolution(event.target.value)}
                placeholder="Descrição da solução aplicada"
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsWarrantyNoCostModalOpen(false)} disabled={isGeneratingWarrantyPdf}>
                Cancelar
              </Button>
              <Button onClick={() => void handleGenerateWarrantyNoCostPdf()} disabled={isGeneratingWarrantyPdf}>
                {isGeneratingWarrantyPdf ? 'Gerando PDF...' : 'Gerar Laudo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
