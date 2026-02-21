// generated: displaymode.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./displaymode.types";

export interface DisplayModeHandler {
  defineMode(input: T.DisplayModeDefineModeInput, storage: ConceptStorage):
    Promise<T.DisplayModeDefineModeOutput>;
  configureFieldDisplay(input: T.DisplayModeConfigureFieldDisplayInput, storage: ConceptStorage):
    Promise<T.DisplayModeConfigureFieldDisplayOutput>;
  configureFieldForm(input: T.DisplayModeConfigureFieldFormInput, storage: ConceptStorage):
    Promise<T.DisplayModeConfigureFieldFormOutput>;
  renderInMode(input: T.DisplayModeRenderInModeInput, storage: ConceptStorage):
    Promise<T.DisplayModeRenderInModeOutput>;
}
