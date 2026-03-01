'use client';

import {
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
} from 'react';

// ---------------------------------------------------------------------------
// Breadcrumb — Hierarchical navigation trail.
// Derived from breadcrumb.widget spec.
// ---------------------------------------------------------------------------

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  onNavigate?: (href: string) => void;
  variant?: string;
  size?: string;
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(
  function Breadcrumb(
    {
      items,
      separator = '/',
      onNavigate,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label="Breadcrumb"
        className={className}
        data-surface-widget=""
        data-widget-name="breadcrumb"
        data-part="root"
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        <ol
          role="list"
          data-part="list"
          style={{ listStyle: 'none', display: 'flex', margin: 0, padding: 0 }}
        >
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li
                key={`${item.label}-${index}`}
                role="listitem"
                data-part="item"
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {isLast ? (
                  <span
                    aria-current="page"
                    data-part="current-page"
                  >
                    {item.label}
                  </span>
                ) : (
                  <>
                    <a
                      href={item.href}
                      aria-current="false"
                      data-part="link"
                      onClick={(e) => {
                        if (onNavigate && item.href) {
                          e.preventDefault();
                          onNavigate(item.href);
                        }
                      }}
                    >
                      {item.label}
                    </a>
                    <span
                      aria-hidden="true"
                      data-part="separator"
                    >
                      {separator}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }
);

Breadcrumb.displayName = 'Breadcrumb';
export default Breadcrumb;
