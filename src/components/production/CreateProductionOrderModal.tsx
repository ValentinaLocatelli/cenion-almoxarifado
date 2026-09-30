import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, FileText, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useAppData } from '@/contexts/AppDataContext';
import { useActiveUnit } from '@/contexts/ActiveUnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { BRAZILIAN_STATES, fetchCitiesByState } from '@/lib/brazilLocations';
import { toast } from 'sonner';

import type { Company } from '@/types';
import type {
  ProductionAttachment,
  ProductionContactInfo,
  ProductionOrder,
  ProductionOrderDraft,
  ProductionOrderStatus,
  ProductionOrderType,
  ProductionPurpose,
  ProductionDeliveryInfo,
  ProductionTechnicalSpecs,
} from '@/types/production';

interface CreateProductionOrderModalProps {
  open: boolean;
  mode: ProductionOrderType;
  nextCode: number;
  initialOrder?: ProductionOrder;
  onOpenChange: (open: boolean) => void;
  onCreate: (
    payload: ProductionOrderDraft,
  ) => Promise<void> | void;
}

interface NewCompanyForm {
  cnpj: string;
  name: string;
  address: string;
  state: string;
  city: string;
  zipCode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

const EMPTY_NEW_COMPANY: NewCompanyForm = {
  cnpj: '',
  name: '',
  address: '',
  state: '',
  city: '',
  zipCode: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

function formatZip(value: string) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 5) return digits;

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Falha ao carregar arquivo: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function toProductionAttachment(file: File): Promise<ProductionAttachment> {
  return {
    fileName: file.name,
    dataUrl: await readFileAsDataUrl(file),
    mimeType: file.type || undefined,
    sizeBytes: file.size,
    uploadedAt: new Date(),
  };
}

const DEFAULT_CLIENT: ProductionContactInfo = {
  sellerName: '',
  companyId: undefined,
  companyName: '',
  cnpj: '',
  address: '',
  state: '',
  city: '',
  zipCode: '',
  vc: 0,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
};

const DEFAULT_DELIVERY: ProductionDeliveryInfo = {
  address: '',
  state: '',
  city: '',
  zipCode: '',
  purpose: 'SALE',
};

const DEFAULT_TECHNICAL_SPECS: ProductionTechnicalSpecs = {
  commercialDrawing: undefined,
  assemblyDrawing: undefined,
  current: '',
  voltage: '',
};

const DEFAULT_STATUS: ProductionOrderStatus = 'OPEN';

export default function CreateProductionOrderModal({
  open,
  mode,
  nextCode,
  initialOrder,
  onOpenChange,
  onCreate,
}: CreateProductionOrderModalProps) {
  const { companies, createCompany, updateCompany, deleteCompany } = useAppData();
  const { activeUnitId } = useActiveUnit();
  const { isAdmin } = useAuth();

  const [client, setClient] = useState<ProductionContactInfo>(DEFAULT_CLIENT);
  const [delivery, setDelivery] =
    useState<ProductionDeliveryInfo>(DEFAULT_DELIVERY);
  const [technicalSpecs, setTechnicalSpecs] =
    useState<ProductionTechnicalSpecs>(DEFAULT_TECHNICAL_SPECS);
  const [isUploadingCommercialDrawing, setIsUploadingCommercialDrawing] = useState(false);
  const [isUploadingAssemblyDrawing, setIsUploadingAssemblyDrawing] = useState(false);

  const [companySearch, setCompanySearch] = useState('');
  const [isSearchingCompany, setIsSearchingCompany] = useState(false);
  const [companyFound, setCompanyFound] = useState(false);

  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [newCompany, setNewCompany] =
    useState<NewCompanyForm>(EMPTY_NEW_COMPANY);
  const [newCompanyCities, setNewCompanyCities] = useState<string[]>([]);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  const [deliveryCities, setDeliveryCities] = useState<string[]>([]);
  const [isLoadingDeliveryCities, setIsLoadingDeliveryCities] =
    useState(false);

  const [isEditingCompanyInfo, setIsEditingCompanyInfo] = useState(false);
  const [isSavingCompanyInfo, setIsSavingCompanyInfo] = useState(false);
  const [companyBeforeEdit, setCompanyBeforeEdit] =
    useState<ProductionContactInfo | null>(null);

  const [isDeleteCompanyDialogOpen, setIsDeleteCompanyDialogOpen] = useState(false);
  const [deleteCompanyConfirmText, setDeleteCompanyConfirmText] = useState('');
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  /*
   * VC:
   *
   * O sistema trabalha com números sequenciais.
   * Exemplo:
   * 1 -> VC-0001
   * 2 -> VC-0002
   */
  const vcNumber = initialOrder?.vc ?? nextCode;

  const vcCode = `VC-${String(vcNumber).padStart(4, '0')}`;

  /*
   * Somente empresas:
   *
   * - ativas
   * - pertencentes à unidade atualmente selecionada
   */
  const companyOptions = useMemo(() => {
    return companies
      .filter(
        (company) =>
          company.active &&
          company.unitId === activeUnitId,
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      );
  }, [companies, activeUnitId]);

  /*
   * Sugestões enquanto o usuário digita o CNPJ.
   */
  const filteredCompanies = useMemo(() => {
    const searchDigits = onlyDigits(companySearch);

    if (!searchDigits) return [];

    return companyOptions
      .filter((company) =>
        onlyDigits(company.cnpj).startsWith(searchDigits),
      )
      .slice(0, 6);
  }, [companyOptions, companySearch]);

  useEffect(() => {
    if (!open) return;

    if (initialOrder) {
      setClient(initialOrder.client);

      setDelivery({
        ...DEFAULT_DELIVERY,
        ...initialOrder.delivery,
        purpose: initialOrder.delivery.purpose ?? 'SALE',
      });

      setTechnicalSpecs({
        ...DEFAULT_TECHNICAL_SPECS,
        ...initialOrder.technicalSpecs,
      });

      setCompanySearch(initialOrder.client.cnpj);
      setCompanyFound(Boolean(initialOrder.client.companyId));

      setIsEditingCompanyInfo(false);
      setCompanyBeforeEdit(null);
      setIsDeleteCompanyDialogOpen(false);
      setDeleteCompanyConfirmText('');

      return;
    }

    setClient({
      ...DEFAULT_CLIENT,
      vc: vcNumber,
    });

    setDelivery(DEFAULT_DELIVERY);
    setTechnicalSpecs(DEFAULT_TECHNICAL_SPECS);

    setCompanySearch('');
    setCompanyFound(false);
    setNewCompanyOpen(false);
    setNewCompany(EMPTY_NEW_COMPANY);

    setIsEditingCompanyInfo(false);
    setCompanyBeforeEdit(null);
    setIsDeleteCompanyDialogOpen(false);
    setDeleteCompanyConfirmText('');
  }, [open, initialOrder, vcNumber]);

  /*
   * Carrega cidades do endereço de entrega.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCities() {
      if (!delivery.state) {
        setDeliveryCities([]);
        return;
      }

      setIsLoadingDeliveryCities(true);

      try {
        const cities = await fetchCitiesByState(delivery.state);

        if (!cancelled) {
          setDeliveryCities(cities);
        }
      } catch (error) {
        console.error('Erro ao carregar cidades da entrega:', error);

        if (!cancelled) {
          setDeliveryCities([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDeliveryCities(false);
        }
      }
    }

    void loadCities();

    return () => {
      cancelled = true;
    };
  }, [delivery.state]);

  /*
   * Carrega cidades da nova empresa.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCities() {
      if (!newCompany.state) {
        setNewCompanyCities([]);
        return;
      }

      try {
        const cities = await fetchCitiesByState(newCompany.state);

        if (!cancelled) {
          setNewCompanyCities(cities);
        }
      } catch (error) {
        console.error('Erro ao carregar cidades da empresa:', error);

        if (!cancelled) {
          setNewCompanyCities([]);
        }
      }
    }

    void loadCities();

    return () => {
      cancelled = true;
    };
  }, [newCompany.state]);

  function selectCompany(company: Company) {
    setClient((current) => ({
      ...current,
      companyId: company.id,
      companyName: company.name,
      cnpj: company.cnpj,
      address: company.address,
      state: company.state,
      city: company.city,
      zipCode: company.zipCode,
      contactName: company.contactName,
      contactPhone: company.contactPhone,
      contactEmail: company.contactEmail,
      vc: vcNumber,
    }));

    setCompanySearch(company.cnpj);
    setCompanyFound(true);
  }

  /*
   * Busca local pelo CNPJ.
   *
   * IMPORTANTE:
   * Não consulta Omie.
   * Consulta somente companies que já foram carregadas pelo AppDataContext.
   */
  function handleCnpjChange(value: string) {
    const formatted = formatCnpj(value);

    setCompanySearch(formatted);

    setCompanyFound(false);

    setClient((current) => ({
      ...current,
      companyId: undefined,
      companyName: '',
      cnpj: formatted,
      address: '',
      state: '',
      city: '',
      zipCode: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      vc: vcNumber,
    }));

    const digits = onlyDigits(formatted);

    if (digits.length !== 14) {
      return;
    }

    setIsSearchingCompany(true);

    const company = companyOptions.find(
      (item) => onlyDigits(item.cnpj) === digits,
    );

    if (company) {
      selectCompany(company);
    }

    setIsSearchingCompany(false);
  }

  function handleClientFieldChange(
    field: 'companyName' | 'cnpj' | 'address' | 'zipCode' | 'state' | 'city' | 'contactName' | 'contactPhone' | 'contactEmail',
    value: string,
  ) {
    setClient((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleStartEditCompanyInfo() {
    setCompanyBeforeEdit(client);
    setIsEditingCompanyInfo(true);
  }

  function handleCancelEditCompanyInfo() {
    if (companyBeforeEdit) {
      setClient(companyBeforeEdit);
    }
    setCompanyBeforeEdit(null);
    setIsEditingCompanyInfo(false);
  }

  async function handleSaveCompanyInfo() {
    if (!client.companyId) return;

    if (!activeUnitId) {
      toast.error('Nenhuma unidade está selecionada.');
      return;
    }

    if (
      !client.companyName.trim()
      || onlyDigits(client.cnpj).length !== 14
      || !client.address.trim()
      || !client.state
      || !client.city
      || !client.zipCode.trim()
    ) {
      toast.error('Preencha nome da empresa, CNPJ, endereço, estado, cidade e CEP para salvar.');
      return;
    }

    setIsSavingCompanyInfo(true);
    try {
      await updateCompany(client.companyId, {
        unitId: activeUnitId,
        name: client.companyName.trim(),
        cnpj: client.cnpj.trim(),
        address: client.address.trim(),
        state: client.state,
        city: client.city,
        zipCode: formatZip(client.zipCode),
        contactName: client.contactName.trim(),
        contactPhone: client.contactPhone.trim(),
        contactEmail: client.contactEmail.trim(),
        active: true,
      });

      toast.success('Informações da empresa atualizadas.');
      setCompanyBeforeEdit(null);
      setIsEditingCompanyInfo(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar empresa.';
      toast.error(message);
    } finally {
      setIsSavingCompanyInfo(false);
    }
  }

  async function handleConfirmDeleteCompany() {
    if (!client.companyId) return;

    if (deleteCompanyConfirmText.trim() !== client.companyName.trim()) {
      toast.error('Digite o nome da empresa exatamente como exibido para confirmar.');
      return;
    }

    setIsDeletingCompany(true);
    try {
      await deleteCompany(client.companyId);

      toast.success('Empresa apagada. O CNPJ precisará ser cadastrado novamente.');

      setClient({
        ...DEFAULT_CLIENT,
        vc: vcNumber,
      });
      setCompanySearch('');
      setCompanyFound(false);
      setIsEditingCompanyInfo(false);
      setCompanyBeforeEdit(null);
      setIsDeleteCompanyDialogOpen(false);
      setDeleteCompanyConfirmText('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao apagar empresa.';
      toast.error(message);
    } finally {
      setIsDeletingCompany(false);
    }
  }

  function handleDeliveryChange(
    field: keyof ProductionDeliveryInfo,
    value: string,
  ) {
    setDelivery((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleTechnicalSpecTextChange(
    field: 'current' | 'voltage',
    value: string,
  ) {
    setTechnicalSpecs((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCommercialDrawingChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setIsUploadingCommercialDrawing(true);
    try {
      const attachment = await toProductionAttachment(file);
      setTechnicalSpecs((current) => ({
        ...current,
        commercialDrawing: attachment,
      }));
    } catch (error) {
      console.error('Erro ao anexar desenho técnico comercial:', error);
      alert('Não foi possível anexar o desenho técnico comercial.');
    } finally {
      setIsUploadingCommercialDrawing(false);
    }
  }

  async function handleAssemblyDrawingChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setIsUploadingAssemblyDrawing(true);
    try {
      const attachment = await toProductionAttachment(file);
      setTechnicalSpecs((current) => ({
        ...current,
        assemblyDrawing: attachment,
      }));
    } catch (error) {
      console.error('Erro ao anexar desenho de montagem geral:', error);
      alert('Não foi possível anexar o desenho de montagem geral.');
    } finally {
      setIsUploadingAssemblyDrawing(false);
    }
  }

  function removeCommercialDrawing() {
    setTechnicalSpecs((current) => ({
      ...current,
      commercialDrawing: undefined,
    }));
  }

  function removeAssemblyDrawing() {
    setTechnicalSpecs((current) => ({
      ...current,
      assemblyDrawing: undefined,
    }));
  }

  function handleNewCompanyChange(
    field: keyof NewCompanyForm,
    value: string,
  ) {
    setNewCompany((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openNewCompanyForm() {
    setNewCompany({
      ...EMPTY_NEW_COMPANY,
      cnpj: companySearch,
    });

    setNewCompanyOpen(true);
  }

  async function handleCreateNewCompany() {
    if (!activeUnitId) {
      alert('Nenhuma unidade está selecionada.');
      return;
    }

    const cnpjDigits = onlyDigits(newCompany.cnpj);

    if (cnpjDigits.length !== 14) {
      alert('Digite um CNPJ completo com 14 números.');
      return;
    }

    if (!newCompany.name.trim()) {
      alert('Digite o nome da empresa.');
      return;
    }

    if (!newCompany.address.trim()) {
      alert('Digite o endereço da empresa.');
      return;
    }

    if (!newCompany.state) {
      alert('Selecione o estado da empresa.');
      return;
    }

    if (!newCompany.city) {
      alert('Selecione a cidade da empresa.');
      return;
    }

    if (!newCompany.zipCode.trim()) {
      alert('Digite o CEP da empresa.');
      return;
    }

    const alreadyExists = companyOptions.some(
      (company) =>
        onlyDigits(company.cnpj) === cnpjDigits,
    );

    if (alreadyExists) {
      alert('Esse CNPJ já está cadastrado nesta unidade.');
      return;
    }

    setIsCreatingCompany(true);

    try {
      const created = await createCompany({
        unitId: activeUnitId,
        name: newCompany.name.trim(),
        cnpj: formatCnpj(newCompany.cnpj),
        address: newCompany.address.trim(),
        state: newCompany.state,
        city: newCompany.city,
        zipCode: formatZip(newCompany.zipCode),
        contactName: newCompany.contactName.trim(),
        contactPhone: newCompany.contactPhone.trim(),
        contactEmail: newCompany.contactEmail.trim(),
        active: true,
      });

      selectCompany(created);

      setNewCompanyOpen(false);

      alert('Empresa cadastrada com sucesso.');
    } catch (error) {
      console.error('Erro ao cadastrar empresa:', error);

      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível cadastrar a empresa.',
      );
    } finally {
      setIsCreatingCompany(false);
    }
  }

  const canSave =
    Boolean(activeUnitId) &&
    Boolean(client.companyId) &&
    Boolean(client.companyName.trim()) &&
    onlyDigits(client.cnpj).length === 14 &&
    Boolean(client.address.trim()) &&
    Boolean(client.state) &&
    Boolean(client.city) &&
    Boolean(client.zipCode.trim()) &&
    Boolean(delivery.purpose) &&
    Boolean(delivery.address.trim()) &&
    Boolean(delivery.state) &&
    Boolean(delivery.city) &&
    Boolean(delivery.zipCode.trim()) &&
    Boolean(technicalSpecs.commercialDrawing) &&
    Boolean(technicalSpecs.assemblyDrawing) &&
    Boolean(technicalSpecs.current.trim()) &&
    Boolean(technicalSpecs.voltage.trim());

  async function handleSubmit() {
    if (!canSave) {
      alert(
        'Preencha todos os campos obrigatórios: cliente, entrega, anexos de desenho técnico, corrente e tensão do produto.',
      );
      return;
    }

    if (!activeUnitId) {
      alert('Nenhuma unidade está selecionada.');
      return;
    }

    setIsSaving(true);

    try {
      const payload: ProductionOrderDraft = {
        code: vcCode,
        vc: vcNumber,
        type: mode,
        status: initialOrder?.status ?? DEFAULT_STATUS,

        client: {
          ...client,
          vc: vcNumber,
        },

        delivery: {
          address: delivery.address.trim(),
          state: delivery.state,
          city: delivery.city,
          zipCode: formatZip(delivery.zipCode),
          purpose: delivery.purpose,
        },

        technicalSpecs: {
          commercialDrawing: technicalSpecs.commercialDrawing,
          assemblyDrawing: technicalSpecs.assemblyDrawing,
          current: technicalSpecs.current.trim(),
          voltage: technicalSpecs.voltage.trim(),
        },

        /*
         * Nesta primeira etapa ainda não estamos preenchendo
         * bateria ou carregador.
         *
         * Eles serão preenchidos na próxima etapa do fluxo.
         */
        batteryItems: initialOrder?.batteryItems ?? [],
        chargerOnly: initialOrder?.chargerOnly,
      };

      await onCreate(payload);

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao criar ordem de produção:', error);

      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar a ordem de produção.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5" />
              Criar Ordem de Produção — {vcCode}
            </DialogTitle>

            <DialogDescription>
              Cadastre o cliente e o local de entrega da ordem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-4">
            {/* CLIENTE */}
            <section className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">
                  Cliente
                </h3>

                <p className="text-sm text-muted-foreground">
                  Digite o CNPJ para localizar uma empresa já cadastrada.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="production-cnpj">
                    CNPJ *
                  </Label>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      id="production-cnpj"
                      value={companySearch}
                      onChange={(event) =>
                        handleCnpjChange(event.target.value)
                      }
                      placeholder="00.000.000/0000-00"
                      className="pl-9"
                      maxLength={18}
                    />
                  </div>

                  {isSearchingCompany && (
                    <p className="text-xs text-muted-foreground">
                      Procurando empresa...
                    </p>
                  )}

                  {companyFound && (
                    <p className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Empresa encontrada no cadastro do Cenion.
                    </p>
                  )}

                  {!companyFound &&
                    onlyDigits(companySearch).length === 14 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={openNewCompanyForm}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Cadastrar nova empresa
                      </Button>
                    )}
                </div>

                <div className="space-y-2">
                  <Label>Empresa *</Label>

                  <Select
                    value={client.companyId ?? ''}
                    onValueChange={(companyId) => {
                      const company = companyOptions.find(
                        (item) => item.id === companyId,
                      );

                      if (company) {
                        selectCompany(company);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma empresa" />
                    </SelectTrigger>

                    <SelectContent>
                      {companyOptions.map((company) => (
                        <SelectItem
                          key={company.id}
                          value={company.id}
                        >
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {companySearch &&
                    filteredCompanies.length > 0 && (
                      <div className="rounded-md border bg-background p-2">
                        <p className="mb-2 text-xs text-muted-foreground">
                          Empresas encontradas:
                        </p>

                        <div className="space-y-1">
                          {filteredCompanies.map((company) => (
                            <button
                              key={company.id}
                              type="button"
                              className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-muted"
                              onClick={() =>
                                selectCompany(company)
                              }
                            >
                              <span className="text-sm font-medium">
                                {company.name}
                              </span>

                              <span className="text-xs text-muted-foreground">
                                {company.cnpj}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>

              {!isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Estes dados são preenchidos automaticamente a partir do CNPJ. Apenas administradores podem editá-los manualmente.
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome da empresa *</Label>

                  <Input
                    value={client.companyName}
                    onChange={(event) =>
                      handleClientFieldChange('companyName', event.target.value)
                    }
                    readOnly={!isAdmin || !isEditingCompanyInfo}
                    placeholder="Será preenchido pelo cadastro"
                  />
                </div>

                <div className="space-y-2">
                  <Label>CNPJ</Label>

                  <Input
                    value={client.cnpj}
                    onChange={(event) =>
                      handleClientFieldChange('cnpj', event.target.value)
                    }
                    readOnly={!isAdmin || !isEditingCompanyInfo}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Endereço *</Label>

                  <Input
                    value={client.address}
                    onChange={(event) =>
                      handleClientFieldChange('address', event.target.value)
                    }
                    readOnly={!isAdmin || !isEditingCompanyInfo}
                  />
                </div>

                <div className="space-y-2">
                  <Label>CEP *</Label>

                  <Input
                    value={client.zipCode}
                    onChange={(event) =>
                      handleClientFieldChange('zipCode', formatZip(event.target.value))
                    }
                    readOnly={!isAdmin || !isEditingCompanyInfo}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Estado *</Label>

                  <Input
                    value={client.state}
                    onChange={(event) =>
                      handleClientFieldChange('state', event.target.value.toUpperCase())
                    }
                    readOnly={!isAdmin || !isEditingCompanyInfo}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cidade *</Label>

                  <Input
                    value={client.city}
                    onChange={(event) =>
                      handleClientFieldChange('city', event.target.value)
                    }
                    readOnly={!isAdmin || !isEditingCompanyInfo}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Contato</Label>

                  <Input
                    value={client.contactName}
                    onChange={(event) =>
                      handleClientFieldChange('contactName', event.target.value)
                    }
                    readOnly={!isAdmin || !isEditingCompanyInfo}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Telefone</Label>

                  <Input
                    value={client.contactPhone}
                    onChange={(event) =>
                      handleClientFieldChange('contactPhone', event.target.value)
                    }
                    readOnly={!isAdmin || !isEditingCompanyInfo}
                  />
                </div>

                <div className="space-y-2">
                  <Label>E-mail</Label>

                  <Input
                    value={client.contactEmail}
                    onChange={(event) =>
                      handleClientFieldChange('contactEmail', event.target.value)
                    }
                    readOnly={!isAdmin || !isEditingCompanyInfo}
                  />
                </div>
              </div>

              {isAdmin && client.companyId && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  {!isEditingCompanyInfo ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleStartEditCompanyInfo}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar informações
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setIsDeleteCompanyDialogOpen(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Apagar empresa
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mr-auto">
                        Edite os campos acima e salve para atualizar o cadastro desta empresa.
                      </p>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEditCompanyInfo}
                        disabled={isSavingCompanyInfo}
                      >
                        Cancelar
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleSaveCompanyInfo()}
                        disabled={isSavingCompanyInfo}
                      >
                        {isSavingCompanyInfo ? 'Salvando...' : 'Salvar alterações'}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* ENTREGA */}
            <section className="space-y-4 border-t pt-6">
              <div>
                <h3 className="text-base font-semibold">
                  Entrega
                </h3>

                <p className="text-sm text-muted-foreground">
                  Informe a finalidade e o endereço onde o equipamento será entregue.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Finalidade *</Label>

                <Select
                  value={delivery.purpose}
                  onValueChange={(value) =>
                    handleDeliveryChange(
                      'purpose',
                      value as ProductionPurpose,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a finalidade" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="SALE">
                      Venda
                    </SelectItem>

                    <SelectItem value="PURCHASE">
                      Compra
                    </SelectItem>

                    <SelectItem value="RENTAL">
                      Locação
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Endereço de entrega *</Label>

                  <Input
                    value={delivery.address}
                    onChange={(event) =>
                      handleDeliveryChange(
                        'address',
                        event.target.value,
                      )
                    }
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div className="space-y-2">
                  <Label>CEP *</Label>

                  <Input
                    value={delivery.zipCode}
                    onChange={(event) =>
                      handleDeliveryChange(
                        'zipCode',
                        formatZip(event.target.value),
                      )
                    }
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Estado *</Label>

                  <Select
                    value={delivery.state}
                    onValueChange={(value) => {
                      setDelivery((current) => ({
                        ...current,
                        state: value,
                        city: '',
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>

                    <SelectContent>
                      {BRAZILIAN_STATES.map((state) => (
                        <SelectItem
                          key={state.code}
                          value={state.code}
                        >
                          {state.code} - {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cidade *</Label>

                  <Select
                    value={delivery.city}
                    disabled={
                      !delivery.state ||
                      isLoadingDeliveryCities
                    }
                    onValueChange={(value) =>
                      handleDeliveryChange(
                        'city',
                        value,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isLoadingDeliveryCities
                            ? 'Carregando cidades...'
                            : 'Selecione a cidade'
                        }
                      />
                    </SelectTrigger>

                    <SelectContent>
                      {deliveryCities.map((city) => (
                        <SelectItem
                          key={city}
                          value={city}
                        >
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* ESPECIFICAÇÕES TÉCNICAS */}
            <section className="space-y-4 border-t pt-6">
              <div>
                <h3 className="text-base font-semibold">
                  Especificações Técnicas
                </h3>

                <p className="text-sm text-muted-foreground">
                  Anexe os desenhos técnicos e informe a corrente e a tensão do produto.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="technical-drawing-commercial">
                    Desenho Técnico Comercial *
                  </Label>

                  {technicalSpecs.commercialDrawing ? (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span className="flex items-center gap-2 truncate text-sm">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {technicalSpecs.commercialDrawing.fileName}
                        </span>
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={removeCommercialDrawing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Input
                      id="technical-drawing-commercial"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf"
                      onChange={(event) =>
                        void handleCommercialDrawingChange(event.target.files)
                      }
                      disabled={isUploadingCommercialDrawing}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="technical-drawing-assembly">
                    Desenho Técnico de Montagem Geral *
                  </Label>

                  {technicalSpecs.assemblyDrawing ? (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span className="flex items-center gap-2 truncate text-sm">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {technicalSpecs.assemblyDrawing.fileName}
                        </span>
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={removeAssemblyDrawing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Input
                      id="technical-drawing-assembly"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf"
                      onChange={(event) =>
                        void handleAssemblyDrawingChange(event.target.files)
                      }
                      disabled={isUploadingAssemblyDrawing}
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="production-current">
                    Corrente do Produto *
                  </Label>

                  <Input
                    id="production-current"
                    value={technicalSpecs.current}
                    onChange={(event) =>
                      handleTechnicalSpecTextChange('current', event.target.value)
                    }
                    placeholder="Ex: 10A"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="production-voltage">
                    Tensão do Produto *
                  </Label>

                  <Input
                    id="production-voltage"
                    value={technicalSpecs.voltage}
                    onChange={(event) =>
                      handleTechnicalSpecTextChange('voltage', event.target.value)
                    }
                    placeholder="Ex: 220V"
                  />
                </div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSave || isSaving}
            >
              {isSaving
                ? 'Salvando...'
                : 'Criar VC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CADASTRO DE NOVA EMPRESA */}
      <Dialog
        open={newCompanyOpen}
        onOpenChange={setNewCompanyOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Cadastrar nova empresa
            </DialogTitle>

            <DialogDescription>
              Esta empresa será cadastrada na unidade atualmente selecionada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>CNPJ *</Label>

              <Input
                value={newCompany.cnpj}
                onChange={(event) =>
                  handleNewCompanyChange(
                    'cnpj',
                    formatCnpj(event.target.value),
                  )
                }
                maxLength={18}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome da empresa *</Label>

              <Input
                value={newCompany.name}
                onChange={(event) =>
                  handleNewCompanyChange(
                    'name',
                    event.target.value,
                  )
                }
                placeholder="Razão social / nome da empresa"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Endereço *</Label>

                <Input
                  value={newCompany.address}
                  onChange={(event) =>
                    handleNewCompanyChange(
                      'address',
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>CEP *</Label>

                <Input
                  value={newCompany.zipCode}
                  onChange={(event) =>
                    handleNewCompanyChange(
                      'zipCode',
                      formatZip(event.target.value),
                    )
                  }
                  maxLength={9}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Estado *</Label>

                <Select
                  value={newCompany.state}
                  onValueChange={(value) =>
                    setNewCompany((current) => ({
                      ...current,
                      state: value,
                      city: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>

                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem
                        key={state.code}
                        value={state.code}
                      >
                        {state.code} - {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cidade *</Label>

                <Select
                  value={newCompany.city}
                  disabled={!newCompany.state}
                  onValueChange={(value) =>
                    handleNewCompanyChange(
                      'city',
                      value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a cidade" />
                  </SelectTrigger>

                  <SelectContent>
                    {newCompanyCities.map((city) => (
                      <SelectItem
                        key={city}
                        value={city}
                      >
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="mb-4 text-sm font-medium">
                Contato
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nome</Label>

                  <Input
                    value={newCompany.contactName}
                    onChange={(event) =>
                      handleNewCompanyChange(
                        'contactName',
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Telefone</Label>

                  <Input
                    value={newCompany.contactPhone}
                    onChange={(event) =>
                      handleNewCompanyChange(
                        'contactPhone',
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>E-mail</Label>

                  <Input
                    value={newCompany.contactEmail}
                    onChange={(event) =>
                      handleNewCompanyChange(
                        'contactEmail',
                        event.target.value,
                      )
                    }
                    type="email"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setNewCompanyOpen(false)
              }
              disabled={isCreatingCompany}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={() =>
                void handleCreateNewCompany()
              }
              disabled={isCreatingCompany}
            >
              {isCreatingCompany
                ? 'Cadastrando...'
                : 'Cadastrar empresa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteCompanyDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isDeletingCompany) {
            setIsDeleteCompanyDialogOpen(false);
            setDeleteCompanyConfirmText('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar empresa?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">
                    Esta ação é irreversível. Todos os dados de{' '}
                    <strong>{client.companyName || 'esta empresa'}</strong>, incluindo o
                    CNPJ cadastrado, serão apagados permanentemente. Para usar esta empresa
                    novamente, será necessário cadastrá-la do zero.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delete-company-confirm">
                    Para confirmar, digite o nome da empresa: <strong>{client.companyName}</strong>
                  </Label>
                  <Input
                    id="delete-company-confirm"
                    value={deleteCompanyConfirmText}
                    onChange={(event) => setDeleteCompanyConfirmText(event.target.value)}
                    placeholder={client.companyName}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCompany}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteCompany();
              }}
              disabled={
                isDeletingCompany
                || deleteCompanyConfirmText.trim() !== client.companyName.trim()
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingCompany ? 'Apagando...' : 'Apagar empresa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}