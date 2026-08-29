import { redirect } from 'next/navigation';

export default function TiendaPage() {
  redirect('/pet?modal=tienda');
}
