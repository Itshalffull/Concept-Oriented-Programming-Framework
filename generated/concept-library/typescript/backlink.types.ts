// generated: backlink.types.ts

export interface BacklinkGetBacklinksInput {
  entity: string;
}

export type BacklinkGetBacklinksOutput =
  { variant: "ok"; sources: string };

export interface BacklinkGetUnlinkedMentionsInput {
  entity: string;
}

export type BacklinkGetUnlinkedMentionsOutput =
  { variant: "ok"; mentions: string };

export interface BacklinkReindexInput {
}

export type BacklinkReindexOutput =
  { variant: "ok"; count: number };

