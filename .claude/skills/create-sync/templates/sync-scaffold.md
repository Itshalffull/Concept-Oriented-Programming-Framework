# Sync Templates

Copy-paste templates for common sync patterns. Replace all `TODO` markers.

## Template 1: Auth Gate

Extract token from request, verify with JWT.

```
sync TODO_ActionAuth [eager]
  purpose: "TODO: describe what this auth gate protects"
when {
  Web/request: [ method: "TODO_method"; token: ?token ]
    => [ request: ?request ]
}
then {
  JWT/verify: [ token: ?token ]
}
```

## Template 2: Perform Action (Authenticated, New Entity)

After auth, create a new entity with `uuid()`.

```
sync PerformTODO_Action [eager]
  purpose: "TODO: describe what action is performed after auth"
when {
  Web/request: [
    method: "TODO_method";
    TODO_field: ?field1;
    TODO_field: ?field2 ]
    => []
  JWT/verify: []
    => [ user: ?user ]
}
where {
  bind(uuid() as ?id)
}
then {
  TODO_Concept/TODO_action: [
    TODO_id_field: ?id;
    TODO_field: ?field1;
    TODO_field: ?field2;
    TODO_user_field: ?user ]
}
```

## Template 3: Perform Action (Authenticated, Existing Entity)

After auth, act on an existing entity from the request.

```
sync PerformTODO_Action [eager]
  purpose: "TODO: describe what action is performed after auth"
when {
  Web/request: [
    method: "TODO_method";
    TODO_entity: ?entity;
    TODO_field: ?field1 ]
    => []
  JWT/verify: []
    => [ user: ?user ]
}
then {
  TODO_Concept/TODO_action: [
    TODO_entity: ?entity;
    TODO_field: ?field1 ]
}
```

## Template 4: Success Response (With Query)

Return data after action completes. Query concept state for display fields.

```
sync TODO_ActionResponse [eager]
  purpose: "TODO: describe what data is returned to the client"
when {
  Web/request: [ method: "TODO_method" ]
    => [ request: ?request ]
  TODO_Concept/TODO_action: []
    => [ TODO_id: ?id ]
}
where {
  TODO_Concept: { ?record TODO_field: ?field1; TODO_field: ?field2 }
}
then {
  Web/respond: [
    request: ?request;
    body: [
      TODO_entity: [
        TODO_field: ?field1;
        TODO_field: ?field2 ] ] ]
}
```

## Template 5: Success Response (Simple)

Return data directly from the action completion.

```
sync TODO_ActionResponse [eager]
  purpose: "TODO: describe what data is returned to the client"
when {
  Web/request: [ method: "TODO_method" ]
    => [ request: ?request ]
  TODO_Concept/TODO_action: []
    => [ TODO_result: ?result ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ TODO_result: ?result ] ]
}
```

## Template 6: Error Response

Handle action failure with error output.

```
sync TODO_ActionError [eager]
  purpose: "TODO: describe the error condition being handled"
when {
  Web/request: [ method: "TODO_method" ]
    => [ request: ?request ]
  TODO_Concept/TODO_action: []
    => [ TODO_error_field: ?error ]
}
then {
  Web/respond: [
    request: ?request;
    error: ?error;
    code: TODO_STATUS_CODE ]
}
```

## Template 7: Boolean Branch (Success)

Match on boolean output for success path.

```
sync TODO_Success [eager]
  purpose: "TODO: describe the success path and what triggers it"
when {
  Web/request: [ method: "TODO_method" ]
    => []
  TODO_Concept/TODO_action: []
    => [ valid: true ]
}
then {
  TODO_NextConcept/TODO_nextAction: [ TODO_field: ?field ]
}
```

## Template 8: Boolean Branch (Failure)

Match on boolean output for error path.

```
sync TODO_Failure [eager]
  purpose: "TODO: describe the failure condition being handled"
when {
  Web/request: [ method: "TODO_method" ]
    => [ request: ?request ]
  TODO_Concept/TODO_action: []
    => [ valid: false ]
}
then {
  Web/respond: [
    request: ?request;
    error: "TODO_error_message";
    code: TODO_STATUS_CODE ]
}
```

## Template 9: Cascade Delete

When parent is deleted, delete all children.

```
sync CascadeDeleteTODO_Children [eager]
  purpose: "TODO: describe why child entities must be removed with the parent"
when {
  TODO_Parent/delete: [ TODO_parent_id: ?parent ]
    => [ TODO_parent_id: ?parent ]
}
where {
  TODO_Child: { ?child TODO_parent_ref: ?parent }
}
then {
  TODO_Child/delete: [ TODO_child_id: ?child ]
}
```

## Template 10: State Lookup Before Action

