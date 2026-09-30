import type { QuotePdfPayload, ServiceOrder } from '@/types';
import { PRODUCT_TYPE_LABELS, STATUS_LABELS } from '@/types';
import type { ProductionOrder } from '@/types/production';

const A4_WIDTH_PX = 1240;
const A4_HEIGHT_PX = 1754;
const A4_WIDTH_PT = 595;
const A4_HEIGHT_PT = 842;
const PDF_BRAND_PURPLE = '#773DFA';
const PDF_LOGO_URL = 'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=358,fit=crop,q=95/AVLboyNgkNhBr657/logo-cenion-dOq4JW467GiMR24n.jpeg';
const PDF_FONT_FAMILY = 'Aptos, Arial';
export const REPORT_PDF_BRAND_PURPLE = PDF_BRAND_PURPLE;
export const REPORT_PDF_FONT_FAMILY = PDF_FONT_FAMILY;
export const REPORT_A4_WIDTH_PX = A4_WIDTH_PX;
export const REPORT_A4_HEIGHT_PX = A4_HEIGHT_PX;
export const REPORT_PDF_LOGO_URL = PDF_LOGO_URL;
const PDF_FONT_SCALE = 1.5;
const PDF_FOOTER_COMPANY = 'Cenion Indústria e Comércio de Aparelhos Eletrônicos LTDA';
const PDF_FOOTER_CNPJ = 'CNPJ 48.320.953/0001-63';

export function scale(value: number): number {
  return Math.round(value * PDF_FONT_SCALE);
}

export function cmToPx(cm: number): number {
  return Math.round((cm / 2.54) * (A4_WIDTH_PX / 8.27));
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatDate(value?: Date): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

export function formatDateOnly(value?: Date): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = (dataUrl.split(',')[1] ?? '').replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function mergeUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function createPdfStreamObject(content: string): string {
  const streamBytes = new TextEncoder().encode(content);
  return `<< /Length ${streamBytes.length} >>\nstream\n${content}\nendstream`;
}

function extractJpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  let index = 2;

  while (index < bytes.length) {
    if (bytes[index] !== 0xff) {
      index += 1;
      continue;
    }

    const marker = bytes[index + 1];
    const markerHasLength = marker !== 0xd8 && marker !== 0xd9;

    if (!markerHasLength) {
      index += 2;
      continue;
    }

    const segmentLength = (bytes[index + 2] << 8) + bytes[index + 3];
    const isSofMarker =
      marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3 ||
      marker === 0xc5 || marker === 0xc6 || marker === 0xc7 || marker === 0xc9 ||
      marker === 0xca || marker === 0xcb || marker === 0xcd || marker === 0xce ||
      marker === 0xcf;

    if (isSofMarker) {
      const height = (bytes[index + 5] << 8) + bytes[index + 6];
      const width = (bytes[index + 7] << 8) + bytes[index + 8];
      return { width, height };
    }

    index += 2 + segmentLength;
  }

  return { width: A4_WIDTH_PX, height: A4_HEIGHT_PX };
}

