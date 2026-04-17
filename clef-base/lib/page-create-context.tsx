'use client';

/**
 * PageCreateContext — lets a page surface signal that it already provides
 * a "Create X" affordance so the global FAB can suppress itself.
 *
 * Usage:
 *   - Provider: wrap content in <PageCreateProvider hasCreate>
 *   - Consumer: call usePageHasCreate() to know whether to hide the FAB
 *
 * ViewRenderer mounts this provider whenever controls.create is active.
 * QuickCapture reads it to hide the FAB, avoiding duplicate create affordances.
 */

import React, { createContext, useContext } from 'react';

const PageCreateContext = createContext<boolean>(false);

export const PageCreateProvider: React.FC<{
  hasCreate: boolean;
  children: React.ReactNode;
}> = ({ hasCreate, children }) => (
  <PageCreateContext.Provider value={hasCreate}>
    {children}
  </PageCreateContext.Provider>
);

/** Returns true when the current page already exposes a create action. */
export function usePageHasCreate(): boolean {
  return useContext(PageCreateContext);
}
