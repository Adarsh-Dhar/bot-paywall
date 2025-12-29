// /app/sign-in/page.tsx
import React, { Suspense } from 'react';
import SignInClient from '@/components/SignInClient';

export default function SignInPage() {
  return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <SignInClient />
      </Suspense>
  );
}
