'use client';

import { use } from 'react';
import { redirect } from 'next/navigation';

export default function ScreeningResultRedirectPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const resolvedParams = use(params);
  redirect(`/screening/${resolvedParams.caseId}`);
}
