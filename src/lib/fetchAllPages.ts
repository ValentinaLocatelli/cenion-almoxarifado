/**
 * Leitura completa de uma tabela pelo Supabase. Arquivo IDÊNTICO no OS Management, no Produção e no Estoque.
 *
 * O Supabase (PostgREST) devolve no máximo `max_rows` linhas por consulta (1000 no padrão) e não avisa que cortou: sem
 * paginar, OS, histórico e VCs mais antigos (ou mais novos, conforme a ordem) somem da tela em silêncio.
 * A consulta precisa de ordem ESTÁVEL, terminando em uma coluna única (ex.: `.order('updated_at').order('id')`), senão
 * linhas podem repetir ou faltar entre uma página e outra.
 */
export const PAGE_SIZE = 1000;

type PageResponse = { data: unknown; error: unknown };

export async function fetchAllPages<T = Record<string, unknown>>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResponse>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...(data as T[]));
    // Para só na página vazia e avança pelo que veio: o servidor pode ter max_rows menor que pageSize.
    from += data.length;
  }
  return rows;
}
