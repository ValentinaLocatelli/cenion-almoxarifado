import type { Company, OSHistory, ServiceOrder, User, UserPermissions } from '@/types';
import type { ProductionOrder, ProductionOrderDraft } from '@/types/production';

function toDate(value: unknown): Date {
  if (!value || typeof value !== 'string') return new Date();
  return new Date(value);
}

function toOptionalDate(value: unknown): Date | undefined {
  if (!value || typeof value !== 'string') return undefined;
  return new Date(value);
}

function toIso(value: Date | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function mapUserRow(row: Record<string, unknown>): User {
  const roleRaw = String(row.role ?? 'TECNICO');
  const role: User['role'] =
    roleRaw === 'ADMIN' || roleRaw === 'SUPERVISOR' ? roleRaw : 'TECNICO';
  const permissionsRaw = row.permissions as Record<string, unknown> | null;
  const defaultPermissions: UserPermissions =
    role === 'ADMIN'
      ? {
          dashboardFinancial: true,
          manageBusinessUnits: true,
          manageUsers: true,
          canCreateTechnicians: true,
          manualOrderControl: true,
        }
      : role === 'SUPERVISOR'
        ? {
            dashboardFinancial: false,
            manageBusinessUnits: false,
            manageUsers: false,
            canCreateTechnicians: true,
            manualOrderControl: false,
          }
        : {
            dashboardFinancial: false,
            manageBusinessUnits: false,
            manageUsers: false,
            canCreateTechnicians: false,
            manualOrderControl: false,
          };

  const permissions: UserPermissions = {
    dashboardFinancial:
      typeof permissionsRaw?.dashboardFinancial === 'boolean'
        ? permissionsRaw.dashboardFinancial
        : defaultPermissions.dashboardFinancial,
    manageBusinessUnits:
      typeof permissionsRaw?.manageBusinessUnits === 'boolean'
        ? permissionsRaw.manageBusinessUnits
        : defaultPermissions.manageBusinessUnits,
    manageUsers:
      typeof permissionsRaw?.manageUsers === 'boolean'
        ? permissionsRaw.manageUsers
        : defaultPermissions.manageUsers,
    canCreateTechnicians:
      typeof permissionsRaw?.canCreateTechnicians === 'boolean'
        ? permissionsRaw.canCreateTechnicians
        : defaultPermissions.canCreateTechnicians,
    manualOrderControl:
      typeof permissionsRaw?.manualOrderControl === 'boolean'
        ? permissionsRaw.manualOrderControl
        : defaultPermissions.manualOrderControl,
  };

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : undefined,
    login: typeof row.login === 'string' ? row.login : undefined,
    role,
    permissions,
    unitId: typeof row.unit_id === 'string' ? row.unit_id : undefined,
    active: Boolean(row.active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: toDate(row.created_at),
  };
}

export function mapServiceOrderRow(row: Record<string, unknown>): ServiceOrder {
  const quotePdfRaw = row.quote_pdf as Record<string, unknown> | null;
  const approvalAttachmentRaw = row.approval_attachment as Record<string, unknown> | null;
  const technicalAttachmentRaw = row.technical_attachment as Record<string, unknown> | null;
  const deliveryEvidenceAttachmentsRaw = Array.isArray(row.delivery_evidence_attachments)
    ? (row.delivery_evidence_attachments as Array<Record<string, unknown>>)
    : null;
  const quoteServicesRaw = Array.isArray(row.quote_services) ? (row.quote_services as Array<Record<string, unknown>>) : null;

  return {
    id: String(row.id),
    unitId: String(row.unit_id ?? ''),
    omieOSNumber: String(row.omie_os_number ?? ''),
    clientName: String(row.client_name ?? ''),
    clientCnpj: typeof row.client_cnpj === 'string' ? row.client_cnpj : undefined,
    clientEmail: typeof row.client_email === 'string' ? row.client_email : undefined,
    clientPhone: typeof row.client_phone === 'string' ? row.client_phone : undefined,
    contactName: typeof row.contact_name === 'string' ? row.contact_name : undefined,
    productType: row.product_type === 'CHARGER' ? 'CHARGER' : 'BATTERY',
    productDescription: String(row.product_description ?? ''),
    serialNumber: typeof row.serial_number === 'string' ? row.serial_number : undefined,
    status: String(row.status ?? 'IMPORTED_OPEN') as ServiceOrder['status'],
    priority: String(row.priority ?? 'MEDIUM') as ServiceOrder['priority'],
    isWarranty: Boolean(row.is_warranty),
    technicianId: typeof row.technician_id === 'string' ? row.technician_id : undefined,
    technicianName: typeof row.technician_name === 'string' ? row.technician_name : undefined,
    problemDescription: typeof row.problem_description === 'string' ? row.problem_description : undefined,
    solutionDescription: typeof row.solution_description === 'string' ? row.solution_description : undefined,
    technicalNotes: typeof row.technical_notes === 'string' ? row.technical_notes : undefined,
    technicalAttachment: technicalAttachmentRaw
      ? {
          fileName: String(technicalAttachmentRaw.fileName ?? ''),
          dataUrl: String(technicalAttachmentRaw.dataUrl ?? ''),
          mimeType: typeof technicalAttachmentRaw.mimeType === 'string' ? technicalAttachmentRaw.mimeType : undefined,
          sizeBytes: typeof technicalAttachmentRaw.sizeBytes === 'number' ? technicalAttachmentRaw.sizeBytes : undefined,
          uploadedAt: toDate(technicalAttachmentRaw.uploadedAt),
        }
      : undefined,
    deliveryEvidenceAttachments: deliveryEvidenceAttachmentsRaw
      ? deliveryEvidenceAttachmentsRaw.map((attachment) => ({
          fileName: String(attachment.fileName ?? ''),
          dataUrl: String(attachment.dataUrl ?? ''),
          mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : undefined,
          sizeBytes: typeof attachment.sizeBytes === 'number' ? attachment.sizeBytes : undefined,
          uploadedAt: toDate(attachment.uploadedAt),
        }))
      : undefined,
    origin: typeof row.origin === 'string' ? row.origin : undefined,
    destination: typeof row.destination === 'string' ? row.destination : undefined,
    trackingNumber: typeof row.tracking_number === 'string' ? row.tracking_number : undefined,
    trackingLink: typeof row.tracking_link === 'string' ? row.tracking_link : undefined,
    carrier: typeof row.carrier === 'string' ? row.carrier : undefined,
    deliveryDate: toOptionalDate(row.delivery_date),
    purchaseOrderNumber: typeof row.purchase_order_number === 'string' ? row.purchase_order_number : undefined,
    approvalDate: toOptionalDate(row.approval_date),
    invoiceNumber: typeof row.invoice_number === 'string' ? row.invoice_number : undefined,
    analysisStartTime: toOptionalDate(row.analysis_start_time),
    analysisEndTime: toOptionalDate(row.analysis_end_time),
    executionStartTime: toOptionalDate(row.execution_start_time),
    executionEndTime: toOptionalDate(row.execution_end_time),
    waitingPartFromStatus:
      typeof row.waiting_part_from_status === 'string'
        ? (row.waiting_part_from_status as ServiceOrder['waitingPartFromStatus'])
        : undefined,
    waitingPartDescription:
      typeof row.waiting_part_description === 'string' ? row.waiting_part_description : undefined,
    approvalDecision:
      row.approval_decision === 'APPROVED' || row.approval_decision === 'REJECTED'
        ? row.approval_decision
        : undefined,
    approvalAttachment: approvalAttachmentRaw
      ? {
          fileName: String(approvalAttachmentRaw.fileName ?? ''),
          dataUrl: String(approvalAttachmentRaw.dataUrl ?? ''),
          mimeType: typeof approvalAttachmentRaw.mimeType === 'string' ? approvalAttachmentRaw.mimeType : undefined,
          sizeBytes: typeof approvalAttachmentRaw.sizeBytes === 'number' ? approvalAttachmentRaw.sizeBytes : undefined,
          uploadedAt: toDate(approvalAttachmentRaw.uploadedAt),
        }
      : undefined,
    quotePdf: quotePdfRaw
      ? {
          fileName: String(quotePdfRaw.fileName ?? ''),
          dataUrl: String(quotePdfRaw.dataUrl ?? ''),
          generatedAt: toDate(quotePdfRaw.generatedAt),
        }
      : undefined,
    quoteServices: quoteServicesRaw
      ? quoteServicesRaw.map((service) => ({
          type: String(service.type ?? ''),
          quantity: Number(service.quantity ?? 0),
          unitValue: Number(service.unitValue ?? 0),
        }))
      : undefined,
    quoteTotalValue: typeof row.quote_total_value === 'number' ? row.quote_total_value : undefined,
    irreparable: Boolean(row.irreparable),
    irreparableReason: typeof row.irreparable_reason === 'string' ? row.irreparable_reason : undefined,
    deliveryConfirmed: Boolean(row.delivery_confirmed),
    deliveryComment: typeof row.delivery_comment === 'string' ? row.delivery_comment : undefined,
    deliveryConfirmedAt: toOptionalDate(row.delivery_confirmed_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function mapHistoryRow(row: Record<string, unknown>): OSHistory {
  return {
    id: String(row.id),
    unitId: String(row.unit_id ?? ''),
    osId: String(row.os_id ?? ''),
    previousStatus: String(row.previous_status ?? 'IMPORTED_OPEN') as OSHistory['previousStatus'],
    newStatus: String(row.new_status ?? 'IMPORTED_OPEN') as OSHistory['newStatus'],
    userId: String(row.user_id ?? ''),
    userName: String(row.user_name ?? ''),
    notes: typeof row.notes === 'string' ? row.notes : undefined,
    createdAt: toDate(row.created_at),
  };
}

export function toServiceOrderPatch(orderPatch: Partial<ServiceOrder>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  const fields: Array<[keyof ServiceOrder, string]> = [
    ['unitId', 'unit_id'],
    ['omieOSNumber', 'omie_os_number'],
    ['clientName', 'client_name'],
    ['clientCnpj', 'client_cnpj'],
    ['clientEmail', 'client_email'],
    ['clientPhone', 'client_phone'],
    ['contactName', 'contact_name'],
    ['productType', 'product_type'],
    ['productDescription', 'product_description'],
    ['serialNumber', 'serial_number'],
    ['status', 'status'],
    ['priority', 'priority'],
    ['isWarranty', 'is_warranty'],
    ['technicianId', 'technician_id'],
    ['technicianName', 'technician_name'],
    ['problemDescription', 'problem_description'],
    ['solutionDescription', 'solution_description'],
    ['technicalNotes', 'technical_notes'],
    ['origin', 'origin'],
    ['destination', 'destination'],
    ['trackingNumber', 'tracking_number'],
    ['trackingLink', 'tracking_link'],
    ['carrier', 'carrier'],
    ['purchaseOrderNumber', 'purchase_order_number'],
    ['invoiceNumber', 'invoice_number'],
    ['waitingPartFromStatus', 'waiting_part_from_status'],
    ['waitingPartDescription', 'waiting_part_description'],
    ['approvalDecision', 'approval_decision'],
    ['irreparable', 'irreparable'],
    ['irreparableReason', 'irreparable_reason'],
    ['deliveryConfirmed', 'delivery_confirmed'],
    ['deliveryComment', 'delivery_comment'],
  ];

  fields.forEach(([key, dbKey]) => {
    if (key in orderPatch) {
      payload[dbKey] = orderPatch[key] ?? null;
    }
  });

  if ('deliveryDate' in orderPatch) payload.delivery_date = toIso(orderPatch.deliveryDate);
  if ('approvalDate' in orderPatch) payload.approval_date = toIso(orderPatch.approvalDate);
  if ('analysisStartTime' in orderPatch) payload.analysis_start_time = toIso(orderPatch.analysisStartTime);
  if ('analysisEndTime' in orderPatch) payload.analysis_end_time = toIso(orderPatch.analysisEndTime);
  if ('executionStartTime' in orderPatch) payload.execution_start_time = toIso(orderPatch.executionStartTime);
  if ('executionEndTime' in orderPatch) payload.execution_end_time = toIso(orderPatch.executionEndTime);
  if ('deliveryConfirmedAt' in orderPatch) payload.delivery_confirmed_at = toIso(orderPatch.deliveryConfirmedAt);

  if ('quotePdf' in orderPatch) {
    payload.quote_pdf = orderPatch.quotePdf
      ? {
          fileName: orderPatch.quotePdf.fileName,
          dataUrl: orderPatch.quotePdf.dataUrl,
          generatedAt: orderPatch.quotePdf.generatedAt.toISOString(),
        }
      : null;
  }

  if ('quoteServices' in orderPatch) {
    payload.quote_services = orderPatch.quoteServices
      ? orderPatch.quoteServices.map((service) => ({
          type: service.type,
          quantity: service.quantity,
          unitValue: service.unitValue,
        }))
      : null;
  }

  if ('quoteTotalValue' in orderPatch) {
    payload.quote_total_value = orderPatch.quoteTotalValue ?? null;
  }

  if ('approvalAttachment' in orderPatch) {
    payload.approval_attachment = orderPatch.approvalAttachment
      ? {
          fileName: orderPatch.approvalAttachment.fileName,
          dataUrl: orderPatch.approvalAttachment.dataUrl,
          mimeType: orderPatch.approvalAttachment.mimeType,
          sizeBytes: orderPatch.approvalAttachment.sizeBytes,
          uploadedAt: orderPatch.approvalAttachment.uploadedAt.toISOString(),
        }
      : null;
  }

  if ('technicalAttachment' in orderPatch) {
    payload.technical_attachment = orderPatch.technicalAttachment
      ? {
          fileName: orderPatch.technicalAttachment.fileName,
          dataUrl: orderPatch.technicalAttachment.dataUrl,
          mimeType: orderPatch.technicalAttachment.mimeType,
          sizeBytes: orderPatch.technicalAttachment.sizeBytes,
          uploadedAt: orderPatch.technicalAttachment.uploadedAt.toISOString(),
        }
      : null;
  }

  if ('deliveryEvidenceAttachments' in orderPatch) {
    payload.delivery_evidence_attachments = orderPatch.deliveryEvidenceAttachments
      ? orderPatch.deliveryEvidenceAttachments.map((attachment) => ({
          fileName: attachment.fileName,
          dataUrl: attachment.dataUrl,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          uploadedAt: attachment.uploadedAt.toISOString(),
        }))
      : null;
  }

  payload.updated_at = new Date().toISOString();

  return payload;
}

export function toHistoryInsert(entry: Omit<OSHistory, 'id'>): Record<string, unknown> {
  return {
    unit_id: entry.unitId,
    os_id: entry.osId,
    previous_status: entry.previousStatus,
    new_status: entry.newStatus,
    user_id: entry.userId,
    user_name: entry.userName,
    notes: entry.notes ?? null,
    created_at: entry.createdAt.toISOString(),
  };
}

function serializeProductSpecification(
  spec: import('@/types/production').ProductionProductSpecification | undefined,
): Record<string, unknown> | null {
  if (!spec) return null;
  return {
    capacityAh: spec.capacityAh, voltageV: spec.voltageV,
    chargeConnector: spec.chargeConnector, chargeConnectorModel: spec.chargeConnectorModel ?? null,
    dischargeConnector: spec.dischargeConnector, liftCutoff: spec.liftCutoff,
    cableLengthM: spec.cableLengthM ?? null, canCommunication: spec.canCommunication ?? null,
    chargerModel: spec.chargerModel, bmsModel: spec.bmsModel, weightKg: spec.weightKg ?? null,
    bridge: spec.bridge, bridgeConnectorType: spec.bridgeConnectorType ?? null,
    specifiedBy: spec.specifiedBy ?? null, specifiedAt: spec.specifiedAt ? spec.specifiedAt.toISOString() : null,
  };
}

export function mapProductionOrderRow(row: Record<string, unknown>): ProductionOrder {
  const clientRaw = (row.client as Record<string, unknown> | null) ?? {};
  const deliveryRaw = (row.delivery as Record<string, unknown> | null) ?? {};
  const technicalSpecsRaw = (row.technical_specs as Record<string, unknown> | null) ?? {};
  const productSpecificationRaw = (row.product_specification as Record<string, unknown> | null) ?? null;
  const commercialDrawingRaw = (technicalSpecsRaw.commercialDrawing as Record<string, unknown> | null) ?? null;
  const assemblyDrawingRaw = (technicalSpecsRaw.assemblyDrawing as Record<string, unknown> | null) ?? null;
  const purchaseOrderAttachmentsRaw = Array.isArray(row.purchase_order_attachments)
    ? (row.purchase_order_attachments as Array<Record<string, unknown>>)
    : null;
  const productionAttachmentsRaw = Array.isArray(row.production_attachments)
    ? (row.production_attachments as Array<Record<string, unknown>>)
    : null;

  const codeMatch = String(row.code ?? '').match(/^VC-(\d+)$/);
  const vcFromCode = codeMatch ? Number(codeMatch[1]) : undefined;
  const vcFromClient = typeof clientRaw.vc === 'number' ? clientRaw.vc : Number(clientRaw.vc);
  const vc = vcFromCode ?? (Number.isFinite(vcFromClient) ? vcFromClient : 0);

  return {
    id: String(row.id),
    unitId: String(row.unit_id ?? ''),
    code: String(row.code ?? ''),
    vc,
    type: row.type === 'CHARGER_ONLY' ? 'CHARGER_ONLY' : 'BATTERY',
    status: String(row.status ?? 'OPEN') as ProductionOrder['status'],
    client: {
      sellerName: String(clientRaw.sellerName ?? ''),
      companyId: typeof clientRaw.companyId === 'string' ? clientRaw.companyId : undefined,
      companyName: String(clientRaw.companyName ?? ''),
      cnpj: String(clientRaw.cnpj ?? ''),
      address: String(clientRaw.address ?? clientRaw.fullAddress ?? ''),
      state: String(clientRaw.state ?? ''),
      city: String(clientRaw.city ?? ''),
      zipCode: String(clientRaw.zipCode ?? ''),
      vc,
      contactName: String(clientRaw.contactName ?? ''),
      contactPhone: String(clientRaw.contactPhone ?? ''),
      contactEmail: String(clientRaw.contactEmail ?? ''),
    },
    delivery: {
      address: String(deliveryRaw.address ?? ''),
      state: String(deliveryRaw.state ?? ''),
      city: String(deliveryRaw.city ?? ''),
      zipCode: String(deliveryRaw.zipCode ?? ''),
      purpose: (deliveryRaw.purpose === 'PURCHASE' || deliveryRaw.purpose === 'RENTAL'
        ? deliveryRaw.purpose
        : 'SALE') as ProductionOrder['delivery']['purpose'],
    },
    technicalSpecs: {
      commercialDrawing: commercialDrawingRaw
        ? {
            fileName: String(commercialDrawingRaw.fileName ?? ''),
            dataUrl: String(commercialDrawingRaw.dataUrl ?? ''),
            mimeType: typeof commercialDrawingRaw.mimeType === 'string' ? commercialDrawingRaw.mimeType : undefined,
            sizeBytes: typeof commercialDrawingRaw.sizeBytes === 'number' ? commercialDrawingRaw.sizeBytes : undefined,
            uploadedAt: toDate(commercialDrawingRaw.uploadedAt),
          }
        : undefined,
      assemblyDrawing: assemblyDrawingRaw
        ? {
            fileName: String(assemblyDrawingRaw.fileName ?? ''),
            dataUrl: String(assemblyDrawingRaw.dataUrl ?? ''),
            mimeType: typeof assemblyDrawingRaw.mimeType === 'string' ? assemblyDrawingRaw.mimeType : undefined,
            sizeBytes: typeof assemblyDrawingRaw.sizeBytes === 'number' ? assemblyDrawingRaw.sizeBytes : undefined,
            uploadedAt: toDate(assemblyDrawingRaw.uploadedAt),
          }
        : undefined,
      current: String(technicalSpecsRaw.current ?? ''),
      voltage: String(technicalSpecsRaw.voltage ?? ''),
    },
    productSpecification: productSpecificationRaw
      ? {
          capacityAh: String(productSpecificationRaw.capacityAh ?? ''),
          voltageV: String(productSpecificationRaw.voltageV ?? ''),
          chargeConnector: productSpecificationRaw.chargeConnector === 'NO' ? 'NO' : 'YES',
          chargeConnectorModel: typeof productSpecificationRaw.chargeConnectorModel === 'string' ? productSpecificationRaw.chargeConnectorModel : undefined,
          dischargeConnector: productSpecificationRaw.dischargeConnector === 'NO' ? 'NO' : 'YES',
          liftCutoff: productSpecificationRaw.liftCutoff === 'NO' ? 'NO' : 'YES',
          cableLengthM: typeof productSpecificationRaw.cableLengthM === 'string' ? productSpecificationRaw.cableLengthM : undefined,
          canCommunication: productSpecificationRaw.canCommunication === 'NO' ? 'NO' : productSpecificationRaw.canCommunication === 'YES' ? 'YES' : undefined,
          chargerModel: String(productSpecificationRaw.chargerModel ?? ''),
          bmsModel: productSpecificationRaw.bmsModel === 'DALY' ? 'DALY' : 'UDAN',
          weightKg: typeof productSpecificationRaw.weightKg === 'string' ? productSpecificationRaw.weightKg : undefined,
          bridge: productSpecificationRaw.bridge === 'NO' ? 'NO' : 'YES',
          bridgeConnectorType: typeof productSpecificationRaw.bridgeConnectorType === 'string' ? productSpecificationRaw.bridgeConnectorType : undefined,
          specifiedBy: typeof productSpecificationRaw.specifiedBy === 'string' ? productSpecificationRaw.specifiedBy : undefined,
          specifiedAt: productSpecificationRaw.specifiedAt ? toOptionalDate(productSpecificationRaw.specifiedAt) : undefined,
        }
      : undefined,
    batteryItems: Array.isArray(row.battery_items)
      ? (row.battery_items as ProductionOrder['batteryItems'])
      : [],
    chargerOnly: (row.charger_only as ProductionOrder['chargerOnly']) ?? undefined,
    trackingNumber: typeof row.tracking_number === 'string' ? row.tracking_number : undefined,
    trackingLink: typeof row.tracking_link === 'string' ? row.tracking_link : undefined,
    carrier: typeof row.carrier === 'string' ? row.carrier : undefined,
    deliveryDate: toOptionalDate(row.delivery_date),
    technicianId: typeof row.technician_id === 'string' ? row.technician_id : undefined,
    technicianName: typeof row.technician_name === 'string' ? row.technician_name : undefined,
    waitingPartDescription: typeof row.waiting_part_description === 'string' ? row.waiting_part_description : undefined,
    waitingPartFromStatus:
      row.waiting_part_from_status === 'IN_PRODUCTION'
        ? 'IN_PRODUCTION'
        : undefined,
    productionStartTime: toOptionalDate(row.production_start_time),
    productionEndTime: toOptionalDate(row.production_end_time),
    purchaseOrderAttachments: purchaseOrderAttachmentsRaw
      ? purchaseOrderAttachmentsRaw.map((attachment) => ({
          fileName: String(attachment.fileName ?? ''),
          dataUrl: String(attachment.dataUrl ?? ''),
          mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : undefined,
          sizeBytes: typeof attachment.sizeBytes === 'number' ? attachment.sizeBytes : undefined,
          uploadedAt: toDate(attachment.uploadedAt),
        }))
      : [],
    productionAttachments: productionAttachmentsRaw
      ? productionAttachmentsRaw.map((attachment) => ({
          fileName: String(attachment.fileName ?? ''),
          dataUrl: String(attachment.dataUrl ?? ''),
          mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : undefined,
          sizeBytes: typeof attachment.sizeBytes === 'number' ? attachment.sizeBytes : undefined,
          uploadedAt: toDate(attachment.uploadedAt),
        }))
      : [],
    createdBy: typeof row.created_by === 'string' ? row.created_by : undefined,
    updatedBy: typeof row.updated_by === 'string' ? row.updated_by : undefined,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toProductionOrderInsert(
  payload: ProductionOrderDraft & { unitId: string; actorUserId?: string },
): Record<string, unknown> {
  return {
    unit_id: payload.unitId,
    code: payload.code,
    type: payload.type,
    status: payload.status,
    client: payload.client,
    delivery: payload.delivery,
    technical_specs: payload.technicalSpecs ?? {},
    product_specification: serializeProductSpecification(payload.productSpecification),
    battery_items: payload.batteryItems,
    charger_only: payload.chargerOnly ?? null,
    tracking_number: payload.trackingNumber ?? null,
    tracking_link: payload.trackingLink ?? null,
    carrier: payload.carrier ?? null,
    delivery_date: toIso(payload.deliveryDate),
    technician_id: payload.technicianId ?? null,
    technician_name: payload.technicianName ?? null,
    waiting_part_description: payload.waitingPartDescription ?? null,
    waiting_part_from_status: payload.waitingPartFromStatus ?? null,
    production_start_time: toIso(payload.productionStartTime),
    production_end_time: toIso(payload.productionEndTime),
    purchase_order_attachments: payload.purchaseOrderAttachments
      ? payload.purchaseOrderAttachments.map((attachment) => ({
          fileName: attachment.fileName,
          dataUrl: attachment.dataUrl,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          uploadedAt: attachment.uploadedAt.toISOString(),
        }))
      : [],
    production_attachments: payload.productionAttachments
      ? payload.productionAttachments.map((attachment) => ({
          fileName: attachment.fileName,
          dataUrl: attachment.dataUrl,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          uploadedAt: attachment.uploadedAt.toISOString(),
        }))
      : [],
    created_by: payload.actorUserId ?? null,
    updated_by: payload.actorUserId ?? null,
  };
}

export function toProductionOrderPatch(
  payload: ProductionOrderDraft & { actorUserId?: string },
): Record<string, unknown> {
  return {
    type: payload.type,
    status: payload.status,
    client: payload.client,
    delivery: payload.delivery,
    technical_specs: payload.technicalSpecs ?? {},
    product_specification: serializeProductSpecification(payload.productSpecification),
    battery_items: payload.batteryItems,
    charger_only: payload.chargerOnly ?? null,
    tracking_number: payload.trackingNumber ?? null,
    tracking_link: payload.trackingLink ?? null,
    carrier: payload.carrier ?? null,
    delivery_date: toIso(payload.deliveryDate),
    technician_id: payload.technicianId ?? null,
    technician_name: payload.technicianName ?? null,
    waiting_part_description: payload.waitingPartDescription ?? null,
    waiting_part_from_status: payload.waitingPartFromStatus ?? null,
    production_start_time: toIso(payload.productionStartTime),
    production_end_time: toIso(payload.productionEndTime),
    purchase_order_attachments: payload.purchaseOrderAttachments
      ? payload.purchaseOrderAttachments.map((attachment) => ({
          fileName: attachment.fileName,
          dataUrl: attachment.dataUrl,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          uploadedAt: attachment.uploadedAt.toISOString(),
        }))
      : [],
    production_attachments: payload.productionAttachments
      ? payload.productionAttachments.map((attachment) => ({
          fileName: attachment.fileName,
          dataUrl: attachment.dataUrl,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          uploadedAt: attachment.uploadedAt.toISOString(),
        }))
      : [],
    updated_by: payload.actorUserId ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function mapCompanyRow(row: Record<string, unknown>): Company {
  return {
    id: String(row.id),
    unitId: String(row.unit_id ?? ''),
    name: String(row.name ?? ''),
    cnpj: String(row.cnpj ?? ''),
    address: String(row.address ?? ''),
    state: String(row.state ?? ''),
    city: String(row.city ?? ''),
    zipCode: String(row.zip_code ?? ''),
    contactName: String(row.contact_name ?? ''),
    contactPhone: String(row.contact_phone ?? ''),
    contactEmail: String(row.contact_email ?? ''),
    active: Boolean(row.active),
    createdBy: typeof row.created_by === 'string' ? row.created_by : undefined,
    updatedBy: typeof row.updated_by === 'string' ? row.updated_by : undefined,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toCompanyInsert(
  payload: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> & { actorUserId?: string },
): Record<string, unknown> {
  return {
    unit_id: payload.unitId,
    name: payload.name,
    cnpj: payload.cnpj,
    address: payload.address,
    state: payload.state,
    city: payload.city,
    zip_code: payload.zipCode,
    contact_name: payload.contactName,
    contact_phone: payload.contactPhone,
    contact_email: payload.contactEmail,
    active: payload.active,
    created_by: payload.actorUserId ?? null,
    updated_by: payload.actorUserId ?? null,
  };
}

export function toCompanyPatch(
  payload: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> & { actorUserId?: string },
): Record<string, unknown> {
  return {
    unit_id: payload.unitId,
    name: payload.name,
    cnpj: payload.cnpj,
    address: payload.address,
    state: payload.state,
    city: payload.city,
    zip_code: payload.zipCode,
    contact_name: payload.contactName,
    contact_phone: payload.contactPhone,
    contact_email: payload.contactEmail,
    active: payload.active,
    updated_by: payload.actorUserId ?? null,
    updated_at: new Date().toISOString(),
  };
}
