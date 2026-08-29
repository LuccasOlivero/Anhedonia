import { redirect } from 'next/navigation';

export default function NotificacionesPage() {
  redirect('/pet?modal=notificaciones');
}
