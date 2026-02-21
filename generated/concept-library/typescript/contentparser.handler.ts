// generated: contentparser.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./contentparser.types";

export interface ContentParserHandler {
  registerFormat(input: T.ContentParserRegisterFormatInput, storage: ConceptStorage):
    Promise<T.ContentParserRegisterFormatOutput>;
  registerExtractor(input: T.ContentParserRegisterExtractorInput, storage: ConceptStorage):
    Promise<T.ContentParserRegisterExtractorOutput>;
  parse(input: T.ContentParserParseInput, storage: ConceptStorage):
    Promise<T.ContentParserParseOutput>;
  extractRefs(input: T.ContentParserExtractRefsInput, storage: ConceptStorage):
    Promise<T.ContentParserExtractRefsOutput>;
  extractTags(input: T.ContentParserExtractTagsInput, storage: ConceptStorage):
    Promise<T.ContentParserExtractTagsOutput>;
  extractProperties(input: T.ContentParserExtractPropertiesInput, storage: ConceptStorage):
    Promise<T.ContentParserExtractPropertiesOutput>;
  serialize(input: T.ContentParserSerializeInput, storage: ConceptStorage):
    Promise<T.ContentParserSerializeOutput>;
}
