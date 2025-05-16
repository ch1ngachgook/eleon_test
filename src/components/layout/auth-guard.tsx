
'use client';

import React, { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useHotelStore } from '@/store/useStore';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthGuardProps {
  children: ReactNode;
  requiredRole?: 'guest' | 'admin';
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { user } = useHotelStore();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    // Zustand persistence might take a moment to rehydrate on client
    const unsubscribe = useHotelStore.subscribe(
      (state) => {
        if (state.user.email !== undefined) { // Check if hydration is complete
          setIsLoading(false);
          if (!state.user.email) {
            router.replace('/login');
          } else if (requiredRole && state.user.role !== requiredRole) {
            // If role is required and doesn't match, redirect (e.g. guest trying to access admin)
             // For simplicity, redirect to home. A more robust app might have a specific "access denied" page.
            router.replace('/');
          }
        }
      }
    );
    
    // Initial check
    if (user.email !== undefined) { // Check if hydration is complete
      setIsLoading(false);
      if (!user.email) {
        router.replace('/login');
      } else if (requiredRole && user.role !== requiredRole) {
        router.replace('/');
      }
    }


    return () => unsubscribe();
  }, [user, requiredRole, router]);

  if (isLoading || !user.email || (requiredRole && user.role !== requiredRole)) {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <Skeleton className="h-12 w-1/2 mb-4" />
        <Skeleton className="h-8 w-1/3 mb-2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
