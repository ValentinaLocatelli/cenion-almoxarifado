import {
  buildPdfFromJpegPages,
  createPageCanvas,
  cmToPx,
  drawPdfFooter,
  drawWrappedText,
  formatDateOnly,
  loadOptionalImage,
  scale,
  REPORT_PDF_BRAND_PURPLE,
  REPORT_PDF_FONT_FAMILY,
  REPORT_PDF_LOGO_URL,
} from '@/lib/orderPdf';
import { PRODUCT_TYPE_LABELS } from '@/types';
import type { ProductSectionResult, VamosReportResult } from '@/lib/vamosReport';

/**
 * Gera o PDF final do relatório "Relatórios → VAMOS" (regra 11 da
 * especificação): aparência de planilha, com ANÁLISE GERAL — BRASIL antes
 * da ANÁLISE POR ESTADO, seções separadas para Baterias/Carregadores
 * quando "Todos" for selecionado, e paginação automática.
 */

const MARGIN_X = 70;
const MARGIN_TOP = cmToPx(1.8);
const MARGIN_BOTTOM = cmToPx(2.1);

class ReportPager {
  private pages: string[] = [];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  cursorY = 0;

  constructor(private readonly width: number = 1240, private readonly height: number = 1754) {
    this.canvas = createPageCanvas();
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível gerar o PDF do relatório.');
    this.ctx = ctx;
    this.startNewPage();
  }

  get context(): CanvasRenderingContext2D {
    return this.ctx;
  }

  get pageWidth(): number {
    return this.canvas.width;
  }

  private startNewPage() {
    this.canvas = createPageCanvas();
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível gerar o PDF do relatório.');
    this.ctx = ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.cursorY = MARGIN_TOP;
  }

  private closeCurrentPage() {
    drawPdfFooter(this.ctx, this.canvas, MARGIN_X, `Página ${this.pages.length + 1}`);
    this.pages.push(this.canvas.toDataURL('image/jpeg', 0.92));
  }

  /** Garante espaço vertical disponível na página atual; se não houver, cria nova página. */
  ensureSpace(height: number) {
    if (this.cursorY + height > this.canvas.height - MARGIN_BOTTOM) {
      this.closeCurrentPage();
      this.startNewPage();
    }
  }

  finish(): string[] {
    this.closeCurrentPage();
    return this.pages;
  }
}

function drawSectionBar(pager: ReportPager, title: string) {
  pager.ensureSpace(scale(48));
  const ctx = pager.context;
  const barHeight = scale(34);
  ctx.fillStyle = REPORT_PDF_BRAND_PURPLE;
  ctx.fillRect(MARGIN_X, pager.cursorY, pager.pageWidth - MARGIN_X * 2, barHeight);
  ctx.font = `700 ${scale(15)}px ${REPORT_PDF_FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, MARGIN_X + 14, pager.cursorY + scale(23));
  pager.cursorY += barHeight + scale(16);
}

function drawSubHeading(pager: ReportPager, text: string) {
  pager.ensureSpace(scale(30));
  const ctx = pager.context;
  ctx.font = `700 ${scale(14)}px ${REPORT_PDF_FONT_FAMILY}`;
  ctx.fillStyle = '#111827';
  ctx.fillText(text, MARGIN_X, pager.cursorY);
  pager.cursorY += scale(24);
}

interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

/** Desenha uma tabela com cabeçalho repetido automaticamente ao quebrar de página. */
function drawTable(pager: ReportPager, columns: TableColumn[], rows: string[][]) {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const rowHeight = scale(28);
  const headerHeight = scale(30);

  const drawHeader = () => {
    pager.ensureSpace(headerHeight + rowHeight);
    const ctx = pager.context;
    ctx.fillStyle = REPORT_PDF_BRAND_PURPLE;
    ctx.fillRect(MARGIN_X, pager.cursorY, tableWidth, headerHeight);
    ctx.font = `700 ${scale(12)}px ${REPORT_PDF_FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';

    let x = MARGIN_X;
    columns.forEach((col) => {
      const label = truncateToWidth(ctx, col.header, col.width - 16);
      const textX = col.align === 'right' ? x + col.width - 12 - ctx.measureText(label).width : x + 12;
      ctx.fillText(label, textX, pager.cursorY + scale(20));
      x += col.width;
    });

    pager.cursorY += headerHeight;
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    if (pager.cursorY + rowHeight > pager.context.canvas.height - MARGIN_BOTTOM) {
      drawHeader();
    }

    const ctx = pager.context;
    ctx.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#f5f3ff';
    ctx.fillRect(MARGIN_X, pager.cursorY, tableWidth, rowHeight);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN_X, pager.cursorY, tableWidth, rowHeight);

    ctx.font = `500 ${scale(12)}px ${REPORT_PDF_FONT_FAMILY}`;
    ctx.fillStyle = '#1f2937';

    let x = MARGIN_X;
    row.forEach((cell, colIndex) => {
      const col = columns[colIndex];
      const label = truncateToWidth(ctx, cell, col.width - 16);
      const textX = col.align === 'right' ? x + col.width - 12 - ctx.measureText(label).width : x + 12;
      ctx.fillText(label, textX, pager.cursorY + scale(19));
      x += col.width;
    });

    pager.cursorY += rowHeight;
  });

  pager.cursorY += scale(20);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