export function buildPdfFromJpegPages(pageJpegs: string[]): Blob {
  const encoder = new TextEncoder();
  const imageBytes = pageJpegs.map(dataUrlToBytes);
  const imageDimensions = imageBytes.map(extractJpegDimensions);

  const objects: Uint8Array[] = [];

  const pushObject = (objectIndex: number, content: string | Uint8Array) => {
    const header = encoder.encode(`${objectIndex} 0 obj\n`);
    const body = typeof content === 'string' ? encoder.encode(content) : content;
    const footer = encoder.encode('\nendobj\n');
    objects.push(mergeUint8Arrays([header, body, footer]));
  };

  const pageRefs = imageBytes.map((_, index) => `${3 + index * 3} 0 R`).join(' ');

  pushObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  pushObject(2, `<< /Type /Pages /Kids [${pageRefs}] /Count ${imageBytes.length} >>`);

  imageBytes.forEach((_, index) => {
    const pageObjectId = 3 + index * 3;
    const contentObjectId = 4 + index * 3;
    const imageObjectId = 5 + index * 3;

    pushObject(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im1 ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );

    const content = `q\n${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm\n/Im1 Do\nQ`;
    pushObject(contentObjectId, createPdfStreamObject(content));

    const imageHeader = encoder.encode(
      `<< /Type /XObject /Subtype /Image /Width ${imageDimensions[index].width} /Height ${imageDimensions[index].height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes[index].length} >>\nstream\n`,
    );
    const imageFooter = encoder.encode('\nendstream');
    pushObject(imageObjectId, mergeUint8Arrays([imageHeader, imageBytes[index], imageFooter]));
  });

  // Binary comment improves compatibility with strict PDF parsers.
  const pdfHeader = mergeUint8Arrays([
    encoder.encode('%PDF-1.4\n%'),
    new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]),
    encoder.encode('\n'),
  ]);
  const xrefEntries: string[] = ['0000000000 65535 f '];

  let offset = pdfHeader.length;
  const bodyParts: Uint8Array[] = [];

  objects.forEach((objectBytes) => {
    xrefEntries.push(`${offset.toString().padStart(10, '0')} 00000 n `);
    bodyParts.push(objectBytes);
    offset += objectBytes.length;
  });

  const xrefOffset = offset;
  const xref = encoder.encode(
    `xref\n0 ${objects.length + 1}\n${xrefEntries.join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  const pdfBytes = mergeUint8Arrays([pdfHeader, ...bodyParts, xref]);
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export function createPageCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = A4_WIDTH_PX;
  canvas.height = A4_HEIGHT_PX;
  return canvas;
}

export function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines?: number,
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  let renderedLines = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = context.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      context.fillText(line, x, currentY);
      renderedLines += 1;
      if (maxLines && renderedLines >= maxLines) {
        return currentY + lineHeight;
      }
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    context.fillText(line, x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

export function drawPdfFooter(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  marginX: number,
  pageLabel: string,
): void {
  const footerY = canvas.height - scale(64);
  context.font = `500 ${scale(12)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#6b7280';
  context.fillText(PDF_FOOTER_COMPANY, marginX, footerY);
  context.fillText(PDF_FOOTER_CNPJ, marginX, footerY + scale(18));
  context.fillText(pageLabel, canvas.width - marginX - scale(100), canvas.height - scale(40));
}

async function drawPageOne(
  order: ServiceOrder,
  payload: QuotePdfPayload,
  pageLabel: string,
): Promise<string> {
  const canvas = createPageCanvas();
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Não foi possível gerar o PDF.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const marginX = 80;
  const marginTop = cmToPx(2.5);
  const marginBottom = cmToPx(2.5);
  const headerTop = marginTop;
  const logoAreaWidth = 250;
  const titleMaxWidth = canvas.width - marginX * 2 - logoAreaWidth;
  let cursorY = marginTop;

  const logo = await loadOptionalImage(PDF_LOGO_URL);
  if (logo) {
    const maxLogoWidth = 220;
    const maxLogoHeight = 96;
    const ratio = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
    const drawWidth = logo.width * ratio;
    const drawHeight = logo.height * ratio;
    const drawX = canvas.width - marginX - drawWidth;
    const drawY = headerTop - 52;
    context.drawImage(logo, drawX, drawY, drawWidth, drawHeight);
  }

  context.fillStyle = '#111827';
  context.font = `700 ${scale(18)}px ${PDF_FONT_FAMILY}`;
  context.fillText('Orçamento de Serviço', marginX, cursorY, titleMaxWidth);

  cursorY += scale(28);
  context.font = `500 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#4b5563';
  context.fillText(`OS ${order.omieOSNumber}`, marginX, cursorY, titleMaxWidth);

  cursorY += scale(28);
  context.strokeStyle = '#d1d5db';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(marginX, cursorY);
  context.lineTo(canvas.width - marginX, cursorY);
  context.stroke();

  cursorY += scale(26);
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#111827';
  context.fillText('Dados do Cliente', marginX, cursorY);

  cursorY += scale(24);
  context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#1f2937';
  const customerLineHeight = scale(20);

  const customerLines = [
    `Cliente: ${payload.clientName}`,
    `CNPJ: ${payload.clientCnpj || '-'}`,
    `Contato: ${payload.contactName || '-'}`,
    `E-mail: ${payload.clientEmail || '-'}`,
    `Telefone: ${payload.clientPhone || '-'}`,
    `Produto: ${order.productDescription}`,
    `Serviço/Produto: ${PRODUCT_TYPE_LABELS[order.productType]}`,
    `Status Atual: ${STATUS_LABELS[order.status]}`,
    `Data de Geração: ${formatDateOnly(new Date())}`,
  ];

  for (const line of customerLines) {
    cursorY = drawWrappedText(context, line, marginX, cursorY, canvas.width - marginX * 2, customerLineHeight);
  }

  // Espaço extra (~2 enters) entre Dados do Cliente e Diagnóstico
  cursorY += customerLineHeight * 2;
  const sectionHeaderHeight = scale(36);
  context.fillStyle = PDF_BRAND_PURPLE;
  context.fillRect(marginX, cursorY - scale(26), canvas.width - marginX * 2, sectionHeaderHeight);
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#ffffff';
  context.fillText('Diagnóstico', marginX + 14, cursorY);

  cursorY += scale(26);
  context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#1f2937';
  cursorY = drawWrappedText(
    context,
    payload.diagnosis?.trim() || '-',
    marginX,
    cursorY,
    canvas.width - marginX * 2,
    scale(20),
    5,
  );

  cursorY += scale(12);
  context.fillStyle = PDF_BRAND_PURPLE;
  context.fillRect(marginX, cursorY - scale(26), canvas.width - marginX * 2, sectionHeaderHeight);
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#ffffff';
  context.fillText('Solução', marginX + 14, cursorY);

  cursorY += scale(26);
  context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#1f2937';
  cursorY = drawWrappedText(
    context,
    payload.solution?.trim() || '-',
    marginX,
    cursorY,
    canvas.width - marginX * 2,
    scale(20),
    5,
  );

  cursorY += scale(22);
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#111827';
  context.fillText('Orçamento', marginX, cursorY);

  cursorY += scale(20);
  const tableX = marginX;
  const tableWidth = canvas.width - marginX * 2;
  const col1 = 510;
  const col2 = 170;
  const col3 = 170;
  const col4 = tableWidth - col1 - col2 - col3;

  context.fillStyle = PDF_BRAND_PURPLE;
  context.fillRect(tableX, cursorY, tableWidth, scale(34));

  context.font = `700 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#ffffff';
  context.fillText('Tipo', tableX + 12, cursorY + scale(22));
  context.fillText('Qtd.', tableX + col1 + 12, cursorY + scale(22));
  context.fillText('Valor', tableX + col1 + col2 + 12, cursorY + scale(22));
  context.fillText('Total', tableX + col1 + col2 + col3 + 12, cursorY + scale(22));

  cursorY += scale(34);

  let totalServices = 0;
  context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  const serviceRowHeight = scale(30);

  payload.services.forEach((service, index) => {
    const rowTotal = service.quantity * service.unitValue;
    totalServices += rowTotal;

    context.fillStyle = index % 2 === 0 ? '#ffffff' : '#f9fafb';
    context.fillRect(tableX, cursorY, tableWidth, serviceRowHeight);

    context.fillStyle = '#1f2937';
    context.fillText(service.type, tableX + 12, cursorY + scale(20));
    context.fillText(`${service.quantity}`, tableX + col1 + 12, cursorY + scale(20));
    context.fillText(formatCurrency(service.unitValue), tableX + col1 + col2 + 12, cursorY + scale(20));
    context.fillText(formatCurrency(rowTotal), tableX + col1 + col2 + col3 + 12, cursorY + scale(20));

    cursorY += serviceRowHeight;
  });

  context.strokeStyle = '#d1d5db';
  context.lineWidth = 2;
  context.strokeRect(
    tableX,
    cursorY - ((payload.services.length * serviceRowHeight) + scale(34)),
    tableWidth,
    (payload.services.length * serviceRowHeight) + scale(34),
  );

  cursorY += scale(24);
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#111827';
  context.fillText(`Total dos Serviços: ${formatCurrency(totalServices)}`, tableX, cursorY);

  // Aproximadamente dois "enter" de espaço
  cursorY += scale(30);
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#111827';
  context.fillText('Condições comerciais', tableX, cursorY);

  cursorY += scale(14);
  const commercialRows: Array<[string, string]> = [
    ['Validade da Proposta', payload.proposalValidity?.trim() || '05 dias'],
    ['Forma de Pagamento', payload.paymentMethod?.trim() || 'Boleto / Depósito'],
    ['Condições de Pagamento', payload.paymentTerms?.trim() || '63 dias'],
    ['Prazo de Entrega', payload.deliveryDeadline?.trim() || '30 dias úteis após aprovação'],
    ['Frete', payload.freightType?.trim() || 'FOB'],
    ['Garantia', payload.warrantyTerms?.trim() || '03 meses após emissão da Nota Fiscal'],
  ];

  const commercialTableX = tableX;
  const commercialTableWidth = tableWidth;
  const commercialCol1 = 350;
  const commercialCol2 = commercialTableWidth - commercialCol1;
  const commercialRowHeight = scale(32);
  const commercialTop = cursorY;

  context.strokeStyle = '#111827';
  context.lineWidth = 2;
  context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#111827';

  commercialRows.forEach(([label, value], index) => {
    const rowY = commercialTop + index * commercialRowHeight;

    context.beginPath();
    context.moveTo(commercialTableX, rowY);
    context.lineTo(commercialTableX + commercialTableWidth, rowY);
    context.stroke();

    context.fillText(label, commercialTableX + 12, rowY + scale(22));
    context.fillText(value, commercialTableX + commercialCol1 + 12, rowY + scale(22));
  });

  const commercialBottom = commercialTop + commercialRows.length * commercialRowHeight;
  context.beginPath();
  context.moveTo(commercialTableX, commercialBottom);
  context.lineTo(commercialTableX + commercialTableWidth, commercialBottom);
  context.stroke();

  context.beginPath();
  context.moveTo(commercialTableX, commercialTop);
  context.lineTo(commercialTableX, commercialBottom);
  context.stroke();

  context.beginPath();
  context.moveTo(commercialTableX + commercialCol1, commercialTop);
  context.lineTo(commercialTableX + commercialCol1, commercialBottom);
  context.stroke();

  context.beginPath();
  context.moveTo(commercialTableX + commercialTableWidth, commercialTop);
  context.lineTo(commercialTableX + commercialTableWidth, commercialBottom);
  context.stroke();

  cursorY = commercialBottom + scale(24);
  drawPdfFooter(context, canvas, marginX, pageLabel);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao carregar imagem para o PDF.'));
    image.src = src;
  });
}

