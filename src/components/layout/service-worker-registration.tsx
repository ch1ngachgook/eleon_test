'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function ServiceWorkerRegistration() {
  const { toast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
          
          // Optional: Listen for updates to the service worker
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content is available and will be used when all tabs for this scope are closed.
                    // Or, prompt user to update.
                    console.log('New content is available and will be used when all tabs for this scope are closed.');
                    toast({
                      title: "Update Available",
                      description: "A new version of HotelKey is available. Close all tabs or refresh to update.",
                      duration: 10000,
                    });
                  } else {
                    // Content is cached for offline use.
                    console.log('Content is cached for offline use.');
                     toast({
                      title: "App Ready for Offline Use",
                      description: "HotelKey is now cached and can be used offline.",
                    });
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, [toast]);

  return null; // This component doesn't render anything
}
