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
  onSave: (value: string) => void;
}

function Body({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value);
  return (
    <>
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Escreva uma observação"
        rows={5}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => onSave(text.trim())}>
          Salvar
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
          onSave={(text) => {
            onSave(text);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
