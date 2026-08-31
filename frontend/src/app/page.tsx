import { redirect } from 'next/navigation';

/**
 * The console has no marketing surface — the root sends the officer to the
 * dashboard, and the authenticated layout bounces them to `/login` if there is
 * no session.
 */
export default function RootPage() {
  redirect('/dashboard');
}
