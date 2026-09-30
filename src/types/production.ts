export type ProductionOrderType = 'BATTERY' | 'CHARGER_ONLY';

export type ProductionPurpose = 'SALE' | 'PURCHASE' | 'RENTAL';

export type ProductionOrderStatus =
  | 'OPEN'
  | 'ATTRIBUTED'
  | 'IN_PRODUCTION'
  | 'WAITING_PART'
  | 'IN_TESTING'
  | 'FINISHING'
  | 'COMPLETED'
  | 'DISPATCHED'
  | 'FINALIZED';

export interface ProductionAttachment {
  fileName: string;
  dataUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt: Date;
}

export interface ProductionContactInfo {
  sellerName: string;
  companyId?: string;
  companyName: string;
  cnpj: string;
  address: string;
  state: string;
  city: string;
  zipCode: string;
  vc: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

export interface ProductionDeliveryInfo {
  address: string;
  state: string;
  city: string;
  zipCode: string;
  purpose: ProductionPurpose;
}

export interface ProductionTechnicalSpecs {
  commercialDrawing?: ProductionAttachment;
  assemblyDrawing?: ProductionAttachment;
  current: string;
  voltage: string;
}

/** Especificação do produto preenchida na etapa "Especificar produto". */
export type ProductionYesNo = 'YES' | 'NO';

export const PRODUCTION_CHARGE_CONNECTOR_MODELS = [
  'REMA 160A MACHO',
  'REMA 160A FÊMEA',
  '320A MACHO',
  '320A FÊMEA',
  'ANDERSON',
  '350A',
  '150A',
  '50A',
] as const;

export interface ProductionProductSpecification {
  capacityAh: string;
  voltageV: string;
  chargeConnector: ProductionYesNo;
  chargeConnectorModel?: string;
  dischargeConnector: ProductionYesNo;
  liftCutoff: ProductionYesNo;
  cableLengthM?: string;
  canCommunication?: ProductionYesNo;
  chargerModel: string;
  bmsModel: 'DALY' | 'UDAN';
  weightKg?: string;
  bridge: ProductionYesNo;
  bridgeConnectorType?: string;
  specifiedBy?: string;
  specifiedAt?: Date;
}

export interface ProductionEquipmentInfo {
  brand: string;
  model: string;
}

export interface ProductionBatteryInfo {
  quantity: number;
  nominalVoltage: string;
  nominalCapacity: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  weightKg: string;
  connectorType: string;
  chargeConnector: string;
  dischargeConnector: string;
  chargeCableGauge: string;
  dischargeCableGauge: string;
  chargeCableLengthM: string;
  dischargeCableLengthM: string;
  connectorBase: 'YES' | 'NO';
  displayOutput: string;
  displayCableLengthM: string;
}

export interface ProductionLithiumSettings {
  actuationType: string;
  powerOutputType: string;
  needsHydraulicCutoff: 'YES' | 'NO';
  dischargeStopCondition: string;
}

export interface ProductionOperationInfo {
  minTemp: string;
  maxTemp: string;
  coldChamberMode: string;
}

export interface ProductionChargerInfo {
  voltage: string;
  current: string;
  gridVoltage: string;
  outletType: string;
  chargeConnector: string;
  cableLengthM: string;
  cableGauge: string;
}

export interface ProductionBatteryItem {
  id: string;
  equipment: ProductionEquipmentInfo;
  boxDrawing: string;
  bmsModel: string;
  packModel: string;
  needsCounterweight: 'YES' | 'NO';
  counterweightKg: string;
  hoisting: string;
  instructionAttachments: ProductionAttachment[];
  battery: ProductionBatteryInfo;
  lithium: ProductionLithiumSettings;
  operation: ProductionOperationInfo;
  includeCharger: boolean;
  charger?: ProductionChargerInfo;
}

export interface ProductionOrder {
  id: string;
  unitId: string;
  code: string;
  vc: number;
  type: ProductionOrderType;
  status: ProductionOrderStatus;
  client: ProductionContactInfo;
  delivery: ProductionDeliveryInfo;
  technicalSpecs: ProductionTechnicalSpecs;
  productSpecification?: ProductionProductSpecification;
  batteryItems: ProductionBatteryItem[];
  chargerOnly?: ProductionChargerInfo;
  trackingNumber?: string;
  trackingLink?: string;
  carrier?: string;
  deliveryDate?: Date;
  technicianId?: string;
  technicianName?: string;
  waitingPartDescription?: string;
  waitingPartFromStatus?: 'IN_PRODUCTION';
  productionStartTime?: Date;
  productionEndTime?: Date;
  purchaseOrderAttachments?: ProductionAttachment[];
  productionAttachments?: ProductionAttachment[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductionOrderDraft {
  code: string;
  vc: number;
  type: ProductionOrderType;
  status: ProductionOrderStatus;
  client: ProductionContactInfo;
  delivery: ProductionDeliveryInfo;
  technicalSpecs: ProductionTechnicalSpecs;
  productSpecification?: ProductionProductSpecification;
  batteryItems: ProductionBatteryItem[];
  chargerOnly?: ProductionChargerInfo;
  trackingNumber?: string;
  trackingLink?: string;
  carrier?: string;
  deliveryDate?: Date;
  technicianId?: string;
  technicianName?: string;
  waitingPartDescription?: string;
  waitingPartFromStatus?: 'IN_PRODUCTION';
  productionStartTime?: Date;
  productionEndTime?: Date;
  purchaseOrderAttachments?: ProductionAttachment[];
  productionAttachments?: ProductionAttachment[];
}
