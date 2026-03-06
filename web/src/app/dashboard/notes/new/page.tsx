import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { TopBar } from '@/components/TopBar';
import { NoteGenerationForm } from '@/components/notes';

export default async function NewNotePage() {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  return (
    <>
      <TopBar title="New Note" backHref="/dashboard" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-6">
        <NoteGenerationForm />
      </main>
    </>
  );
}
