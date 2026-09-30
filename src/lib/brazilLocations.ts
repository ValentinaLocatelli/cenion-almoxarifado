export interface BrazilianState {
  code: string;
  name: string;
}

export const BRAZILIAN_STATES: BrazilianState[] = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapa' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceara' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espirito Santo' },
  { code: 'GO', name: 'Goias' },
  { code: 'MA', name: 'Maranhao' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Para' },
  { code: 'PB', name: 'Paraiba' },
  { code: 'PR', name: 'Parana' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piaui' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondonia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'Sao Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
];

interface IbgeCityRow {
  nome?: string;
}

export async function fetchCitiesByState(stateCode: string): Promise<string[]> {
  const uf = stateCode.trim().toUpperCase();
  if (!uf) return [];

  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
  );

  if (!response.ok) {
    throw new Error('Falha ao carregar cidades para o estado selecionado.');
  }

  const rows = (await response.json()) as IbgeCityRow[];
  return rows
    .map((row) => String(row.nome ?? '').trim())
    .filter((name) => name.length > 0);
}
