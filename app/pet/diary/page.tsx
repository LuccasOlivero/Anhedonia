import { redirect } from 'next/navigation';

export default function DiaryPage() {
  redirect('/pet?modal=diario');
}
