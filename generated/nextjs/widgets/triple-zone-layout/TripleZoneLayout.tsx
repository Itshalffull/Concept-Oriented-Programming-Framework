'use client';

import React, { useMemo, useState, type ReactNode } from 'react';

import {
  BlockEditor,
  type BlockDef,
} from '../../../../surface/widgets/nextjs/components/widgets/domain/BlockEditor.tsx';
import {
  Outliner,
  type OutlineItem,
} from '../../../../surface/widgets/nextjs/components/widgets/domain/Outliner.tsx';
import {
  SlashMenu,
  type BlockTypeDef,
} from '../../../../surface/widgets/nextjs/components/widgets/domain/SlashMenu.tsx';
import {
  EmbeddedDiagramEditor,
  createEmbeddedDiagramSlashCommands,
  type EmbeddedDiagramEditorProps,
} from '../embedded-diagram-editor/EmbeddedDiagramEditor.tsx';

export type ZoneName = 'fieldset' | 'canvas' | 'related';
export type LayoutMode = 'horizontal' | 'stacked';
export type EditorPresentation = 'document' | 'outline';
export type RelatedViewKind =
  | 'similar'
  | 'links'
  | 'unlinked'
  | 'nearby'
  | 'comments'
  | 'custom';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  group: string;
}

export interface EmbeddedBlockDefinition {
  kind: 'diagram';
  diagram: EmbeddedDiagramEditorProps;
}

export interface RelatedViewSection {
  id: string;
  title: string;
  description?: string;
  kind?: RelatedViewKind;
  dataSource?: string;
  viewType?: string;
  filters?: string[];
  resultCount?: number;
  collapsed?: boolean;
  embeddingBacked?: boolean;
  content?: ReactNode;
}

export interface TripleZoneLayoutProps {
  layoutMode?: LayoutMode;
  collapsedZones?: ZoneName[];
  fieldsetContent?: ReactNode;
  canvasContent?: ReactNode;
  relatedContent?: ReactNode;
  onToggleZone?: (zone: ZoneName, collapsed: boolean) => void;
  fieldsetLabel?: string;
  canvasLabel?: string;
  relatedLabel?: string;
  entityTitle?: string;
  entityEyebrow?: string;
  entityDescription?: string;
  fieldsSummary?: ReactNode;
  blocks?: BlockDef[];
  outlineItems?: OutlineItem[];
  editorPresentation?: EditorPresentation;
  editorPlaceholder?: string;
  slashCommands?: SlashCommand[];
  onSlashCommandSelect?: (command: SlashCommand) => void;
  onBlocksChange?: (blocks: BlockDef[]) => void;
  onOutlineChange?: (items: OutlineItem[]) => void;
  relatedViews?: RelatedViewSection[];
  embeddedBlocks?: Record<string, EmbeddedBlockDefinition>;
}

export function createDefaultSlashCommands(): SlashCommand[] {
  return [
    {
      id: 'text',
      label: 'Text',
      description: 'Plain paragraph text for continuous writing.',
      icon: '¶',
      group: 'Writing',
    },
    {
      id: 'heading',
      label: 'Heading',
      description: 'Section heading for document structure.',
      icon: 'H',
      group: 'Writing',
    },
    {
      id: 'embedded-view',
      label: 'Embedded View',
      description: 'Insert a live View with filters and layout controls.',
      icon: '▦',
      group: 'Views',
    },
    {
      id: 'query',
      label: 'Query Block',
      description: 'Insert a query-backed block that updates with related items.',
      icon: '?',
      group: 'Views',
    },
    {
      id: 'link',
      label: 'Link to Entity',
      description: 'Create a wiki-style entity link or block reference.',
      icon: '↗',
      group: 'References',
    },
    ...createEmbeddedDiagramSlashCommands(),
    {
      id: 'callout',
      label: 'Callout',
      description: 'Promote a note, warning, or insight into a structured block.',
      icon: '!',
      group: 'Structure',
    },
  ];
}

const DEFAULT_SLASH_COMMANDS: SlashCommand[] = createDefaultSlashCommands();

export function createDefaultRelatedViews(
  relatedContent?: ReactNode,
): RelatedViewSection[] {
  return [
    {
      id: 'similar',
      title: 'Similar',
      description: 'Embedding-backed related entities surfaced by semantic similarity.',
      kind: 'similar',
      dataSource: '{"concept":"ContentEmbedding","action":"searchSimilar"}',
      viewType: 'card-grid',
      filters: ['same workspace', 'exclude current entity'],
      embeddingBacked: true,
      content: relatedContent,
    },
    {
      id: 'links-backlinks',
      title: 'Links & Backlinks',
      description: 'Forward references and reverse backlinks grouped by relation.',
      kind: 'links',
      dataSource: '{"concept":"Reference","action":"getRefs"}',
      viewType: 'list',
      filters: ['group by edge label'],
    },
    {
      id: 'unlinked',
      title: 'Unlinked References',
      description: 'Detected mentions that can be converted into formal links.',
      kind: 'unlinked',
      dataSource: '{"concept":"Backlink","action":"getUnlinkedMentions"}',
      viewType: 'list',
      filters: ['mention confidence > 0.7'],
    },
    {
      id: 'nearby',
      title: 'Nearby',
      description: 'Graph-neighbor entities discovered through relation proximity.',
      kind: 'nearby',
      dataSource: '{"concept":"Graph","action":"neighbors"}',
      viewType: 'graph',
      filters: ['within 2 hops'],
    },
  ];
}

