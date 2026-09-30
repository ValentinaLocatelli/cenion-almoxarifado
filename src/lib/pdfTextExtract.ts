/**
 * Extração de texto de PDFs anexados às OS, para o motor de diagnósticos
 * dos "Relatórios VAMOS".
 *
 * Usa pdfjs-dist (precisa rodar `npm install` / `bun install` depois de
 * puxar esta mudança, pois a dependência foi adicionada ao package.json).
 *
 * Se o PDF for uma imagem/scan sem camada de texto (texto extraído vazio ou
 * muito curto), este módulo NÃO tenta OCR: retorna `hasTextLayer: false` e
 * quem chama deve registrar o registro como "não analisado", conforme a
 * regra 12 da especificação ("Se PDF for imagem/scan... Se não puder ser
 * lido, registrar como não analisado e continuar os demais"). Adicionar OCR
 * (ex.: tesseract.js) fica para uma iteração futura, se a análise dos PDFs
 * reais mostrar que isso é necessário — ver regra 5 da especificação.
 */

export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  hasTextLayer: boolean;
}

let workerConfigured = false;

async function ensureWorkerConfigured(): Promise<typeof import('pdfjs-dist')> {
  const pdfjsLib = await import('pdfjs-dist');

  if (!workerConfigured) {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default as string;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }

  return pdfjsLib;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return null;

  try {
    const binary = atob(base64.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Extrai o texto de um PDF a partir de um data URL (o formato em que os
 * anexos técnicos são guardados hoje em `technical_attachment.dataUrl`).
 * Retorna `null` quando o arquivo não pôde ser aberto (corrompido, não é
 * PDF válido etc.) — o chamador deve tratar isso como "não analisado".
 */
export async function extractPdfTextFromDataUrl(dataUrl: string): Promise<PdfTextExtractionResult | null> {
  const bytes = dataUrlToUint8Array(dataUrl);
  if (!bytes || bytes.length === 0) {
    return null;
  }

  try {
    const pdfjsLib = await ensureWorkerConfigured();
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const doc = await loadingTask.promise;

    let fullText = '';
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? (item as { str: string }).str : ''))
        .join(' ');
      fullText += `${pageText}\n`;
    }

    const trimmed = fullText.replace(/\s+/g, ' ').trim();

    return {
      text: trimmed,
      pageCount: doc.numPages,
      // Um PDF gerado a partir de scan/imagem normalmente extrai pouco ou
      // nenhum texto. Um relatório técnico real costuma ter várias dezenas
      // de caracteres — usamos um limiar conservador.
      hasTextLayer: trimmed.length >= 20,
    };
  } catch (error) {
    console.error('Falha ao extrair texto do PDF do relatório:', error);
    return null;
  }
}

export function isPdfAttachment(fileName?: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().includes('pdf')) return true;
  if (fileName && fileName.toLowerCase().endsWith('.pdf')) return true;
  return false;
}
