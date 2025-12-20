'use client';

import { useEffect, useState } from 'react';
import { startBotPaymentSystem, stopBotPaymentSystem, getBotPaymentSystemStatus } from '@/lib/automated-bot-payment-system';

export default function ServiceInitializer() {
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeServices = async () => {
      try {
        // Start the automated bot payment system (replaces bot cleanup service)
        await startBotPaymentSystem({
          enableConsoleLogging: true,
          enableFileLogging: false,
          cleanupDelayMs: 60000, // 60 seconds
          monitoringCheckInterval: 5000, // 5 seconds
          configuredClientIP: '210.212.2.133' // Use the specific client IP
        });

        if (mounted) {
          console.log('✅ Automated bot payment system initialized successfully');
          setInitializationError(null);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Failed to initialize automated bot payment system:', error);
        
        if (mounted) {
          setInitializationError(errorMessage);
        }

        // Attempt recovery after a delay
        setTimeout(() => {
          if (mounted) {
            console.log('🔄 Attempting to recover bot payment system...');
            initializeServices();
          }
        }, 5000);
      }
    };

    // Initialize services
    initializeServices();
    
    return () => {
      mounted = false;
      // Graceful cleanup on unmount (though this rarely happens in practice)
      stopBotPaymentSystem().catch(error => {
        console.error('Error during bot payment system shutdown:', error);
      });
    };
  }, []);

  // Log initialization errors for debugging (in development)
  useEffect(() => {
    if (initializationError && process.env.NODE_ENV === 'development') {
      console.error('ServiceInitializer Error:', initializationError);
    }
  }, [initializationError]);

  return null; // This component doesn't render anything
}