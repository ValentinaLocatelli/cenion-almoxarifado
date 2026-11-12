import { Button } from '@/components/ui/button';
import { useEstoque } from '@/contexts/useEstoque';

/** Aviso de carregamento ou de falha ao ler o estoque do banco (sem conexão, tabelas ausentes, sem permissão...). */
export function EstoqueStatus() {
  const { isLoading, loadError, reload } = useEstoque();

  if (loadError) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
      >
        <span>{loadError}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando estoque...</p>;
  }

  return null;
}
