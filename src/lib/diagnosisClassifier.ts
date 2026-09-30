import { DIAGNOSIS_CATEGORIES, OTHER_CATEGORY, type DiagnosisCategoryDefinition } from '@/lib/diagnosisCategories';

/**
 * Motor de classificação de diagnósticos por regras/contexto (RN 3, 4 e 5 da
 * especificação "Relatórios VAMOS").
 *
 * Regras aplicadas:
 *  - Normaliza acentos, caixa, pontuação e espaços antes de comparar.
 *  - Um mesmo equipamento pode cair em várias categorias (não é mutuamente exclusivo).
 *  - Não classifica pela palavra isolada fora de contexto: se houver uma negação
 *    ("não", "sem", "nenhum(a)", "ausência de" etc.) antes do termo, dentro do
 *    mesmo trecho (frase/cláusula), o diagnóstico NÃO é contabilizado.
 *  - Se nenhuma categoria reconhecer o texto, mas havia texto de diagnóstico
 *    real, cai em "Outros" — nunca inventa uma categoria.
 */

export interface DiagnosisMatch {
  categoryId: string;
  categoryLabel: string;
  /** Trecho original (não normalizado) onde o termo foi encontrado, para rastreabilidade. */
  originalSnippet: string;
}

export interface ClassificationResult {
  /** Categorias reconhecidas no texto (sempre únicas — sem duplicidade por categoria). */
  matches: DiagnosisMatch[];
  /** true quando havia texto de diagnóstico mas nenhuma categoria conhecida reconheceu o conteúdo. */
  fellBackToOther: boolean;
}

const NEGATION_CUES = [
  'nao foi identificad',
  'nao foi encontrad',
  'nao foi constatad',
  'nao apresentou',
  'nao apresenta',
  'nao houve',
  'nao possui',
  'nao ha ',
  'sem indicio',
  'sem sinal',
  'sem sinais',
  'sem evidencia',
  'ausencia de',
  'nenhum indicio',
  'nenhum sinal',
  'nenhuma evidencia',
  'nao ',
  'sem ',
  'nenhum ',
  'nenhuma ',
];

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Normaliza para comparação: minúsculas, sem acento, espaços colapsados. Mantém pontuação de frase (. , ; ! ?). */
function normalizeForMatch(value: string): string {
  return stripAccents(value.toLowerCase())
    .replace(/[^a-z0-9.,;!?\n\s-]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitClauses(sentence: string): string[] {
  return sentence
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function hasNegationBefore(clausePrefix: string): boolean {
  const padded = ` ${clausePrefix} `;
  return NEGATION_CUES.some((cue) => padded.includes(` ${cue}`) || padded.includes(cue));
}

/**
 * Classifica um texto de diagnóstico livre nas categorias configuradas em
 * `diagnosisCategories.ts`. Recebe o texto original (não normalizado) para
 * conseguir devolver o trecho original como evidência.
 */
export function classifyDiagnosisText(
  originalText: string,
  categories: DiagnosisCategoryDefinition[] = DIAGNOSIS_CATEGORIES,
): ClassificationResult {
  const trimmedOriginal = originalText.trim();
  if (!trimmedOriginal) {
    return { matches: [], fellBackToOther: false };
  }

  const normalizedCategories = categories.map((category) => ({
    ...category,
    terms: category.terms.map((term) => normalizeForMatch(term)),
  }));

  const matchedIds = new Set<string>();
  const matches: DiagnosisMatch[] = [];

  const originalSentences = splitSentences(trimmedOriginal);
  const normalizedSentences = splitSentences(normalizeForMatch(trimmedOriginal));

  normalizedSentences.forEach((normalizedSentence, sentenceIndex) => {
    const clauses = splitClauses(normalizedSentence);

    clauses.forEach((clause) => {
      for (const category of normalizedCategories) {
        if (matchedIds.has(category.id)) continue;

        for (const term of category.terms) {
          if (!term) continue;
          const matchIndex = clause.indexOf(term);
          if (matchIndex === -1) continue;

          const prefix = clause.slice(0, matchIndex);
          if (hasNegationBefore(prefix)) continue;

          matchedIds.add(category.id);
          matches.push({
            categoryId: category.id,
            categoryLabel: category.label,
            originalSnippet: (originalSentences[sentenceIndex] ?? trimmedOriginal).trim(),
          });
          break;
        }
      }
    });
  });

  return {
    matches,
    fellBackToOther: matches.length === 0,
  };
}

export { OTHER_CATEGORY };