function drawNationalTable(pager: ReportPager, section: ProductSectionResult) {
  drawSubHeading(pager, 'ANÁLISE GERAL — BRASIL');

  if (section.national.length === 0) {
    pager.ensureSpace(scale(24));
    pager.context.font = `500 ${scale(13)}px ${REPORT_PDF_FONT_FAMILY}`;
    pager.context.fillStyle = '#6b7280';
    pager.context.fillText('Nenhum diagnóstico reconhecido no período.', MARGIN_X, pager.cursorY);
    pager.cursorY += scale(28);
    return;
  }

  const tableWidth = pager.pageWidth - MARGIN_X * 2;
  const columns: TableColumn[] = [
    { header: 'Diagnóstico', width: tableWidth - 260 },
    { header: 'Quantidade', width: 130, align: 'right' },
    { header: '%', width: 130, align: 'right' },
  ];

  const rows = section.national.map((row) => [row.label, String(row.count), formatPercentage(row.percentage)]);
  drawTable(pager, columns, rows);
}

function drawStateTable(pager: ReportPager, section: ProductSectionResult) {
  drawSubHeading(pager, 'ANÁLISE POR ESTADO');

  if (section.byState.length === 0) {
    pager.ensureSpace(scale(24));
    pager.context.font = `500 ${scale(13)}px ${REPORT_PDF_FONT_FAMILY}`;
    pager.context.fillStyle = '#6b7280';
    pager.context.fillText('Nenhum registro com estado identificado no período.', MARGIN_X, pager.cursorY);
    pager.cursorY += scale(28);
    return;
  }

  const tableWidth = pager.pageWidth - MARGIN_X * 2;
  const columns: TableColumn[] = [
    { header: 'Estado', width: 140 },
    { header: 'Equipamentos', width: 140, align: 'right' },
    { header: 'Diagnóstico(s)', width: tableWidth - 140 - 140 - 120 },
    { header: '%', width: 120, align: 'right' },
  ];

  const rows: string[][] = [];
  section.byState.forEach((state) => {
    if (state.diagnoses.length === 0) {
      rows.push([state.stateLabel, String(state.totalEquipments), '-', '-']);
      return;
    }

    state.diagnoses.forEach((diagnosis, index) => {
      rows.push([
        index === 0 ? state.stateLabel : '',
        index === 0 ? String(state.totalEquipments) : '',
        diagnosis.label,
        formatPercentage(diagnosis.percentage),
      ]);
    });
  });

  drawTable(pager, columns, rows);
}

