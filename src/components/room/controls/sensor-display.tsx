
'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SensorDisplayProps {
  label: string;
  value: string | number;
  unit?: string;
  IconComponent: LucideIcon;
  iconClassName?: string;
  isLoading?: boolean;
}

export default function SensorDisplay({ label, value, unit, IconComponent, iconClassName, isLoading }: SensorDisplayProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-lg">
      <span className="flex items-center">
        <IconComponent className={cn("mr-2 h-5 w-5", iconClassName)} /> {label}:
      </span>
      {isLoading ? (
         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
      ) : (
        <span>{value}{unit}</span>
      )}
    </div>
  );
}
