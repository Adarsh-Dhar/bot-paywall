// /app/sign-up/page.tsx
import React, { Suspense } from 'react';
import SignUpClient from '@/components/SignUpClient';

export default function SignUpPage() {
  return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <SignUpClient />
      </Suspense>
  );
}
