import { Suspense } from 'react';
import TargetingClient from './TargetingClient';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function TargetingPage({
  searchParams,
}: {
  searchParams: Promise<{ surveyId?: string }>;
}) {
  const sp = await searchParams;
  const preSurveyId = (sp?.surveyId ?? '').toString();

  return (
    <Suspense fallback={<div className="p-6">Đang tải trang mời khảo sát…</div>}>
      <TargetingClient preSurveyId={preSurveyId} />
    </Suspense>
  );
}
