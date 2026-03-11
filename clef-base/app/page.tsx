import { redirect } from 'next/navigation';
import { getCurrentAdminSession } from '../lib/auth';
import { ADMIN_PERMISSION } from '../lib/identity';
import { getPublicArticleContent } from '../lib/identity';
import { PublicSetupArticle } from './components/PublicSetupArticle';

export default async function LandingPage() {
  const session = await getCurrentAdminSession();
  if (session?.permissions.includes(ADMIN_PERMISSION)) {
    redirect('/admin');
  }

  return <PublicSetupArticle {...getPublicArticleContent()} />;
}
