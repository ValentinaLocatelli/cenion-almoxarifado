export interface Item {
  id: string;
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
}

export interface Saida {
  id: string;
  itemId: string;
  tecnico: string;
  quantidade: number;
  dataSaida: string;
  atualizacao: string;
  observacao: string;
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
