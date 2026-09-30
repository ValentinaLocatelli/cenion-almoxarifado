import { supabase } from '@/lib/supabase';
import { BRAZILIAN_STATES } from '@/lib/brazilLocations';
import type { Company } from '@/types';
import { classifyDiagnosisText, OTHER_CATEGORY, type DiagnosisMatch } from '@/lib/diagnosisClassifier';
import { extractPdfTextFromDataUrl, isPdfAttachment } from '@/lib/pdfTextExtract';

/**
 * Orquestrador do relatório "Relatórios → VAMOS" (regras 1–10 e 12 da
 * especificação). Faz a busca das OS reais no Supabase, extrai/classifica
 * o diagnóstico de cada uma e calcula as porcentagens gerais (Brasil) e por
 * estado — sem nunca misturar Bateria e Carregador (regra 9) e sem inventar
 * dados para OS sem PDF/diagnóstico (regra 6).
 */

export const VAMOS_COMPANY_NAME = 'VAMOS';

export type ReportProductTypeFilter = 'BATTERY' | 'CHARGER' | 'ALL';

export interface ReportPeriodOption {
  value: number;
  label: string;
}

export const REPORT_PERIOD_OPTIONS: ReportPeriodOption[] = [
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
  { value: 182, label: '6 meses' },
  { value: 365, label: '1 ano' },
];

export interface VamosReportFilters {
  productType: ReportProductTypeFilter;
  periodDays: number;
  periodLabel: string;
}

export interface DiagnosisCountRow {
  categoryId: string;
  label: string;
  count: number;
  percentage: number;
}

export interface StateBreakdownRow {
  stateCode: string;
  stateLabel: string;
  totalEquipments: number;
  diagnoses: DiagnosisCountRow[];
}

export interface ProductSectionResult {
  productType: 'BATTERY' | 'CHARGER';
  totalAnalyzed: number;
  totalNotAnalyzed: number;
  national: DiagnosisCountRow[];
  byState: StateBreakdownRow[];
}

export interface VamosReportResult {
  filters: VamosReportFilters;
  generatedAt: Date;
  totalOrdersFound: number;
  sections: ProductSectionResult[];
}

export type ReportProgressCallback = (message: string) => void;

interface LightOrderRow {
  id: string;
  client_name: string | null;
  client_cnpj: string | null;
  product_type: string | null;
  problem_description: string | null;
  solution_description: string | null;
  technical_notes: string | null;
  updated_at: string | null;
}

const LIGHT_COLUMNS =
  'id,client_name,client_cnpj,product_type,problem_description,solution_description,technical_notes,updated_at';

const ATTACHMENT_BATCH_SIZE = 15;

