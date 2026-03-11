import React from 'react';
import { LoginPanel } from './LoginPanel';

export function PublicSetupArticle(props: {
  title: string;
  body: string;
  adminUser: string;
}) {
  const paragraphs = props.body.split(/\n\s*\n/).filter(Boolean);

  return (
    <main className="setup-page">
      <article className="setup-article">
        <div className="setup-kicker">Clef Base</div>
        <h1>{props.title}</h1>
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <ol className="setup-steps">
          <li>Set `CLEF_BASE_ADMIN_USERNAME` and `CLEF_BASE_ADMIN_PASSWORD` before first boot.</li>
          <li>Optionally set `CLEF_BASE_PUBLIC_TITLE` and `CLEF_BASE_PUBLIC_BODY` to customize this article.</li>
          <li>Set `KV_REST_API_URL` and `KV_REST_API_TOKEN` if you want persistent identity storage.</li>
          <li>Sign in, then open Access to add editors, viewers, and custom permissions.</li>
        </ol>
      </article>
      <LoginPanel defaultUser={props.adminUser} />
    </main>
  );
}
