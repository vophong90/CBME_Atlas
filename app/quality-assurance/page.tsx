import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function QARedirect() {
  // Trang QA mặc định chuyển tới Surveys
  redirect('/quality-assurance/surveys');
}