Query concept state to find an entity, then act on it.

```
sync TODO_SyncName [eager]
  purpose: "TODO: describe the lookup and subsequent action"
when {
  Web/request: [ method: "TODO_method"; TODO_lookup_field: ?lookup ]
    => [ request: ?request ]
}
where {
  TODO_Concept: { ?entity TODO_lookup_field: ?lookup }
}
then {
  TODO_Target/TODO_action: [ TODO_entity: ?entity; TODO_field: ?lookup ]
}
```

## Template 11: Side Effect Chain

One action triggers another automatically.

```
sync TODO_SyncName [eager]
  purpose: "TODO: describe the side effect and why it follows the trigger"
when {
  TODO_Concept/TODO_action: []
    => [ TODO_field: ?value ]
}
then {
  TODO_NextConcept/TODO_nextAction: [ TODO_field: ?value ]
}
```

## Template 12: Pipeline Stage

Processing pipeline — output of one stage feeds input of next.

```
sync TODO_StageName [eager]
  purpose: "TODO: describe this pipeline stage and what it feeds into"
when {
  TODO_PriorConcept/TODO_priorAction: [ TODO_key: ?key ]
    => [ TODO_output: ?output ]
}
then {
  TODO_NextConcept/TODO_nextAction: [ TODO_key: ?key; TODO_input: ?output ]
}
```

## Template 13: Multi-Condition Response (Join)

Wait for multiple completions before responding.

```
sync TODO_FullResponse [eager]
  purpose: "TODO: describe the composite response being assembled"
when {
  Web/request: [ method: "TODO_method" ]
    => [ request: ?request ]
  TODO_ConceptA/TODO_actionA: []
    => [ TODO_fieldA: ?valueA ]
  TODO_ConceptB/TODO_actionB: []
    => [ TODO_fieldB: ?valueB ]
}
where {
  TODO_Concept: { ?record TODO_display_field: ?display }
}
then {
  Web/respond: [
    request: ?request;
    body: [
      TODO_entity: [
        TODO_fieldA: ?valueA;
        TODO_fieldB: ?valueB;
        TODO_display: ?display ] ] ]
}
```

## Template 14: Eventual Cross-Runtime Sync

Replicate data to a remote runtime (may be offline).

```
sync TODO_Replicate [eventual] [idempotent]
  purpose: "TODO: describe what data is replicated and why"
when {
  TODO_LocalRuntime.TODO_Concept/TODO_action: []
    => [ TODO_field: ?value1; TODO_field: ?value2 ]
}
then {
  TODO_RemoteRuntime.TODO_Concept/TODO_action: [
    TODO_field: ?value1;
    TODO_field: ?value2 ]
}
```

## Template 15: Kit Required Sync

Structural invariant sync for a concept kit.

```
sync TODO_SyncName [required]
  purpose: "TODO: describe what data integrity breaks without this sync"
when {
  TODO_Parent/TODO_action: [ TODO_id: ?entity ]
    => [ TODO_id: ?entity ]
}
where {
  TODO_Child: { ?child TODO_parent_ref: ?entity }
}
then {
  TODO_Child/TODO_cleanup_action: [ TODO_id: ?child ]
}
```

## Template 16: Kit Recommended Sync

Useful default sync that apps can override or disable.

```
sync TODO_SyncName [recommended]
  purpose: "TODO: describe the default behavior and how to customize"
when {
  Web/request: [ method: "TODO_method"; TODO_field: ?field ]
    => []
  TODO_Concept/TODO_action: [ TODO_id: ?entity ]
    => [ TODO_id: ?entity ]
}
where {
  bind(uuid() as ?id)
}
then {
  TODO_Target/TODO_action: [
    TODO_id: ?id;
    TODO_parent: ?entity;
    TODO_field: ?field ]
}
```

## Customization Guide

| TODO Marker | Replace With | Example |
|-------------|-------------|---------|
| `purpose: "TODO:..."` | Descriptive purpose string | `purpose: "Verify JWT token before article creation"` |
| `TODO_SyncName` | Sync name in PascalCase | `CreateArticleAuth` |
| `TODO_method` | Web request method string | `"create_article"` |
| `TODO_Concept` | Concept name in PascalCase | `Article` |
| `TODO_action` | Action name in camelCase | `create` |
| `TODO_field` | Field name in camelCase | `title` |
| `TODO_id` | Entity ID field name | `article` |
| `TODO_STATUS_CODE` | HTTP status code | `401` |
| `TODO_error_message` | Error message string | `"Not found"` |
| `TODO_LocalRuntime` | Local runtime name | `Phone` |
| `TODO_RemoteRuntime` | Remote runtime name | `Server` |
