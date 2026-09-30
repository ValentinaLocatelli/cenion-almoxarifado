export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  );

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/** Normaliza texto para comparação: sem acentos, minúsculo, sem espaços nas pontas. */
export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/** Primeiro nome (primeira palavra) de um produto. */
export const firstName = (produto: string) => produto.trim().split(/\s+/)[0] ?? '';
