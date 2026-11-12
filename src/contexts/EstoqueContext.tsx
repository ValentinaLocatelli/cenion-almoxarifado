import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Entrada,
  EntradaInput,
  EstoqueResult,
  Item,
  ItemInput,
  Saida,
  SaidaInput,
} from '@/types/estoque';
import { EstoqueContext } from '@/contexts/EstoqueContextStore';
import { useActiveUnit } from '@/contexts/ActiveUnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/fetchAllPages';

/**
 * Estoque do almoxarifado no banco (estoque_itens + estoque_movimentos, supabase/add_estoque.sql no cenion-os-management).
 * Até 12/11/2026 ficava só no localStorage de cada navegador; agora todos os computadores veem o mesmo saldo, por
 * unidade, e o banco guarda quem lançou. O saldo nunca fica negativo: o banco recusa a gravação e a mensagem dele é
 * mostrada ao usuário. Editar uma entrada ou saída muda só aquele registro.
 */

export interface EstoqueState {
  itens: Item[];
  entradas: Entrada[];
  saidas: Saida[];
}

export interface EstoqueContextType extends EstoqueState {
  isLoading: boolean;
  /** Falha ao carregar (sem conexão, sem permissão...). */
  loadError: string | null;
  reload: () => Promise<void>;
  addEntrada: (input: EntradaInput) => Promise<EstoqueResult>;
  updateEntrada: (id: string, input: EntradaInput) => Promise<EstoqueResult>;
  removeEntrada: (id: string) => Promise<EstoqueResult>;
  setEntradaObservacao: (id: string, observacao: string) => Promise<EstoqueResult>;
  addSaida: (input: SaidaInput) => Promise<EstoqueResult>;
  updateSaida: (id: string, input: SaidaInput) => Promise<EstoqueResult>;
  removeSaida: (id: string) => Promise<EstoqueResult>;
  setSaidaObservacao: (id: string, observacao: string) => Promise<EstoqueResult>;
  addItem: (input: ItemInput) => Promise<EstoqueResult>;
  updateItem: (id: string, input: ItemInput) => Promise<EstoqueResult>;
  removeItem: (id: string) => Promise<EstoqueResult>;
}

const EMPTY: EstoqueState = { itens: [], entradas: [], saidas: [] };

/** Mesma regra de comparação do índice único do banco (sem maiúsculas e sem espaços nas pontas). */
const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const text = (value: unknown) => (typeof value === 'string' ? value : '');

