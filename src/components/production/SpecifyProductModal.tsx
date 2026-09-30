import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCTION_CHARGE_CONNECTOR_MODELS, type ProductionProductSpecification, type ProductionYesNo } from '@/types/production';

interface SpecifyProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: ProductionProductSpecification;
  onSave: (spec: ProductionProductSpecification) => Promise<void> | void;
  isSaving?: boolean;
}

const emptyForm = () => ({
  capacityAh: '', voltageV: '', chargeConnector: '' as ProductionYesNo | '', chargeConnectorModel: '',
  dischargeConnector: '' as ProductionYesNo | '', liftCutoff: '' as ProductionYesNo | '', cableLengthM: '',
  canCommunication: '' as ProductionYesNo | '', chargerModel: '', bmsModel: '' as 'DALY' | 'UDAN' | '', weightKg: '',
  bridge: '' as ProductionYesNo | '', bridgeConnectorType: '',
});

export function SpecifyProductModal({ open, onOpenChange, initialValue, onSave, isSaving }: SpecifyProductModalProps) {
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (!open) return;
    if (!initialValue) { setForm(emptyForm()); return; }
    setForm({
      capacityAh: initialValue.capacityAh ?? '', voltageV: initialValue.voltageV ?? '',
      chargeConnector: initialValue.chargeConnector ?? '', chargeConnectorModel: initialValue.chargeConnectorModel ?? '',
      dischargeConnector: initialValue.dischargeConnector ?? '', liftCutoff: initialValue.liftCutoff ?? '',
      cableLengthM: initialValue.cableLengthM ?? '', canCommunication: initialValue.canCommunication ?? '',
      chargerModel: initialValue.chargerModel ?? '', bmsModel: initialValue.bmsModel ?? '', weightKg: initialValue.weightKg ?? '',
      bridge: initialValue.bridge ?? '', bridgeConnectorType: initialValue.bridgeConnectorType ?? '',
    });
  }, [open, initialValue]);

  const set = (key: keyof ReturnType<typeof emptyForm>, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const yesNo = (value: ProductionYesNo | '') => value === 'YES' ? 'Sim' : value === 'NO' ? 'Não' : '';

  const isValid = Boolean(
    form.capacityAh.trim() && form.voltageV.trim() && form.chargeConnector &&
    form.dischargeConnector && form.liftCutoff && form.chargerModel.trim() && form.bmsModel && form.bridge &&
    (form.chargeConnector !== 'YES' || form.chargeConnectorModel) &&
    (form.bridge !== 'YES' || form.bridgeConnectorType.trim())
  );

  const handleSubmit = async () => {
    if (!isValid) return;
    await onSave({
      capacityAh: form.capacityAh.trim(), voltageV: form.voltageV.trim(),
      chargeConnector: form.chargeConnector as ProductionYesNo,
      chargeConnectorModel: form.chargeConnector === 'YES' ? form.chargeConnectorModel : undefined,
      dischargeConnector: form.dischargeConnector as ProductionYesNo,
      liftCutoff: form.liftCutoff as ProductionYesNo, cableLengthM: form.cableLengthM.trim() || undefined,
      canCommunication: form.canCommunication || undefined, chargerModel: form.chargerModel.trim(),
      bmsModel: form.bmsModel as 'DALY' | 'UDAN', weightKg: form.weightKg.trim() || undefined,
      bridge: form.bridge as ProductionYesNo, bridgeConnectorType: form.bridge === 'YES' ? form.bridgeConnectorType.trim() : undefined,
    });
  };

  const renderYesNo = (label: string, key: 'chargeConnector'|'dischargeConnector'|'liftCutoff'|'canCommunication'|'bridge', required: boolean) => (
    <div className="space-y-2">
      <Label>{label} {required ? '*' : ''}</Label>
      <Select value={form[key]} onValueChange={(v) => set(key, v)}>
        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent><SelectItem value="YES">Sim</SelectItem><SelectItem value="NO">Não</SelectItem></SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Especificar produto</DialogTitle>
          <DialogDescription>Informe as especificações do produto. Campos marcados com * são obrigatórios.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Capacidade (AH) *</Label><Input value={form.capacityAh} onChange={e => set('capacityAh', e.target.value)} placeholder="Ex: 100" /></div>
            <div className="space-y-2"><Label>Tensão (V) *</Label><Input value={form.voltageV} onChange={e => set('voltageV', e.target.value)} placeholder="Ex: 48" /></div>
          </div>

          {renderYesNo('Conector Carga', 'chargeConnector', true)}
          {form.chargeConnector === 'YES' && (
            <div className="space-y-2"><Label>Modelo do Conector de Carga *</Label><Select value={form.chargeConnectorModel} onValueChange={v => set('chargeConnectorModel', v)}><SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger><SelectContent>{PRODUCTION_CHARGE_CONNECTOR_MODELS.map(model => <SelectItem key={model} value={model}>{model}</SelectItem>)}</SelectContent></Select></div>
          )}

          {renderYesNo('Conector Descarga', 'dischargeConnector', true)}
          {renderYesNo('Corte de Elevação', 'liftCutoff', true)}

          <div className="space-y-2"><Label>Metro do Cabo</Label><Input value={form.cableLengthM} onChange={e => set('cableLengthM', e.target.value)} placeholder="Opcional" /></div>
          {renderYesNo('Comunicação CAN', 'canCommunication', false)}
          <div className="space-y-2"><Label>Modelo do Carregador *</Label><Input value={form.chargerModel} onChange={e => set('chargerModel', e.target.value)} /></div>
          <div className="space-y-2"><Label>Modelo do BMS *</Label><Select value={form.bmsModel} onValueChange={v => set('bmsModel', v)}><SelectTrigger><SelectValue placeholder="Selecione Daly ou Udan" /></SelectTrigger><SelectContent><SelectItem value="DALY">Daly</SelectItem><SelectItem value="UDAN">Udan</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Peso</Label><Input value={form.weightKg} onChange={e => set('weightKg', e.target.value)} placeholder="Opcional" /></div>

          {renderYesNo('Ponte', 'bridge', true)}
          {form.bridge === 'YES' && <div className="space-y-2"><Label>Tipo de Conector *</Label><Input value={form.bridgeConnectorType} onChange={e => set('bridgeConnectorType', e.target.value)} /></div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} disabled={!isValid || isSaving}>{isSaving ? 'Salvando...' : 'Salvar especificação'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
