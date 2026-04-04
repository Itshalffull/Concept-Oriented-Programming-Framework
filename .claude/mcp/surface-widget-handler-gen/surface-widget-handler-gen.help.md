# surface_widget_handler_gen — MCP Tool Guide

Generate functional StorageProgram handlers for Clef Surface widgets . Takes a parsed WidgetManifest and produces a handler that builds RenderPrograms from widget specs , dispatches to framework specific interpreters , and integrates with WidgetComponentTest for automated conformance testing

**generate:**
- [ ] Every anatomy part has a matching element() instruction?
- [ ] Every FSM transition has a matching transition() instruction?
- [ ] Every ARIA binding has a matching aria() instruction?
- [ ] Every connect entry has a matching bind() instruction?
- [ ] Handler uses functional StorageProgram style with autoInterpret?
- [ ] WidgetComponentTest buildPlan called to generate conformance tests?
- [ ] data-state bound on root part for test selectors?