export function mapSlashCommandsToBlockTypes(
  commands: SlashCommand[],
): BlockTypeDef[] {
  return commands.map((command) => ({
    label: command.label,
    description: command.description,
    icon: command.icon,
    group: command.group,
  }));
}

function ZoneShell({
  zone,
  label,
  collapsed,
  onToggle,
  children,
}: {
  zone: ZoneName;
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      role="region"
      aria-label={label}
      data-zone={zone}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-part={`zone-${zone}`}
    >
      <div data-part={`zone-${zone}-header`}>
        <div data-part={`zone-${zone}-header-copy`}>
          <span data-part={`zone-${zone}-label`}>{label}</span>
        </div>
        <button
          type="button"
          data-part={`zone-${zone}-toggle`}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label}`}
          aria-expanded={collapsed ? 'false' : 'true'}
          onClick={onToggle}
        >
          {collapsed ? '+' : '-'}
        </button>
      </div>
      <div data-part={`zone-${zone}-content`} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}

function RelatedViewCard({
  section,
  collapsed,
  onToggle,
}: {
  section: RelatedViewSection;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const filters = section.filters ?? [];

  return (
    <article
      data-part="related-view"
      data-kind={section.kind ?? 'custom'}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-view-type={section.viewType ?? 'list'}
      data-embedding-backed={section.embeddingBacked ? 'true' : 'false'}
    >
      <header data-part="related-view-header">
        <div data-part="related-view-heading">
          <div data-part="related-view-title-row">
            <h3 data-part="related-view-title">{section.title}</h3>
            {typeof section.resultCount === 'number' && (
              <span data-part="related-view-count">{section.resultCount}</span>
            )}
          </div>
          {section.description && (
            <p data-part="related-view-description">{section.description}</p>
          )}
          <div data-part="related-view-meta">
            <span data-part="related-view-type">{section.viewType ?? 'list'} view</span>
            {section.dataSource && (
              <span data-part="related-view-source">{section.dataSource}</span>
            )}
            {section.embeddingBacked && (
              <span data-part="related-view-embedding">embedding-backed</span>
            )}
            {filters.map((filterValue) => (
              <span key={filterValue} data-part="related-view-filter">
                {filterValue}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          data-part="related-view-toggle"
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${section.title}`}
          aria-expanded={collapsed ? 'false' : 'true'}
          onClick={onToggle}
        >
          {collapsed ? 'Show view' : 'Hide view'}
        </button>
      </header>

      {!collapsed && (
        <div data-part="related-view-body">
          {section.content ?? (
            <div data-part="related-view-empty">
              Configure a View for this section to render related entities here.
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export const TripleZoneLayout: React.FC<TripleZoneLayoutProps> = ({
  layoutMode = 'horizontal',
  collapsedZones: collapsedZonesProp = [],
  fieldsetContent,
  canvasContent,
  relatedContent,
  onToggleZone,
  fieldsetLabel = 'Fields',
  canvasLabel = 'Document',
  relatedLabel = 'Related Views',
  entityTitle = 'Untitled entity',
  entityEyebrow = 'ContentNode',
  entityDescription = 'A record that is also a page, with structured fields and related views.',
  fieldsSummary,
  blocks = [],
  outlineItems = [],
  editorPresentation = 'document',
  editorPlaceholder = "Type '/' for commands, [[links]], or ((embeds))...",
  slashCommands = DEFAULT_SLASH_COMMANDS,
  onSlashCommandSelect,
  onBlocksChange,
  onOutlineChange,
  relatedViews,
  embeddedBlocks,
}) => {
  const [collapsedZones, setCollapsedZones] = useState<Set<ZoneName>>(
    new Set(collapsedZonesProp),
  );
  const [sectionCollapse, setSectionCollapse] = useState<Record<string, boolean>>({});
  const [editorMode, setEditorMode] =
    useState<EditorPresentation>(editorPresentation);

  React.useEffect(() => {
    setCollapsedZones(new Set(collapsedZonesProp));
  }, [collapsedZonesProp]);

  React.useEffect(() => {
    setEditorMode(editorPresentation);
  }, [editorPresentation]);

  const resolvedRelatedViews = useMemo(
    () => relatedViews ?? createDefaultRelatedViews(relatedContent),
    [relatedContent, relatedViews],
  );
  const blockTypes = useMemo(
    () => mapSlashCommandsToBlockTypes(slashCommands),
    [slashCommands],
  );

  const toggleZone = (zone: ZoneName) => {
    setCollapsedZones((prev) => {
      const next = new Set(prev);
      const willCollapse = !next.has(zone);
      if (willCollapse) {
        next.add(zone);
      } else {
        next.delete(zone);
      }
      onToggleZone?.(zone, willCollapse);
      return next;
    });
  };

  const toggleSection = (sectionId: string, initialCollapsed?: boolean) => {
    setSectionCollapse((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? initialCollapsed ?? false),
    }));
  };

  const selectedSlashCommands = new Map(
    slashCommands.map((command) => [command.label, command]),
  );

  const renderEditor = () => {
    if (canvasContent) {
      return canvasContent;
    }

    const slashMenu = (
      <SlashMenu
        blockTypes={blockTypes}
        open
        onSelect={(blockType) => {
          const matched = selectedSlashCommands.get(blockType.label);
          if (matched) {
            onSlashCommandSelect?.(matched);
          }
        }}
      />
    );

    if (editorMode === 'outline') {
      return (
        <div data-part="editor-shell" data-editor-mode="outline">
          <div data-part="editor-intro">
            <span data-part="editor-kicker">Roam / Logseq mode</span>
            <h2 data-part="editor-title">{entityTitle}</h2>
            <p data-part="editor-description">
              Nested blocks, zoomable structure, quick hierarchy edits, and slash-driven insertion.
            </p>
          </div>
          <div data-part="editor-controls">
            <button type="button" data-part="editor-mode-button" aria-pressed="false" onClick={() => setEditorMode('document')}>
              Page
            </button>
            <button type="button" data-part="editor-mode-button" aria-pressed="true">
              Outline
            </button>
          </div>
          <Outliner
            items={outlineItems}
            placeholder={editorPlaceholder}
            onItemsChange={onOutlineChange}
          />
          <div data-part="editor-slash-inline">{slashMenu}</div>
        </div>
      );
    }

    return (
      <div data-part="editor-shell" data-editor-mode="document">
        <div data-part="editor-intro">
          <span data-part="editor-kicker">Notion / Coda mode</span>
          <h2 data-part="editor-title">{entityTitle}</h2>
          <p data-part="editor-description">{entityDescription}</p>
        </div>
        <div data-part="editor-controls">
          <button type="button" data-part="editor-mode-button" aria-pressed="true">
            Page
          </button>
          <button type="button" data-part="editor-mode-button" aria-pressed="false" onClick={() => setEditorMode('outline')}>
            Outline
          </button>
        </div>
        <div data-part="editor-surface">
          <BlockEditor
            blocks={blocks}
            placeholder={editorPlaceholder}
            blockTypes={blockTypes.map((item) => item.label)}
            onBlocksChange={onBlocksChange}
            renderBlock={(block, index) => {
              const embedded = embeddedBlocks?.[block.id];
              if (embedded?.kind === 'diagram') {
                return (
                  <div data-part="embedded-block" data-block-type={block.type} data-block-index={index}>
                    <EmbeddedDiagramEditor {...embedded.diagram} />
                  </div>
                );
              }

              return (
                <div data-part="block-content">
                  {block.content || (
                    <span aria-hidden="true" data-part="placeholder" data-visible="true">
                      {editorPlaceholder}
                    </span>
                  )}
                </div>
              );
            }}
            onBlockTypeSelect={(label) => {
              const matched = selectedSlashCommands.get(label);
              if (matched) {
                onSlashCommandSelect?.(matched);
              }
            }}
            slashMenu={slashMenu}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      role="group"
      aria-label="Triple zone layout"
      data-layout={layoutMode}
      data-part="root"
    >
      <ZoneShell
        zone="fieldset"
        label={fieldsetLabel}
        collapsed={collapsedZones.has('fieldset')}
        onToggle={() => toggleZone('fieldset')}
      >
        <div data-part="fieldset-shell">
          <div data-part="entity-summary">
            <span data-part="entity-eyebrow">{entityEyebrow}</span>
            <h1 data-part="entity-title">{entityTitle}</h1>
            <p data-part="entity-summary-description">{entityDescription}</p>
          </div>
          {fieldsSummary && <div data-part="fields-summary">{fieldsSummary}</div>}
          <div data-part="fieldset-body">{fieldsetContent}</div>
        </div>
      </ZoneShell>

      <ZoneShell
        zone="canvas"
        label={canvasLabel}
        collapsed={collapsedZones.has('canvas')}
        onToggle={() => toggleZone('canvas')}
      >
        {renderEditor()}
      </ZoneShell>

      <ZoneShell
        zone="related"
        label={relatedLabel}
        collapsed={collapsedZones.has('related')}
        onToggle={() => toggleZone('related')}
      >
        <div data-part="related-stack">
          {resolvedRelatedViews.map((section) => {
            const collapsed = sectionCollapse[section.id] ?? section.collapsed ?? false;
            return (
              <RelatedViewCard
                key={section.id}
                section={section}
                collapsed={collapsed}
                onToggle={() => toggleSection(section.id, section.collapsed)}
              />
            );
          })}
        </div>
      </ZoneShell>
    </div>
  );
};

TripleZoneLayout.displayName = 'TripleZoneLayout';
export default TripleZoneLayout;
