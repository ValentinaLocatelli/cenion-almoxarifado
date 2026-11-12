// Estoque do almoxarifado: tabelas estoque_itens e estoque_movimentos (supabase/add_estoque.sql no cenion-os-management).
// Datas em ISO (texto), como as telas já usavam.

export interface Item {
  id: string;
  unitId: string;
  produto: string;
  modelo: string;
  /** Quantidade mínima em estoque; abaixo ou igual a ela o item entra em emergência. */
  quantidadeMinima?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Entrada {
  id: string;
  itemId: string;
  fornecedor: string;
  local: string;
  quantidade: number;
  dataEntrada: string;
  atualizacao: string;
  observacao: string;
  /** Quem lançou (gravado pelo servidor). */
  createdByName?: string;
}

export interface Saida {
  id: string;
  itemId: string;
  tecnico: string;
  quantidade: number;
  dataSaida: string;
  atualizacao: string;
  observacao: string;
  /** Quem lançou (gravado pelo servidor). */
  createdByName?: string;
}

export interface EntradaInput {
  produto: string;
  modelo: string;
  fornecedor: string;
  local: string;
  quantidade: number;
}

export interface SaidaInput {
  produto: string;
  modelo: string;
  tecnico: string;
  quantidade: number;
}

export interface ItemInput {
  produto: string;
  modelo: string;
  quantidadeMinima?: number;
}

/** Resultado de uma gravação: `null` = deu certo; texto = mensagem de erro para mostrar ao usuário. */
export type EstoqueResult = string | null;