function drawSection(pager: ReportPager, section: ProductSectionResult) {
  drawSectionBar(pager, section.productType === 'BATTERY' ? 'BATERIAS' : 'CARREGADORES');

  pager.ensureSpace(scale(24));
  pager.context.font = `500 ${scale(12)}px ${REPORT_PDF_FONT_FAMILY}`;
  pager.context.fillStyle = '#374151';
  pager.context.fillText(
    `Total analisado: ${section.totalAnalyzed}    Total não analisado: ${section.totalNotAnalyzed}`,
    MARGIN_X,
    pager.cursorY,
  );
  pager.cursorY += scale(26);

  drawNationalTable(pager, section);
  drawStateTable(pager, section);
  pager.cursorY += scale(10);
}

async function drawHeader(pager: ReportPager, result: VamosReportResult): Promise<void> {
  const ctx = pager.context;

  const logo = await loadOptionalImage(REPORT_PDF_LOGO_URL);
  if (logo) {
    const maxLogoWidth = 180;
    const maxLogoHeight = 78;
    const ratio = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
    const drawWidth = logo.width * ratio;
    const drawHeight = logo.height * ratio;
    ctx.drawImage(logo, pager.pageWidth - MARGIN_X - drawWidth, pager.cursorY - 20, drawWidth, drawHeight);
  }

  ctx.font = `700 ${scale(19)}px ${REPORT_PDF_FONT_FAMILY}`;
  ctx.fillStyle = '#111827';
  ctx.fillText('RELATÓRIO DE DIAGNÓSTICOS — VAMOS', MARGIN_X, pager.cursorY, pager.pageWidth - MARGIN_X * 2 - 200);
  pager.cursorY += scale(34);

  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, pager.cursorY);
  ctx.lineTo(pager.pageWidth - MARGIN_X, pager.cursorY);
  ctx.stroke();
  pager.cursorY += scale(24);

  const productTypeLabel =
    result.filters.productType === 'ALL' ? 'Todos' : PRODUCT_TYPE_LABELS[result.filters.productType];

  const totalAnalyzed = result.sections.reduce((sum, section) => sum + section.totalAnalyzed, 0);
  const totalNotAnalyzed = result.sections.reduce((sum, section) => sum + section.totalNotAnalyzed, 0);

  const infoLines = [
    `Período: últimos ${result.filters.periodLabel}`,
    `Data de geração: ${formatDateOnly(result.generatedAt)}`,
    `Tipo: ${productTypeLabel}`,
    `Total de OS encontradas: ${result.totalOrdersFound}`,
    `Total analisado: ${totalAnalyzed}${totalNotAnalyzed > 0 ? `    Total não analisado: ${totalNotAnalyzed}` : ''}`,
  ];

  ctx.font = `500 ${scale(13)}px ${REPORT_PDF_FONT_FAMILY}`;
  ctx.fillStyle = '#374151';
  infoLines.forEach((line) => {
    pager.cursorY = drawWrappedText(ctx, line, MARGIN_X, pager.cursorY, pager.pageWidth - MARGIN_X * 2, scale(19));
  });

  pager.cursorY += scale(6);
  ctx.font = `italic 500 ${scale(11)}px ${REPORT_PDF_FONT_FAMILY}`;
  ctx.fillStyle = '#6b7280';
  pager.cursorY = drawWrappedText(
    ctx,
    'Observação: um mesmo equipamento pode apresentar mais de um diagnóstico, por isso a soma das porcentagens pode ultrapassar 100%.',
    MARGIN_X,
    pager.cursorY,
    pager.pageWidth - MARGIN_X * 2,
    scale(16),
  );

  pager.cursorY += scale(18);
}

export async function generateVamosReportPdfBlob(result: VamosReportResult): Promise<Blob> {
  const pager = new ReportPager();
  await drawHeader(pager, result);

  result.sections.forEach((section) => {
    drawSection(pager, section);
  });

  const pages = pager.finish();
  return buildPdfFromJpegPages(pages);
}

export function buildVamosReportFileName(result: VamosReportResult): string {
  const typeSlug =
    result.filters.productType === 'ALL'
      ? 'Todos'
      : result.filters.productType === 'BATTERY'
        ? 'Baterias'
        : 'Carregadores';

  const dateSlug = new Intl.DateTimeFormat('sv-SE').format(result.generatedAt); // yyyy-mm-dd
  return `Relatorio_VAMOS_${typeSlug}_${dateSlug}.pdf`;
}
