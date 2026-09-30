export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'TECNICO';

export interface UserPermissions {
  dashboardFinancial: boolean;
  manageBusinessUnits: boolean;
  manageUsers: boolean;
  canCreateTechnicians: boolean;
  manualOrderControl: boolean;
}

export type OSStatus =
  | 'IMPORTED_OPEN'
  | 'ATTRIBUTED'
  | 'IN_ANALYSIS'
  | 'WAITING_PART'
  | 'WAITING_BUDGET'
  | 'WAITING_APPROVAL'
  | 'WAITING_EXECUTION'
  | 'SENT_TO_CUSTOMER'
  | 'APPROVED'
  | 'IN_EXECUTION'
  | 'FINISHED_TECH'
  | 'DISPATCHED'
  | 'AWAITING_RECEIPT'
  | 'INVOICED';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ProductType = 'BATTERY' | 'CHARGER';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  login?: string;
  role: UserRole;
  permissions: UserPermissions;
  unitId?: string;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

export interface ServiceOrder {
  id: string;
  unitId: string;
  omieOSNumber: string;
  clientName: string;
  clientCnpj?: string;
  clientEmail?: string;
  clientPhone?: string;
  contactName?: string;
  productType: ProductType;
  productDescription: string;
  serialNumber?: string;
  status: OSStatus;
  priority: Priority;
  isWarranty: boolean;
  technicianId?: string;
  technicianName?: string;
  problemDescription?: string;
  solutionDescription?: string;
  technicalNotes?: string;
  technicalAttachment?: {
    fileName: string;
    dataUrl: string;
    mimeType?: string;
    sizeBytes?: number;
    uploadedAt: Date;
  };
  deliveryEvidenceAttachments?: Array<{
    fileName: string;
    dataUrl: string;
    mimeType?: string;
    sizeBytes?: number;
    uploadedAt: Date;
  }>;
  origin?: string;
  destination?: string;
  trackingNumber?: string;
  trackingLink?: string;
  carrier?: string;
  deliveryDate?: Date;
  purchaseOrderNumber?: string;
  approvalDate?: Date;
  invoiceNumber?: string;
  analysisStartTime?: Date;
  analysisEndTime?: Date;
  executionStartTime?: Date;
  executionEndTime?: Date;
  waitingPartFromStatus?: Extract<OSStatus, 'IN_ANALYSIS' | 'IN_EXECUTION'>;
  waitingPartDescription?: string;
  approvalDecision?: ApprovalDecision;
  approvalAttachment?: {
    fileName: string;
    dataUrl: string;
    mimeType?: string;
    sizeBytes?: number;
    uploadedAt: Date;
  };
  quotePdf?: {
    fileName: string;
    dataUrl: string;
    generatedAt: Date;
  };
  quoteServices?: QuoteServiceLine[];
  quoteTotalValue?: number;
  irreparable: boolean;
  irreparableReason?: string;
  deliveryConfirmed: boolean;
  deliveryComment?: string;
  deliveryConfirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessUnit {
  id: string;
  name: string;
  city?: string;
  state?: string;
  active: boolean;
}

export interface Company {
  id: string;
  unitId: string;
  name: string;
  cnpj: string;
  address: string;
  state: string;
  city: string;
  zipCode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  active: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceCatalogItem {
  id: string;
  serviceType: string;
  description: string;
  value: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteServiceLine {
  type: string;
  quantity: number;
  unitValue: number;
}

export interface QuotePdfPayload {
  clientName: string;
  clientCnpj?: string;
  contactName?: string;
  clientEmail?: string;
  clientPhone?: string;
  diagnosis?: string;
  solution?: string;
  proposalValidity?: string;
  paymentMethod?: string;
  paymentTerms?: string;
  deliveryDeadline?: string;
  freightType?: string;
  warrantyTerms?: string;
  services: QuoteServiceLine[];
  imageDataUrls: string[];
}

export interface OSHistory {
  id: string;
  unitId?: string;
  osId: string;
  previousStatus: OSStatus;
  newStatus: OSStatus;
  userId: string;
  userName: string;
  notes?: string;
  createdAt: Date;
}

export interface OSAttachment {
  id: string;
  osId: string;
  type: 'INVOICE' | 'PHOTO' | 'REPORT' | 'QUOTE_PDF' | 'PURCHASE_ORDER' | 'OTHER';
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: Date;
}

export const STATUS_LABELS: Record<OSStatus, string> = {
  IMPORTED_OPEN: 'OS Aberta',
  ATTRIBUTED: 'Atribuido',
  IN_ANALYSIS: 'Em Análise',
  WAITING_PART: 'Aguardando Peça',
  WAITING_BUDGET: 'Aguardando Orçamento',
  WAITING_APPROVAL: 'Aguardando Aprovação',
  WAITING_EXECUTION: 'Aguardando Execução',
  SENT_TO_CUSTOMER: 'Enviado ao Cliente',
  APPROVED: 'Aprovado',
  IN_EXECUTION: 'Em Execução',
  FINISHED_TECH: 'Finalizado (Técnico)',
  DISPATCHED: 'Despachado',
  AWAITING_RECEIPT: 'Ag. Confirmação de Recebimento',
  INVOICED: 'Finalizado',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  BATTERY: 'Bateria',
  CHARGER: 'Carregador',
};

export const OMIE_STAGE_MAP: Record<number, OSStatus> = {
  10: 'IMPORTED_OPEN',
  20: 'IN_ANALYSIS',
  30: 'WAITING_APPROVAL',
  40: 'IN_EXECUTION',
  50: 'INVOICED',
};