export async function loadOptionalImage(src: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(src);
  } catch {
    return null;
  }
}

async function drawPageTwo(payload: QuotePdfPayload, pageLabel: string): Promise<string> {
  const canvas = createPageCanvas();
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Não foi possível gerar o PDF.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const marginX = 80;
  let cursorY = scale(90);

  context.fillStyle = '#111827';
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillText('Imagens da Análise', marginX, cursorY);

  cursorY += scale(22);
  context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#4b5563';
  context.fillText(`Total de imagens: ${payload.imageDataUrls.length}`, marginX, cursorY);

  const gridTop = cursorY + scale(28);
  const gap = scale(20);
  const cellWidth = (canvas.width - marginX * 2 - gap) / 2;
  const cellHeight = (canvas.height - gridTop - 120 - gap * 2) / 3;

  const images = await Promise.all(payload.imageDataUrls.map(loadImage));

  images.forEach((image, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = marginX + col * (cellWidth + gap);
    const y = gridTop + row * (cellHeight + gap);

    context.fillStyle = '#f3f4f6';
    context.fillRect(x, y, cellWidth, cellHeight);

    const imageScale = Math.min(cellWidth / image.width, cellHeight / image.height);
    const drawWidth = image.width * imageScale;
    const drawHeight = image.height * imageScale;
    const drawX = x + (cellWidth - drawWidth) / 2;
    const drawY = y + (cellHeight - drawHeight) / 2;

    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    context.strokeStyle = '#d1d5db';
    context.lineWidth = 2;
    context.strokeRect(x, y, cellWidth, cellHeight);

    context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
    context.fillStyle = '#374151';
    context.fillText(`Imagem ${index + 1}`, x + 12, y + scale(24));
  });

  drawPdfFooter(context, canvas, marginX, pageLabel);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function simpleTextPdf(lines: string[]): Blob {
  const contentLines = [
    'BT',
    '/F1 18 Tf',
    '21 TL',
    '50 800 Td',
    ...lines.map((line, index) => `${index === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`),
    'ET',
  ];

  const stream = contentLines.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
  ];

  const encoder = new TextEncoder();
  const byteLength = (value: string) => encoder.encode(value).length;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export interface WarrantyNoCostPayload {
  diagnosis?: string;
  solution?: string;
}

async function drawWarrantyPage(
  order: ServiceOrder,
  payload: WarrantyNoCostPayload,
  pageLabel: string,
): Promise<string> {
  const canvas = createPageCanvas();
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível gerar o PDF.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const marginX = 80;
  const marginTop = cmToPx(2.5);
  const logoAreaWidth = 250;
  const titleMaxWidth = canvas.width - marginX * 2 - logoAreaWidth;
  let cursorY = marginTop;

  const logo = await loadOptionalImage(PDF_LOGO_URL);
  if (logo) {
    const maxLogoWidth = 220;
    const maxLogoHeight = 96;
    const ratio = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
    const drawWidth = logo.width * ratio;
    const drawHeight = logo.height * ratio;
    context.drawImage(logo, canvas.width - marginX - drawWidth, marginTop - 52, drawWidth, drawHeight);
  }

  context.fillStyle = '#111827';
  context.font = `700 ${scale(18)}px ${PDF_FONT_FAMILY}`;
  context.fillText('Laudo de Garantia', marginX, cursorY, titleMaxWidth);

  cursorY += scale(28);
  context.font = `500 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#4b5563';
  context.fillText(`OS ${order.omieOSNumber}`, marginX, cursorY, titleMaxWidth);

  cursorY += scale(28);
  context.strokeStyle = '#d1d5db';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(marginX, cursorY);
  context.lineTo(canvas.width - marginX, cursorY);
  context.stroke();

  cursorY += scale(26);
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#111827';
  context.fillText('Dados do Cliente', marginX, cursorY);

  cursorY += scale(24);
  context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#1f2937';
  const lineHeight = scale(20);

  const clientLines = [
    `Cliente: ${order.clientName}`,
    `CNPJ: ${order.clientCnpj || '-'}`,
    `Contato: ${order.contactName || '-'}`,
    `E-mail: ${order.clientEmail || '-'}`,
    `Telefone: ${order.clientPhone || '-'}`,
    `Produto: ${order.productDescription}`,
    `Serviço/Produto: ${PRODUCT_TYPE_LABELS[order.productType]}`,
    `Status Atual: ${STATUS_LABELS[order.status]}`,
    `Data de Geração: ${formatDateOnly(new Date())}`,
  ];

  for (const line of clientLines) {
    cursorY = drawWrappedText(context, line, marginX, cursorY, canvas.width - marginX * 2, lineHeight);
  }

  cursorY += lineHeight * 2;
  const sectionHeaderHeight = scale(36);

  context.fillStyle = PDF_BRAND_PURPLE;
  context.fillRect(marginX, cursorY - scale(26), canvas.width - marginX * 2, sectionHeaderHeight);
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#ffffff';
  context.fillText('Diagnóstico', marginX + 14, cursorY);

  cursorY += scale(26);
  context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#1f2937';
  cursorY = drawWrappedText(context, payload.diagnosis?.trim() || '-', marginX, cursorY, canvas.width - marginX * 2, scale(20), 8);

  cursorY += scale(12);
  context.fillStyle = PDF_BRAND_PURPLE;
  context.fillRect(marginX, cursorY - scale(26), canvas.width - marginX * 2, sectionHeaderHeight);
  context.font = `700 ${scale(16)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#ffffff';
  context.fillText('Solução', marginX + 14, cursorY);

  cursorY += scale(26);
  context.font = `500 ${scale(13)}px ${PDF_FONT_FAMILY}`;
  context.fillStyle = '#1f2937';
  cursorY = drawWrappedText(context, payload.solution?.trim() || '-', marginX, cursorY, canvas.width - marginX * 2, scale(20), 8);

  cursorY += scale(30);
  context.fillStyle = '#16a34a';
  context.font = `700 ${scale(14)}px ${PDF_FONT_FAMILY}`;
  context.fillText('Serviço coberto pela garantia — sem custo adicional.', marginX, cursorY);

  drawPdfFooter(context, canvas, marginX, pageLabel);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function generateWarrantyNoCostPdfBlob(order: ServiceOrder, payload: WarrantyNoCostPayload): Promise<Blob> {
  const page = await drawWarrantyPage(order, payload, 'Página 1/1');
  return buildPdfFromJpegPages([page]);
}

export async function generateQuotePdfBlob(order: ServiceOrder, payload: QuotePdfPayload): Promise<Blob> {
  if (payload.imageDataUrls.length === 0) {
    const pageOneOnly = await drawPageOne(order, payload, 'Página 1/1');
    return buildPdfFromJpegPages([pageOneOnly]);
  }

  const pageOne = await drawPageOne(order, payload, 'Página 1/2');
  const pageTwo = await drawPageTwo(payload, 'Página 2/2');
  return buildPdfFromJpegPages([pageOne, pageTwo]);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao converter PDF para armazenamento.'));
    reader.readAsDataURL(blob);
  });
}

export function downloadPdfFromDataUrl(dataUrl: string, fileName: string) {
  const meta = dataUrl.split(',')[0] ?? '';
  const mimeTypeMatch = meta.match(/^data:(.*?);base64$/);
  const mimeType = mimeTypeMatch?.[1] || 'application/pdf';
  const blob = new Blob([dataUrlToBytes(dataUrl)], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function downloadOrderAsPdf(order: ServiceOrder) {
  if (order.quotePdf?.dataUrl) {
    downloadPdfFromDataUrl(order.quotePdf.dataUrl, order.quotePdf.fileName);
    return;
  }

  const lines = [
    `Ordem de Servico: ${order.omieOSNumber}`,
    '',
    `Cliente: ${order.clientName}`,
    `CNPJ: ${order.clientCnpj ?? '-'}`,
    `Produto: ${order.productDescription}`,
    `Tipo: ${PRODUCT_TYPE_LABELS[order.productType]}`,
    `Status: ${STATUS_LABELS[order.status]}`,
    `Prioridade: ${order.priority}`,
    `Tecnico: ${order.technicianName ?? 'Nao atribuido'}`,
    `Garantia: ${order.isWarranty ? 'Sim' : 'Nao'}`,
    `Criacao: ${formatDate(order.createdAt)}`,
    `Atualizacao: ${formatDate(order.updatedAt)}`,
  ];

  const blob = simpleTextPdf(lines);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${order.omieOSNumber}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function wrapTextLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text.trim()) return [''];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines;
}

async function buildProductionTextPdf(lines: string[]): Promise<Blob> {
  const pages: string[] = [];
  const marginX = 72;
  const marginTop = 60;
  const marginBottom = 70;
  const maxWidth = A4_WIDTH_PX - marginX * 2;
  const bodyFontPx = scale(11);
  const bodyLineHeight = scale(15);
  const titleFontPx = bodyFontPx * 3;
  const sectionFontPx = scale(15);
  const sectionLineHeight = scale(21);
  const logo = await loadOptionalImage(PDF_LOGO_URL);
  const sectionTitles = new Set(['Cliente', 'Endereço de Entrega', 'Especificações', 'Especificações Técnicas']);

  let canvas = createPageCanvas();
  let context = canvas.getContext('2d');
  if (!context) return simpleTextPdf(lines);

  let pageNumber = 1;
  let cursorY = marginTop;

  const startPage = () => {
    canvas = createPageCanvas();
    context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111827';

    if (pageNumber === 1 && logo) {
      const maxLogoWidth = 280;
      const maxLogoHeight = 70;
      const ratio = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
      const drawWidth = logo.width * ratio;
      const drawHeight = logo.height * ratio;
      context.drawImage(logo, marginX, marginTop - 16, drawWidth, drawHeight);
      cursorY = marginTop + drawHeight + 26;
    } else {
      cursorY = marginTop;
    }
  };

  const closePage = () => {
    if (!context) return;
    context.fillStyle = '#6b7280';
    context.font = `500 ${scale(10)}px ${PDF_FONT_FAMILY}`;
    context.fillText(`Página ${pageNumber}`, canvas.width - marginX - scale(90), canvas.height - scale(26));
    pages.push(canvas.toDataURL('image/jpeg', 0.92));
    pageNumber += 1;
  };

  startPage();

  lines.forEach((line) => {
    if (!context) return;
    const isMainTitle = line.startsWith('Ordem de Produção:');
    const isSectionTitle = sectionTitles.has(line) || /^Bateria \d+$/u.test(line);
    const fontWeight = isMainTitle || isSectionTitle ? '700' : '500';
    const fontSize = isMainTitle ? titleFontPx : isSectionTitle ? sectionFontPx : bodyFontPx;
    const lineHeight = isMainTitle ? scale(46) : isSectionTitle ? sectionLineHeight : bodyLineHeight;
    context.font = `${fontWeight} ${fontSize}px ${PDF_FONT_FAMILY}`;
    const wrapped = wrapTextLines(context, line, maxWidth);
    wrapped.forEach((wrappedLine) => {
      if (cursorY + lineHeight > canvas.height - marginBottom) {
        closePage();
        startPage();
        if (!context) return;
        context.font = `${fontWeight} ${fontSize}px ${PDF_FONT_FAMILY}`;
      }
      context.fillStyle = '#111827';
      context.fillText(wrappedLine, marginX, cursorY);
      cursorY += lineHeight;
    });

    if (isMainTitle) cursorY += scale(8);
    if (isSectionTitle) cursorY += scale(2);
  });

  closePage();
  return buildPdfFromJpegPages(pages);
}

export async function downloadProductionOrderAsPdf(order: ProductionOrder) {
  const lines: string[] = [
    `Ordem de Produção: ${order.code}`,
    '',
    'Cliente',
    `- Empresa: ${order.client.companyName || '-'}`,
    `- CNPJ: ${order.client.cnpj || '-'}`,
    `- Vendedor: ${order.client.sellerName || '-'}`,
    `- Contato: ${order.client.contactName || '-'}`,
    `- Telefone: ${order.client.contactPhone || '-'}`,
    `- E-mail: ${order.client.contactEmail || '-'}`,
    '',
    'Endereço de Entrega',
    `- Finalidade: ${
      order.delivery.purpose === 'PURCHASE'
        ? 'Compra'
        : order.delivery.purpose === 'RENTAL'
          ? 'Locação'
          : order.delivery.purpose === 'SALE'
            ? 'Venda'
            : '-'
    }`,
    `- Endereço: ${order.delivery.address || '-'}`,
    `- Cidade/UF: ${order.delivery.city || '-'} / ${order.delivery.state || '-'}`,
    `- CEP: ${order.delivery.zipCode || '-'}`,
    '',
    'Especificações Técnicas',
    `- Corrente do produto: ${order.technicalSpecs?.current || '-'}`,
    `- Tensão do produto: ${order.technicalSpecs?.voltage || '-'}`,
    `- Desenho técnico comercial: ${order.technicalSpecs?.commercialDrawing?.fileName || 'Não anexado'}`,
    `- Desenho técnico de montagem geral: ${order.technicalSpecs?.assemblyDrawing?.fileName || 'Não anexado'}`,
  ];

  if (order.productSpecification) {
    const spec = order.productSpecification;
    lines.push(`- Capacidade: ${spec.capacityAh || '-'} AH`);
    lines.push(`- Tensão: ${spec.voltageV || '-'} V`);
    lines.push(`- Conector carga: ${spec.chargeConnector === 'YES' ? 'Sim' : 'Não'}`);
    if (spec.chargeConnector === 'YES') lines.push(`- Modelo do conector de carga: ${spec.chargeConnectorModel || '-'}`);
    lines.push(`- Conector descarga: ${spec.dischargeConnector === 'YES' ? 'Sim' : 'Não'}`);
    lines.push(`- Corte de elevação: ${spec.liftCutoff === 'YES' ? 'Sim' : 'Não'}`);
    lines.push(`- Metro do cabo: ${spec.cableLengthM || '-'}`);
    lines.push(`- Comunicação CAN: ${spec.canCommunication === 'YES' ? 'Sim' : spec.canCommunication === 'NO' ? 'Não' : '-'}`);
    lines.push(`- Modelo do carregador: ${spec.chargerModel || '-'}`);
    lines.push(`- Modelo do BMS: ${spec.bmsModel === 'DALY' ? 'Daly' : 'Udan'}`);
    lines.push(`- Peso: ${spec.weightKg || '-'}`);
    lines.push(`- Ponte: ${spec.bridge === 'YES' ? 'Sim' : 'Não'}`);
    if (spec.bridge === 'YES') lines.push(`- Tipo de conector da ponte: ${spec.bridgeConnectorType || '-'}`);
  }

  lines.push(
    '',
    'Especificações',
    `- Tipo: ${order.type === 'BATTERY' ? 'Bateria' : 'Carregador'}`,
    `- Status: ${order.status}`,
    `- Técnico: ${order.technicianName || 'Não atribuído'}`,
    '',
  );

  if (order.type === 'BATTERY') {
    if (order.batteryItems.length === 0) {
      lines.push('Nenhuma configuração de bateria informada.');
    } else {
      order.batteryItems.forEach((item, index) => {
        lines.push(`Bateria ${index + 1}`);
        lines.push(`- Equipamento: ${item.equipment.brand || '-'} ${item.equipment.model || ''}`.trim());
        lines.push(`- Desenho da caixa: ${item.boxDrawing || '-'}`);
        lines.push(`- Modelo do BMS: ${item.bmsModel || '-'}`);
        lines.push(`- Modelo do Pack: ${item.packModel || '-'}`);
        lines.push(`- Precisa de contrapeso: ${item.needsCounterweight === 'YES' ? 'Sim' : 'Não'}`);
        if (item.needsCounterweight === 'YES') {
          lines.push(`- Contrapeso: ${item.counterweightKg || '-'} kg`);
        }
        lines.push(`- Içamento: ${item.hoisting || '-'}`);
        lines.push(`- Quantidade: ${item.battery.quantity || '-'}`);
        lines.push(`- Tensão nominal: ${item.battery.nominalVoltage || '-'} V`);
        lines.push(`- Capacidade nominal: ${item.battery.nominalCapacity || '-'} Ah`);
        lines.push(`- Peso: ${item.battery.weightKg || '-'} kg`);
        lines.push(`- Dimensões (mm): ${item.battery.lengthMm || '-'} x ${item.battery.widthMm || '-'} x ${item.battery.heightMm || '-'}`);
        lines.push(`- Tipo de conector: ${item.battery.connectorType || '-'}`);
        lines.push(`- Conector de carga: ${item.battery.chargeConnector || '-'}`);
        lines.push(`- Bitola cabo carga: ${item.battery.chargeCableGauge || '-'}`);
        lines.push(`- Comprimento cabo carga: ${item.battery.chargeCableLengthM || '-'} m`);
        lines.push(`- Conector de descarga: ${item.battery.dischargeConnector || '-'}`);
        lines.push(`- Bitola cabo descarga: ${item.battery.dischargeCableGauge || '-'}`);
        lines.push(`- Comprimento cabo descarga: ${item.battery.dischargeCableLengthM || '-'} m`);
        lines.push(`- Base para conector: ${item.battery.connectorBase === 'YES' ? 'Sim' : 'Não'}`);
        lines.push(`- Saída display: ${item.battery.displayOutput || '-'}`);
        lines.push(`- Comprimento cabo display: ${item.battery.displayCableLengthM || '-'} m`);
        lines.push(`- Acionamento lítio: ${item.lithium.actuationType || '-'}`);
        lines.push(`- Saída de potência: ${item.lithium.powerOutputType || '-'}`);
        lines.push(`- Corte hidráulico: ${item.lithium.needsHydraulicCutoff === 'YES' ? 'Sim' : 'Não'}`);
        lines.push(`- Parada descarga: ${item.lithium.dischargeStopCondition || '-'}`);
        lines.push(`- Temperatura mínima: ${item.operation.minTemp || '-'} ºC`);
        lines.push(`- Temperatura máxima: ${item.operation.maxTemp || '-'} ºC`);
        lines.push(`- Câmara fria: ${item.operation.coldChamberMode || '-'}`);
        if (item.instructionAttachments?.length) {
          lines.push('- Anexos/instruções:');
          item.instructionAttachments.forEach((attachment) => {
            lines.push(`  - ${attachment.fileName}`);
          });
        } else {
          lines.push('- Anexos/instruções: Nenhum');
        }
        if (item.includeCharger && item.charger) {
          lines.push('- Carregador vinculado:');
          lines.push(`  - Tensão: ${item.charger.voltage || '-'} V`);
          lines.push(`  - Corrente: ${item.charger.current || '-'} A`);
          lines.push(`  - Tensão da rede: ${item.charger.gridVoltage || '-'}`);
          lines.push(`  - Tipo de tomada: ${item.charger.outletType || '-'}`);
          lines.push(`  - Conector de carga: ${item.charger.chargeConnector || '-'}`);
          lines.push(`  - Bitola do cabo: ${item.charger.cableGauge || '-'}`);
          lines.push(`  - Comprimento do cabo: ${item.charger.cableLengthM || '-'} m`);
        } else {
          lines.push('- Carregador vinculado: Não');
        }
        lines.push('');
      });
    }
  } else {
    lines.push(`- Tensão: ${order.chargerOnly?.voltage || '-'} V`);
    lines.push(`- Corrente: ${order.chargerOnly?.current || '-'} A`);
    lines.push(`- Tensão da rede: ${order.chargerOnly?.gridVoltage || '-'}`);
    lines.push(`- Tipo de tomada: ${order.chargerOnly?.outletType || '-'}`);
    lines.push(`- Conector de carga: ${order.chargerOnly?.chargeConnector || '-'}`);
    lines.push(`- Bitola do cabo: ${order.chargerOnly?.cableGauge || '-'}`);
    lines.push(`- Comprimento do cabo: ${order.chargerOnly?.cableLengthM || '-'} m`);
  }

  const blob = await buildProductionTextPdf(lines);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${order.code}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
