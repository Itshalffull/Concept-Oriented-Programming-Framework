// generated: formbuilder.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./formbuilder.types";

export interface FormBuilderHandler {
  buildForm(input: T.FormBuilderBuildFormInput, storage: ConceptStorage):
    Promise<T.FormBuilderBuildFormOutput>;
  validate(input: T.FormBuilderValidateInput, storage: ConceptStorage):
    Promise<T.FormBuilderValidateOutput>;
  processSubmission(input: T.FormBuilderProcessSubmissionInput, storage: ConceptStorage):
    Promise<T.FormBuilderProcessSubmissionOutput>;
  registerWidget(input: T.FormBuilderRegisterWidgetInput, storage: ConceptStorage):
    Promise<T.FormBuilderRegisterWidgetOutput>;
  getWidget(input: T.FormBuilderGetWidgetInput, storage: ConceptStorage):
    Promise<T.FormBuilderGetWidgetOutput>;
}
