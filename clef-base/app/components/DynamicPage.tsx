'use client';

/**
 * DynamicPage — Resolves pages dynamically from DestinationCatalog at runtime.
 *
 * When a URL doesn't match any hardcoded route in the admin catchall, this
 * component looks up the path in DestinationCatalog. If a destination is
 * registered, it renders the appropriate ViewRenderer or LayoutRenderer
 * based on the destination's targetView.
 *
 * This enables creating pages from the frontend: registering a new
 * DestinationCatalog entry + View/Layout makes it instantly navigable
 * without redeployment.
 *
 * targetView conventions:
 * - Ends with "-list" or "list" → ViewRenderer with viewId = targetView
 * - "dashboard", "browser", or custom → LayoutRenderer with layoutId = targetView
 * - Contains "/" → interpreted as explicit "view:<id>" or "layout:<id>"
 */

import React, { useEffect, useState } from 'react';
import { useKernelInvoke } from '../../lib/clef-provider';
import { HostedPage } from './HostedPage';
import { ViewRenderer } from './ViewRenderer';
import { LayoutRenderer } from './LayoutRenderer';
import { EmptyState } from './widgets/EmptyState';

interface DynamicPageProps {
  slug: string[];
}

interface ResolvedDestination {
  destination: string;
  name: string;
  targetConcept: string;
  targetView: string;
  href: string;
}

type PageKind = 'view' | 'layout' | 'not-found' | 'loading';

const LIST_VIEW_ALIASES: Record<string, string> = {
  clips: 'clips-list',
  transcripts: 'transcripts-list',
  media: 'media-library',
  'process-specs': 'process-specs-list',
};

function resolvePageKind(destination: ResolvedDestination): { kind: 'view' | 'layout'; id: string } {
  const { name, targetView } = destination;

  // Explicit prefix: "view:my-view" or "layout:my-layout"
  if (targetView.startsWith('view:')) {
    return { kind: 'view', id: targetView.slice(5) };
  }
  if (targetView.startsWith('layout:')) {
    return { kind: 'layout', id: targetView.slice(7) };
  }

  // Convention-based: "list" suffix → view, otherwise → layout
  if (targetView === 'list') {
    return { kind: 'view', id: LIST_VIEW_ALIASES[name] ?? 'list' };
  }
  if (targetView.endsWith('-list')) {
    return { kind: 'view', id: targetView };
  }

  // Default to layout for dashboard-like pages, view for everything else
  const layoutKeywords = ['dashboard', 'browser', 'manager', 'editor', 'builder'];
  if (layoutKeywords.some(k => targetView.includes(k))) {
    return { kind: 'layout', id: targetView };
  }

  // Fallback: try as a view (most common for user-created pages)
  return { kind: 'view', id: targetView };
}

export const DynamicPage: React.FC<DynamicPageProps> = ({ slug }) => {
  const invoke = useKernelInvoke();
  const [pageKind, setPageKind] = useState<PageKind>('loading');
  const [pageId, setPageId] = useState<string>('');
  const [context, setContext] = useState<Record<string, string>>({});

  const href = `/admin/${slug.join('/')}`;

  useEffect(() => {
    let cancelled = false;

    invoke('DestinationCatalog', 'resolveByHref', { href })
      .then((result) => {
        if (cancelled) return;
        if (result.variant === 'ok') {
          const dest = result as unknown as ResolvedDestination;
          const resolved = resolvePageKind(dest);
          setPageKind(resolved.kind);
          setPageId(resolved.id);

          // Extract dynamic path segments as context variables.
          // If destination href is "/admin/reports" and actual path is
          // "/admin/reports/42", the remainder "42" becomes context.id.
          const destPath = dest.href.replace(/\/$/, '');
          const actualPath = href.replace(/\/$/, '');
          if (actualPath.length > destPath.length) {
            const remainder = actualPath.slice(destPath.length + 1);
            const segments = remainder.split('/');
            const ctx: Record<string, string> = {};
            if (segments[0]) ctx.id = decodeURIComponent(segments[0]);
            segments.forEach((seg, i) => {
              ctx[`param${i}`] = decodeURIComponent(seg);
            });
            setContext(ctx);
          }
        } else {
          setPageKind('not-found');
        }
      })
      .catch(() => {
        if (!cancelled) setPageKind('not-found');
      });

    return () => { cancelled = true; };
  }, [href, invoke]);

  if (pageKind === 'loading') {
    return (
      <HostedPage>
        <div className="page-header"><h1>Loading...</h1></div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Resolving page...</p>
      </HostedPage>
    );
  }

  if (pageKind === 'not-found') {
    return (
      <HostedPage>
        <EmptyState
          title="Page not found"
          description={`No page is registered at "${href}". Create one from the admin interface.`}
        />
      </HostedPage>
    );
  }

  if (pageKind === 'layout') {
    return (
      <HostedPage>
        <LayoutRenderer layoutId={pageId} context={context} />
      </HostedPage>
    );
  }

  return (
    <HostedPage>
      <ViewRenderer viewId={pageId} context={context} />
    </HostedPage>
  );
};

export default DynamicPage;
