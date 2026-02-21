// generated: pageasrecord.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./pageasrecord.types";

export interface PageAsRecordHandler {
  create(input: T.PageAsRecordCreateInput, storage: ConceptStorage):
    Promise<T.PageAsRecordCreateOutput>;
  setProperty(input: T.PageAsRecordSetPropertyInput, storage: ConceptStorage):
    Promise<T.PageAsRecordSetPropertyOutput>;
  getProperty(input: T.PageAsRecordGetPropertyInput, storage: ConceptStorage):
    Promise<T.PageAsRecordGetPropertyOutput>;
  appendToBody(input: T.PageAsRecordAppendToBodyInput, storage: ConceptStorage):
    Promise<T.PageAsRecordAppendToBodyOutput>;
  attachToSchema(input: T.PageAsRecordAttachToSchemaInput, storage: ConceptStorage):
    Promise<T.PageAsRecordAttachToSchemaOutput>;
  convertFromFreeform(input: T.PageAsRecordConvertFromFreeformInput, storage: ConceptStorage):
    Promise<T.PageAsRecordConvertFromFreeformOutput>;
}
