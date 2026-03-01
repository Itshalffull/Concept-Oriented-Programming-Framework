// PlatformAdapter — Platform abstraction layer: register adapters for specific
// platforms, translate navigation transitions, map layout zones, and handle
// platform-native events through a unified adapter interface.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PlatformAdapterStorage,
  PlatformAdapterRegisterInput,
  PlatformAdapterRegisterOutput,
  PlatformAdapterMapNavigationInput,
  PlatformAdapterMapNavigationOutput,
  PlatformAdapterMapZoneInput,
  PlatformAdapterMapZoneOutput,
  PlatformAdapterHandlePlatformEventInput,
  PlatformAdapterHandlePlatformEventOutput,
} from './types.js';

import {
  registerOk,
  registerDuplicate,
  mapNavigationOk,
  mapNavigationUnsupported,
  mapZoneOk,
  mapZoneUnmapped,
  handlePlatformEventOk,
  handlePlatformEventIgnored,
} from './types.js';

export interface PlatformAdapterError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): PlatformAdapterError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface PlatformAdapterHandler {
  readonly register: (
    input: PlatformAdapterRegisterInput,
    storage: PlatformAdapterStorage,
  ) => TE.TaskEither<PlatformAdapterError, PlatformAdapterRegisterOutput>;
  readonly mapNavigation: (
    input: PlatformAdapterMapNavigationInput,
    storage: PlatformAdapterStorage,
  ) => TE.TaskEither<PlatformAdapterError, PlatformAdapterMapNavigationOutput>;
  readonly mapZone: (
    input: PlatformAdapterMapZoneInput,
    storage: PlatformAdapterStorage,
  ) => TE.TaskEither<PlatformAdapterError, PlatformAdapterMapZoneOutput>;
  readonly handlePlatformEvent: (
    input: PlatformAdapterHandlePlatformEventInput,
    storage: PlatformAdapterStorage,
  ) => TE.TaskEither<PlatformAdapterError, PlatformAdapterHandlePlatformEventOutput>;
}

// --- Implementation ---

const navigationMappings: Record<string, Record<string, string>> = {
  nextjs: { push: 'router.push', replace: 'router.replace', back: 'router.back', modal: 'router.push(path, { scroll: false })' },
  react: { push: 'navigate(path)', replace: 'navigate(path, { replace: true })', back: 'navigate(-1)', modal: 'openModal(path)' },
  swift: { push: 'pushViewController', replace: 'setViewControllers', back: 'popViewController', modal: 'present(vc, animated: true)' },
};

const zoneMappings: Record<string, Record<string, string>> = {
  nextjs: { header: '{"component":"Header","slot":"app/layout"}', sidebar: '{"component":"Sidebar","slot":"app/layout"}', main: '{"component":"Main","slot":"app/page"}', footer: '{"component":"Footer","slot":"app/layout"}' },
  react: { header: '{"component":"AppBar","position":"fixed"}', sidebar: '{"component":"Drawer","variant":"permanent"}', main: '{"component":"Container","maxWidth":"lg"}', footer: '{"component":"Footer","position":"static"}' },
  swift: { header: '{"view":"NavigationBar"}', sidebar: '{"view":"SidebarViewController"}', main: '{"view":"ContentViewController"}', footer: '{"view":"TabBar"}' },
};

const eventMappings: Record<string, Record<string, string>> = {
  nextjs: { routeChange: 'onRouteChange', prefetch: 'onPrefetch', error: 'onError' },
  react: { mount: 'onComponentMount', unmount: 'onComponentUnmount', error: 'onErrorBoundary' },
  swift: { viewDidAppear: 'onAppear', viewDidDisappear: 'onDisappear', memoryWarning: 'onMemoryWarning' },
};

export const platformAdapterHandler: PlatformAdapterHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('platform_adapters', input.adapter),
        mkError('STORAGE_READ'),
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('platform_adapters', input.adapter, {
                    adapter: input.adapter,
                    platform: input.platform,
                    config: input.config,
                    registeredAt: new Date().toISOString(),
                  });
                  return registerOk(input.adapter);
                },
                mkError('REGISTER_FAILED'),
              ),
            () =>
              TE.right(
                registerDuplicate(`Adapter '${input.adapter}' already registered`),
              ),
          ),
        ),
      ),
    ),

  mapNavigation: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('platform_adapters', input.adapter),
        mkError('STORAGE_READ'),
      ),
      TE.chain((adapterRecord) =>
        pipe(
          O.fromNullable(adapterRecord),
          O.fold(
            () =>
              TE.right(
                mapNavigationUnsupported(`Adapter '${input.adapter}' not registered`),
              ),
            (found) => {
              const platform = String(found.platform);
              const platformActions = navigationMappings[platform] ?? {};
              const action = platformActions[input.transition];
              return action
                ? TE.right(mapNavigationOk(input.adapter, action))
                : TE.right(mapNavigationUnsupported(`Transition '${input.transition}' not supported on platform '${platform}'`));
            },
          ),
        ),
      ),
    ),

  mapZone: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('platform_adapters', input.adapter),
        mkError('STORAGE_READ'),
      ),
      TE.chain((adapterRecord) =>
        pipe(
          O.fromNullable(adapterRecord),
          O.fold(
            () =>
              TE.right(
                mapZoneUnmapped(`Adapter '${input.adapter}' not registered`),
              ),
            (found) => {
              const platform = String(found.platform);
              const platformZones = zoneMappings[platform] ?? {};
              const config = platformZones[input.role];
              return config
                ? TE.right(mapZoneOk(input.adapter, config))
                : TE.right(mapZoneUnmapped(`Zone role '${input.role}' unmapped on platform '${platform}'`));
            },
          ),
        ),
      ),
    ),

  handlePlatformEvent: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('platform_adapters', input.adapter),
        mkError('STORAGE_READ'),
      ),
      TE.chain((adapterRecord) =>
        pipe(
          O.fromNullable(adapterRecord),
          O.fold(
            () =>
              TE.right(
                handlePlatformEventIgnored(`Adapter '${input.adapter}' not registered`),
              ),
            (found) => {
              const platform = String(found.platform);
              const platformEvents = eventMappings[platform] ?? {};
              const action = platformEvents[input.event];
              return action
                ? TE.right(handlePlatformEventOk(input.adapter, action))
                : TE.right(handlePlatformEventIgnored(`Event '${input.event}' not handled on platform '${platform}'`));
            },
          ),
        ),
      ),
    ),
};
