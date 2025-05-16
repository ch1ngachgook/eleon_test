
'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToggleRight, ToggleLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChannelSwitchProps {
  id: string;
  label: string;
  isOn: boolean;
  onToggle: (isOn: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function ChannelSwitch({ id, label, isOn, onToggle, isLoading, disabled }: ChannelSwitchProps) {
  return (
    <div className={cn("flex items-center justify-between p-3 bg-muted rounded-lg", disabled && "opacity-50")}>
      <Label htmlFor={id} className="text-lg flex items-center">
        {isOn ? <ToggleRight className="mr-2 h-5 w-5 text-primary" /> : <ToggleLeft className="mr-2 h-5 w-5 text-gray-400" />}
        {label}
      </Label>
       <div className="flex items-center gap-2">
        {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>}
        <Switch
          id={id}
          checked={isOn}
          onCheckedChange={onToggle}
          disabled={isLoading || disabled}
          aria-label={`Toggle ${label}`}
        />
      </div>
    </div>
  );
}
