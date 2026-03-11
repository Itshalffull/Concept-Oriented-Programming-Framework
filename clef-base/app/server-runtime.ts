import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function getCookieStore() {
  return cookies();
}

export function navigate(path: string): never {
  redirect(path);
}
