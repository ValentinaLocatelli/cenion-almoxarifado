import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ObservacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  /** Grava no banco; devolve a mensagem de erro (ou null). Com erro, o diálogo fica aberto com o texto digitado. */
  onSave: (value: string) => Promise<string | null>;
}

function Body({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      setError(await onSave(text.trim()));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        placeholder="Escreva uma observação"
        rows={5}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ObservacaoDialog({ open, onOpenChange, value, onSave }: ObservacaoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Observação</DialogTitle>
        </DialogHeader>
        <Body
          value={value}
          onCancel={() => onOpenChange(false)}
          onSave={async (text) => {
            const error = await onSave(text);
            if (!error) onOpenChange(false);
            return error;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
