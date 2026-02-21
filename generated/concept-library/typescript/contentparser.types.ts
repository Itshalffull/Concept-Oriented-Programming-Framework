// generated: contentparser.types.ts

export interface ContentParserRegisterFormatInput {
  name: string;
  grammar: string;
}

export type ContentParserRegisterFormatOutput =
  { variant: "ok"; name: string }
  | { variant: "exists"; message: string };

export interface ContentParserRegisterExtractorInput {
  name: string;
  pattern: string;
}

export type ContentParserRegisterExtractorOutput =
  { variant: "ok"; name: string }
  | { variant: "exists"; message: string };

export interface ContentParserParseInput {
  content: string;
  text: string;
  format: string;
}

export type ContentParserParseOutput =
  { variant: "ok"; ast: string }
  | { variant: "error"; message: string };

export interface ContentParserExtractRefsInput {
  content: string;
}

export type ContentParserExtractRefsOutput =
  { variant: "ok"; refs: string }
  | { variant: "notfound"; message: string };

export interface ContentParserExtractTagsInput {
  content: string;
}

export type ContentParserExtractTagsOutput =
  { variant: "ok"; tags: string }
  | { variant: "notfound"; message: string };

export interface ContentParserExtractPropertiesInput {
  content: string;
}

export type ContentParserExtractPropertiesOutput =
  { variant: "ok"; properties: string }
  | { variant: "notfound"; message: string };

export interface ContentParserSerializeInput {
  content: string;
  format: string;
}

export type ContentParserSerializeOutput =
  { variant: "ok"; text: string }
  | { variant: "notfound"; message: string };

