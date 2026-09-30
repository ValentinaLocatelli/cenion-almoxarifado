/**
 * Categorias padrão de diagnóstico + termos/expressões associadas.
 *
 * Esta é a ÚNICA lista que precisa ser editada para ensinar o classificador
 * a reconhecer um novo padrão de diagnóstico ou um novo sinônimo de um
 * padrão já existente. Nenhuma outra parte do sistema deve conter regras
 * de classificação "hardcoded" — tudo passa por esta lista.
 *
 * Como adicionar:
 *  - Novo sinônimo de uma categoria existente: adicione a string em `terms`.
 *  - Nova categoria: adicione um novo objeto ao array, com um `id` estável
 *    (nunca reutilize/mude um `id` já usado, pois ele é a chave de
 *    agregação dos relatórios já gerados).
 *
 * Os termos podem ser digitados com ou sem acento e em qualquer caixa —
 * o classificador normaliza tudo (minúsculas, sem acentos) antes de
 * comparar. Prefira termos/expressões específicas o suficiente para não
 * gerar falsos positivos (ex.: "sujeira interna" em vez de só "sujeira").
 */

export interface DiagnosisCategoryDefinition {
  /** Identificador estável (não muda entre versões). Usado como chave de agregação. */
  id: string;
  /** Nome exibido nos relatórios. */
  label: string;
  /** Termos/expressões que, se encontrados no texto (fora de contexto de negação), classificam nessa categoria. */
  terms: string[];
}

export const DIAGNOSIS_CATEGORIES: DiagnosisCategoryDefinition[] = [
  {
    id: 'DESCARGA_PROFUNDA',
    label: 'Descarga profunda',
    terms: [
      'descarga profunda',
      'totalmente descarregado',
      'totalmente descarregada',
      'descarga excessiva',
      'descarga acentuada',
      'baixa carga',
      'tensao muito baixa causada por descarga',
      'tensao muito baixa devido a descarga',
      'chegou descarregado',
      'chegou descarregada',
      'equipamento descarregado',
    ],
  },
  {
    id: 'UMIDADE',
    label: 'Umidade',
    terms: ['umidade', 'umido', 'umida', 'presenca de agua', 'condensacao', 'umidade interna'],
  },
  {
    id: 'SUJEIRA_INTERNA',
    label: 'Sujeira interna',
    terms: ['sujeira interna', 'acumulo de sujeira', 'contaminado', 'contaminada', 'contaminacao', 'residuos'],
  },
  {
    id: 'DESBALANCEAMENTO',
    label: 'Desbalanceamento',
    terms: ['desbalanceamento', 'celulas desbalanceadas', 'desequilibrio'],
  },
  {
    id: 'OXIDACAO',
    label: 'Oxidação',
    terms: ['oxidado', 'oxidada', 'oxidacao', 'corrosao', 'corrosao nos terminais'],
  },
  {
    id: 'SOBREAQUECIMENTO',
    label: 'Sobreaquecimento',
    terms: ['superaquecimento', 'sobreaquecimento', 'temperatura elevada', 'aquecimento excessivo'],
  },
  {
    id: 'VAZAMENTO',
    label: 'Vazamento',
    terms: ['vazamento', 'vazando', 'eletrolito', 'perda de eletrolito'],
  },
  {
    id: 'DANOS_FISICOS',
    label: 'Danos físicos',
    terms: ['trinca', 'trincado', 'quebrado', 'quebrada', 'amassado', 'amassada', 'dano fisico', 'carcaca danificada', 'estrutura danificada'],
  },
  {
    id: 'BAIXA_TENSAO',
    label: 'Baixa tensão',
    terms: ['baixa tensao', 'tensao insuficiente', 'tensao abaixo do esperado'],
  },
  {
    id: 'FALHA_ELETRICA',
    label: 'Falha elétrica',
    terms: ['falha eletrica', 'defeito eletrico', 'curto', 'curto-circuito', 'curto circuito'],
  },
  {
    id: 'FALHA_CARREGAMENTO',
    label: 'Falha de carregamento',
    terms: ['nao carrega', 'falha no carregamento', 'nao aceita carga'],
  },
  {
    id: 'PROBLEMA_CONEXAO',
    label: 'Problema de conexão',
    terms: ['mau contato', 'conexao defeituosa', 'terminal solto'],
  },
  {
    id: 'TERMINAIS_DANIFICADOS',
    label: 'Terminais danificados',
    terms: ['terminal danificado', 'borne danificado'],
  },
  {
    id: 'CABOS_DANIFICADOS',
    label: 'Cabos danificados',
    terms: ['cabo danificado', 'fio rompido', 'cabo rompido', 'fio queimado', 'cabo queimado'],
  },
  {
    id: 'VENTILACAO',
    label: 'Ventilação',
    terms: ['ventilacao obstruida', 'ventilador com problema', 'ventilador com defeito'],
  },
  {
    id: 'RUIDO_VIBRACAO',
    label: 'Ruído/vibração',
    terms: ['ruido anormal', 'barulho anormal', 'vibracao anormal'],
  },
  {
    id: 'COMPONENTE_QUEIMADO',
    label: 'Componente queimado',
    terms: ['componente queimado', 'placa queimada'],
  },
  {
    id: 'FALHA_COMUNICACAO',
    label: 'Falha de comunicação',
    terms: ['erro de comunicacao', 'falha de comunicacao'],
  },
  {
    id: 'MANUTENCAO_INADEQUADA',
    label: 'Manutenção inadequada',
    terms: ['falta de manutencao', 'manutencao atrasada', 'manutencao inadequada'],
  },
  {
    id: 'DESGASTE',
    label: 'Desgaste',
    terms: ['desgaste excessivo', 'desgaste natural', 'desgaste'],
  },
];

/** Categoria de fallback: usada quando há diagnóstico mas nenhuma categoria acima reconhece o texto. */
export const OTHER_CATEGORY: DiagnosisCategoryDefinition = {
  id: 'OUTROS',
  label: 'Defeito nos módulos',
  terms: [],
};