function stripAccentsLower(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeCnpjDigits(value?: string | null): string {
  return (value ?? '').replace(/\D/g, '');
}

function normalizeName(value?: string | null): string {
  return stripAccentsLower(value ?? '').trim();
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

interface CompanyLookup {
  byCnpj: Map<string, Company>;
  byName: Map<string, Company>;
}

function buildCompanyLookup(companies: Company[]): CompanyLookup {
  const byCnpj = new Map<string, Company>();
  const byName = new Map<string, Company>();

  companies.forEach((company) => {
    const cnpjDigits = normalizeCnpjDigits(company.cnpj);
    if (cnpjDigits) byCnpj.set(cnpjDigits, company);

    const nameKey = normalizeName(company.name);
    if (nameKey) byName.set(nameKey, company);
  });

  return { byCnpj, byName };
}

function stateLabelFromCode(code: string): string {
  return BRAZILIAN_STATES.find((state) => state.code === code)?.name ?? code;
}

function resolveState(row: LightOrderRow, lookup: CompanyLookup): { code: string; label: string } | null {
  const cnpjDigits = normalizeCnpjDigits(row.client_cnpj);
  if (cnpjDigits) {
    const byCnpj = lookup.byCnpj.get(cnpjDigits);
    if (byCnpj?.state) return { code: byCnpj.state, label: stateLabelFromCode(byCnpj.state) };
  }

  const nameKey = normalizeName(row.client_name);
  if (nameKey) {
    const byName = lookup.byName.get(nameKey);
    if (byName?.state) return { code: byName.state, label: stateLabelFromCode(byName.state) };
  }

  return null;
}

async function fetchVamosCnpjList(companies: Company[]): Promise<string[]> {
  return companies
    .filter((company) => normalizeName(company.name).includes('vamos'))
    .map((company) => company.cnpj)
    .filter((cnpj): cnpj is string => Boolean(cnpj));
}

async function fetchLightOrders(sinceIso: string, vamosCnpjs: string[]): Promise<LightOrderRow[]> {
  const merged = new Map<string, LightOrderRow>();

  const { data: byNameRows, error: byNameError } = await supabase
    .from('service_orders')
    .select(LIGHT_COLUMNS)
    .gte('updated_at', sinceIso)
    .ilike('client_name', `%${VAMOS_COMPANY_NAME}%`);

  if (byNameError) throw byNameError;
  (byNameRows ?? []).forEach((row) => merged.set(String((row as LightOrderRow).id), row as LightOrderRow));

  if (vamosCnpjs.length > 0) {
    const { data: byCnpjRows, error: byCnpjError } = await supabase
      .from('service_orders')
      .select(LIGHT_COLUMNS)
      .gte('updated_at', sinceIso)
      .in('client_cnpj', vamosCnpjs);

    if (byCnpjError) throw byCnpjError;
    (byCnpjRows ?? []).forEach((row) => merged.set(String((row as LightOrderRow).id), row as LightOrderRow));
  }

  return Array.from(merged.values());
}

interface TechnicalAttachmentRaw {
  fileName?: string;
  dataUrl?: string;
  mimeType?: string;
}

async function fetchAttachments(
  ids: string[],
  onProgress?: ReportProgressCallback,
): Promise<Map<string, TechnicalAttachmentRaw | null>> {
  const map = new Map<string, TechnicalAttachmentRaw | null>();
  if (ids.length === 0) return map;

  const batches = chunk(ids, ATTACHMENT_BATCH_SIZE);

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    onProgress?.(`Buscando anexos técnicos: lote ${i + 1}/${batches.length}`);

    const { data, error } = await supabase
      .from('service_orders')
      .select('id,technical_attachment')
      .in('id', batch);

    if (error) throw error;

    (data ?? []).forEach((row) => {
      const record = row as { id: string; technical_attachment: TechnicalAttachmentRaw | null };
      map.set(String(record.id), record.technical_attachment ?? null);
    });
  }

  return map;
}

interface OrderDiagnosisAnalysis {
  analyzed: boolean;
  matches: DiagnosisMatch[];
  fellBackToOther: boolean;
}

async function analyzeOrderDiagnosis(
  row: LightOrderRow,
  attachment: TechnicalAttachmentRaw | null,
): Promise<OrderDiagnosisAnalysis> {
  const fallbackText = [row.problem_description, row.solution_description, row.technical_notes]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('. ');

  let sourceText: string | null = null;

  if (attachment?.dataUrl && isPdfAttachment(attachment.fileName, attachment.mimeType)) {
    const extraction = await extractPdfTextFromDataUrl(attachment.dataUrl);
    if (extraction && extraction.hasTextLayer) {
      sourceText = extraction.text;
    }
  }

  if (!sourceText && fallbackText) {
    sourceText = fallbackText;
  }

  if (!sourceText) {
    return { analyzed: false, matches: [], fellBackToOther: false };
  }

  const result = classifyDiagnosisText(sourceText);
  return { analyzed: true, matches: result.matches, fellBackToOther: result.fellBackToOther };
}

interface AggregationBucket {
  totalEquipments: number;
  categoryCounts: Map<string, { label: string; count: number }>;
}

function createBucket(): AggregationBucket {
  return { totalEquipments: 0, categoryCounts: new Map() };
}

function addToBucket(bucket: AggregationBucket, categoryId: string, label: string) {
  const current = bucket.categoryCounts.get(categoryId);
  if (current) {
    current.count += 1;
  } else {
    bucket.categoryCounts.set(categoryId, { label, count: 1 });
  }
}

function bucketToDiagnosisRows(bucket: AggregationBucket): DiagnosisCountRow[] {
  const rows = Array.from(bucket.categoryCounts.entries()).map(([categoryId, { label, count }]) => ({
    categoryId,
    label,
    count,
    percentage: bucket.totalEquipments > 0 ? (count / bucket.totalEquipments) * 100 : 0,
  }));

  return rows.sort((a, b) => b.count - a.count);
}

const NOT_IDENTIFIED_STATE = { code: 'NAO_IDENTIFICADO', label: 'Estado não identificado' };

async function buildSectionForProductType(
  productType: 'BATTERY' | 'CHARGER',
  rows: LightOrderRow[],
  companyLookup: CompanyLookup,
  onProgress?: ReportProgressCallback,
): Promise<ProductSectionResult> {
  const typedRows = rows.filter((row) => (row.product_type === 'CHARGER' ? 'CHARGER' : 'BATTERY') === productType);

  const attachments = await fetchAttachments(
    typedRows.map((row) => row.id),
    onProgress,
  );

  const nationalBucket = createBucket();
  const stateBuckets = new Map<string, { label: string; bucket: AggregationBucket }>();
  let totalAnalyzed = 0;
  let totalNotAnalyzed = 0;

  for (let i = 0; i < typedRows.length; i += 1) {
    const row = typedRows[i];
    onProgress?.(`Analisando relatórios: ${i + 1}/${typedRows.length}`);

    const analysis = await analyzeOrderDiagnosis(row, attachments.get(row.id) ?? null);

    if (!analysis.analyzed) {
      totalNotAnalyzed += 1;
      continue;
    }

    totalAnalyzed += 1;
    nationalBucket.totalEquipments += 1;

    const resolvedState = resolveState(row, companyLookup) ?? NOT_IDENTIFIED_STATE;
    let stateEntry = stateBuckets.get(resolvedState.code);
    if (!stateEntry) {
      stateEntry = { label: resolvedState.label, bucket: createBucket() };
      stateBuckets.set(resolvedState.code, stateEntry);
    }
    stateEntry.bucket.totalEquipments += 1;

    if (analysis.matches.length > 0) {
      analysis.matches.forEach((match) => {
        addToBucket(nationalBucket, match.categoryId, match.categoryLabel);
        addToBucket(stateEntry!.bucket, match.categoryId, match.categoryLabel);
      });
    } else if (analysis.fellBackToOther) {
      addToBucket(nationalBucket, OTHER_CATEGORY.id, OTHER_CATEGORY.label);
      addToBucket(stateEntry.bucket, OTHER_CATEGORY.id, OTHER_CATEGORY.label);
    }
  }

  const byState: StateBreakdownRow[] = Array.from(stateBuckets.entries())
    .map(([stateCode, { label, bucket }]) => ({
      stateCode,
      stateLabel: label,
      totalEquipments: bucket.totalEquipments,
      diagnoses: bucketToDiagnosisRows(bucket),
    }))
    .sort((a, b) => b.totalEquipments - a.totalEquipments);

  return {
    productType,
    totalAnalyzed,
    totalNotAnalyzed,
    national: bucketToDiagnosisRows(nationalBucket),
    byState,
  };
}

export async function buildVamosReport(
  companies: Company[],
  filters: VamosReportFilters,
  onProgress?: ReportProgressCallback,
): Promise<VamosReportResult> {
  onProgress?.('Buscando ordens de serviço da VAMOS no período selecionado...');

  const since = new Date();
  since.setDate(since.getDate() - filters.periodDays);
  const sinceIso = since.toISOString();

  const vamosCnpjs = await fetchVamosCnpjList(companies);
  const lightRows = await fetchLightOrders(sinceIso, vamosCnpjs);

  const relevantRows =
    filters.productType === 'ALL'
      ? lightRows
      : lightRows.filter((row) => (row.product_type === 'CHARGER' ? 'CHARGER' : 'BATTERY') === filters.productType);

  onProgress?.(`${relevantRows.length} ordem(ns) encontrada(s). Analisando diagnósticos...`);

  const companyLookup = buildCompanyLookup(companies);

  const productTypesToProcess: Array<'BATTERY' | 'CHARGER'> =
    filters.productType === 'ALL' ? ['BATTERY', 'CHARGER'] : [filters.productType];

  const sections: ProductSectionResult[] = [];
  for (const productType of productTypesToProcess) {
    const section = await buildSectionForProductType(productType, relevantRows, companyLookup, onProgress);
    sections.push(section);
  }

  onProgress?.('Calculando diagnósticos...');

  return {
    filters,
    generatedAt: new Date(),
    totalOrdersFound: relevantRows.length,
    sections,
  };
}
