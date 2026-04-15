import { redirect } from 'next/navigation';

export default function AdminPage() {
  const today = new Date().toISOString().slice(0, 10);
  redirect(`/admin/daily/${today}`);
}
