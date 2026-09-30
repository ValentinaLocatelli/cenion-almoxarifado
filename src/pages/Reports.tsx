import { FileBarChart2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function Reports() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Relatório"
        description="Tela ainda não implementada."
      />

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <FileBarChart2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Em breve</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Esta tela será preenchida em uma próxima etapa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