function mapItem(row: Record<string, unknown>): Item {
  return {
    id: String(row.id),
    unitId: String(row.unit_id ?? ''),
    produto: text(row.produto),
    modelo: text(row.modelo),
    quantidadeMinima: typeof row.quantidade_minima === 'number' ? row.quantidade_minima : undefined,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

/** Mensagem para o usuário a partir do erro do Supabase (as do saldo já vêm em português do banco). */
export function estoqueErrorMessage(error: unknown, fallback = 'Não foi possível gravar no estoque.'): string {
  const record = (error && typeof error === 'object' ? error : {}) as { code?: string; message?: string };
  const message = record.message ?? '';
  if (record.code === '23505') return 'Já existe um item com esse produto e modelo nesta unidade.';
  if (message.includes('estoque_movimentos_entrada_local_check')) return 'Informe o local da entrada.';
  if (message.includes('estoque_movimentos_saida_tecnico_check')) return 'Informe o técnico da saída.';
  if (record.code === '42501') {
    return 'Sem permissão: o almoxarifado é só para administradores e supervisores da unidade.';
  }
  if (record.code === '23514' && message) return message;
  // Tabela ausente: 42P01 no Postgres, PGRST205 / "schema cache" no PostgREST.
  if (record.code === '42P01' || record.code === 'PGRST205' || /schema cache/i.test(message)) {
    return 'As tabelas do estoque ainda não existem neste banco. Rode supabase/add_estoque.sql no Supabase.';
  }
  return message || fallback;
}

export function EstoqueProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { activeUnitId } = useActiveUnit();
  const [state, setState] = useState<EstoqueState>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++loadVersion.current;
    if (!isAuthenticated || !activeUnitId) {
      setState(EMPTY);
      setLoadError(isAuthenticated ? 'Nenhuma unidade selecionada.' : null);
      return;
    }
    setIsLoading(true);
    try {
      const [itemRows, movimentoRows] = await Promise.all([
        fetchAllPages((from, to) =>
          supabase
            .from('estoque_itens')
            .select('*')
            .eq('unit_id', activeUnitId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
        fetchAllPages((from, to) =>
          supabase
            .from('estoque_movimentos')
            .select('*')
            .eq('unit_id', activeUnitId)
            .order('data_movimento', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ]);
      if (version !== loadVersion.current) return; // resposta velha (outra unidade, outro recarregamento)
      const entradas: Entrada[] = [];
      const saidas: Saida[] = [];
      movimentoRows.forEach((row) => {
        const base = {
          id: String(row.id),
          itemId: String(row.item_id),
          quantidade: Number(row.quantidade ?? 0),
          atualizacao: text(row.updated_at),
          observacao: text(row.observacao),
          createdByName: text(row.created_by_name) || undefined,
        };
        if (row.tipo === 'SAIDA') {
          saidas.push({ ...base, tecnico: text(row.tecnico), dataSaida: text(row.data_movimento) });
        } else {
          entradas.push({ ...base, fornecedor: text(row.fornecedor), local: text(row.local), dataEntrada: text(row.data_movimento) });
        }
      });
      setState({ itens: itemRows.map(mapItem), entradas, saidas });
      setLoadError(null);
    } catch (error) {
      if (version !== loadVersion.current) return;
      console.error('Falha ao carregar o estoque:', error);
      setLoadError(estoqueErrorMessage(error, 'Não foi possível carregar o estoque.'));
    } finally {
      if (version === loadVersion.current) setIsLoading(false);
    }
  }, [activeUnitId, isAuthenticated]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Outro computador lançou ou editou: recarrega (com uma pequena espera para juntar várias mudanças seguidas).
  useEffect(() => {
    if (!isAuthenticated || !activeUnitId) return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void reload(), 400);
    };
    const channel = supabase
      .channel(`estoque-${activeUnitId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_itens', filter: `unit_id=eq.${activeUnitId}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_movimentos', filter: `unit_id=eq.${activeUnitId}` }, schedule)
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [activeUnitId, isAuthenticated, reload]);

  /** Executa a gravação e recarrega; devolve a mensagem de erro (ou null). */
  const run = useCallback(
    async (action: () => Promise<{ error: unknown } | void>, fallback?: string): Promise<EstoqueResult> => {
      try {
        const result = await action();
        if (result && result.error) return estoqueErrorMessage(result.error, fallback);
        await reload();
        return null;
      } catch (error) {
        return estoqueErrorMessage(error, fallback);
      }
    },
    [reload],
  );

  const findItem = useCallback(
    (produto: string, modelo: string) =>
      state.itens.find((item) => norm(item.produto) === norm(produto) && norm(item.modelo) === norm(modelo)),
    [state.itens],
  );

  /** Acha o item pelo produto + modelo ou cria um novo na unidade ativa (histórico de itens). */
  const findOrCreateItemId = useCallback(
    async (produto: string, modelo: string): Promise<string> => {
      const existing = findItem(produto, modelo);
      if (existing) return existing.id;
      const { data, error } = await supabase
        .from('estoque_itens')
        .insert({ unit_id: activeUnitId, produto: produto.trim(), modelo: modelo.trim() })
        .select('id')
        .single();
      if (error) {
        // Outro computador criou o mesmo item agora há pouco: usa o dele.
        if ((error as { code?: string }).code === '23505') {
          const { data: found, error: findError } = await supabase
            .from('estoque_itens')
            .select('id, produto, modelo')
            .eq('unit_id', activeUnitId);
          if (findError) throw findError;
          const match = (found ?? []).find(
            (row) => norm(String(row.produto)) === norm(produto) && norm(String(row.modelo)) === norm(modelo),
          );
          if (match) return String(match.id);
        }
        throw error;
      }
      return String((data as { id: string }).id);
    },
    [activeUnitId, findItem],
  );

  const addEntrada = useCallback(
    (input: EntradaInput) =>
      run(async () => {
        const itemId = await findOrCreateItemId(input.produto, input.modelo);
        return supabase.from('estoque_movimentos').insert({
          unit_id: activeUnitId,
          item_id: itemId,
          tipo: 'ENTRADA',
          quantidade: input.quantidade,
          fornecedor: input.fornecedor.trim() || null,
          local: input.local.trim(),
        });
      }),
    [activeUnitId, findOrCreateItemId, run],
  );

  const updateEntrada = useCallback(
    (id: string, input: EntradaInput) =>
      run(async () => {
        const itemId = await findOrCreateItemId(input.produto, input.modelo);
        // Só esta entrada muda; o banco recusa se o saldo de algum item ficar negativo.
        return supabase
          .from('estoque_movimentos')
          .update({
            item_id: itemId,
            quantidade: input.quantidade,
            fornecedor: input.fornecedor.trim() || null,
            local: input.local.trim(),
          })
          .eq('id', id);
      }),
    [findOrCreateItemId, run],
  );

  const addSaida = useCallback(
    (input: SaidaInput) => {
      // Item que nunca entrou não tem saldo: nem cria o item.
      if (!findItem(input.produto, input.modelo)) {
        return Promise.resolve<EstoqueResult>('Quantidade insuficiente em estoque. Saldo disponível: 0 unidades.');
      }
      return run(async () => {
        const itemId = await findOrCreateItemId(input.produto, input.modelo);
        return supabase.from('estoque_movimentos').insert({
          unit_id: activeUnitId,
          item_id: itemId,
          tipo: 'SAIDA',
          quantidade: input.quantidade,
          tecnico: input.tecnico.trim(),
        });
      });
    },
    [activeUnitId, findItem, findOrCreateItemId, run],
  );

  const updateSaida = useCallback(
    (id: string, input: SaidaInput) => {
      if (!findItem(input.produto, input.modelo)) {
        return Promise.resolve<EstoqueResult>('Quantidade insuficiente em estoque. Saldo disponível: 0 unidades.');
      }
      return run(async () => {
        const itemId = await findOrCreateItemId(input.produto, input.modelo);
        return supabase
          .from('estoque_movimentos')
          .update({ item_id: itemId, quantidade: input.quantidade, tecnico: input.tecnico.trim() })
          .eq('id', id);
      });
    },
    [findItem, findOrCreateItemId, run],
  );

  const removeMovimento = useCallback(
    (id: string) => run(async () => supabase.from('estoque_movimentos').delete().eq('id', id)),
    [run],
  );

  const setObservacao = useCallback(
    (id: string, observacao: string) =>
      run(async () => supabase.from('estoque_movimentos').update({ observacao: observacao.trim() }).eq('id', id)),
    [run],
  );

  const addItem = useCallback(
    (input: ItemInput) =>
      run(async () => {
        const existing = findItem(input.produto, input.modelo);
        if (existing) {
          return supabase
            .from('estoque_itens')
            .update({ quantidade_minima: input.quantidadeMinima ?? null })
            .eq('id', existing.id);
        }
        return supabase.from('estoque_itens').insert({
          unit_id: activeUnitId,
          produto: input.produto.trim(),
          modelo: input.modelo.trim(),
          quantidade_minima: input.quantidadeMinima ?? null,
        });
      }),
    [activeUnitId, findItem, run],
  );

  const updateItem = useCallback(
    (id: string, input: ItemInput) =>
      run(async () =>
        supabase
          .from('estoque_itens')
          .update({
            produto: input.produto.trim(),
            modelo: input.modelo.trim(),
            quantidade_minima: input.quantidadeMinima ?? null,
          })
          .eq('id', id),
      ),
    [run],
  );

  // Excluir o item apaga as entradas e saídas dele (cascata no banco; a tela pede confirmação).
  const removeItem = useCallback(
    (id: string) => run(async () => supabase.from('estoque_itens').delete().eq('id', id)),
    [run],
  );

  const value = useMemo<EstoqueContextType>(
    () => ({
      ...state,
      isLoading,
      loadError,
      reload,
      addEntrada,
      updateEntrada,
      removeEntrada: removeMovimento,
      setEntradaObservacao: setObservacao,
      addSaida,
      updateSaida,
      removeSaida: removeMovimento,
      setSaidaObservacao: setObservacao,
      addItem,
      updateItem,
      removeItem,
    }),
    [
      state,
      isLoading,
      loadError,
      reload,
      addEntrada,
      updateEntrada,
      removeMovimento,
      setObservacao,
      addSaida,
      updateSaida,
      addItem,
      updateItem,
      removeItem,
    ],
  );

  return <EstoqueContext.Provider value={value}>{children}</EstoqueContext.Provider>;
}
