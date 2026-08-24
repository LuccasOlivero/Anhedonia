'use client';

import { useEffect, useState } from 'react';

export function EntryTime({ iso }: { iso: string }) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    setFormatted(new Date(iso).toLocaleString());
  }, [iso]);

  return <time dateTime={iso}>{formatted ?? ''}</time>;
}
