import { Suspense } from 'react';
import TargetingClient from './TargetingClient';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function TargetingPage({
  searchParams,
}: {
  searchParams?: { surveyId?: string };
}) {
  const preSurveyId = (searchParams?.surveyId ?? '').toString();

  return (
    <Suspense fallback={<div className="p-6">Đang tải trang mời khảo sát…</div>}>
      <TargetingClient preSurveyId={preSurveyId} />
    </Suspense>
  );
}
