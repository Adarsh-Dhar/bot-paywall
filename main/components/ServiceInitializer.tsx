'use client';

import { useEffect } from 'react';
import { botCleanupService } from '@/lib/bot-cleanup';

export default function ServiceInitializer() {
  useEffect(() => {
    // Initialize cleanup service on client side
    botCleanupService.start();
    
    return () => {
      // Cleanup on unmount (though this rarely happens in practice)
      botCleanupService.stop();
    };
  }, []);

  return null; // This component doesn't render anything
}