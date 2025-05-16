
'use client';

import { Button } from '@/components/ui/button';
import { Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DoorControlButtonProps {
  isLocked: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function DoorControlButton({ isLocked, onToggle, isLoading, disabled }: DoorControlButtonProps) {
  return (
    <Button 
      onClick={onToggle} 
      className={cn("w-full", disabled && "opacity-50")}
      variant="outline" 
      size="lg"
      disabled={isLoading || disabled}
    >
      {isLoading ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
      ) : isLocked ? (
        <Unlock className="mr-2 h-5 w-5" />
      ) : (
        <Lock className="mr-2 h-5 w-5" />
      )}
      {isLoading ? 'Processing...' : (isLocked ? 'Открыть дверь' : 'Закрыть дверь')}
    </Button>
  );
}
