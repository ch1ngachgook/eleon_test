'use client';

import React, { type ReactNode, useEffect, useState } from 'react';

// This component can be used to wrap your application with client-side providers
// For now, Zustand store is initialized and used directly via hooks,
// but if other providers are needed (e.g., for theming, advanced state management scenarios),
// they can be added here.

export default function AppProviders({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // This helps avoid hydration mismatches if any provider relies on browser-specific APIs initially.
  // For Zustand, it's generally not an issue unless you're doing complex SSR with it.
  if (!isMounted) {
    // You could return a loading skeleton here if providers cause flicker/mismatch
    return null; 
  }
  
  return <>{children}</>;
}
