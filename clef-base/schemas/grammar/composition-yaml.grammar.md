# Formal Grammar: composition.yaml

Defines the grammar for Clef Base `composition.yaml` files. Each
composition.yaml declares a reusable mixin or augmentation that can be
applied to Schema entities, adding fields and wiring to source concepts.

See Architecture doc Section 16.

---

## EBNF Grammar

```ebnf
composition_file    = comment_block? , composition_header , rules_block ;

comment_block       = ( "#" , TEXT , NEWLINE )+ ;

composition_header  = composition_line , version_line , NEWLINE ,
                      source_line , target_line ;

composition_line    = "composition:" , SPACE , IDENTIFIER , NEWLINE ;

version_line        = "version:" , SPACE , NUMBER , NEWLINE ;

source_line         = "source:" , SPACE , IDENTIFIER , NEWLINE ;

target_line         = "target:" , SPACE , target_value , NEWLINE ;

target_value        = '"*"' | IDENTIFIER | yaml_string_list ;

yaml_string_list    = "[" , STRING , ( "," , SPACE , STRING )* , "]" ;

rules_block         = "rules:" , NEWLINE , rule_entry+ ;

rule_entry          = INDENT , "-" , SPACE , rule_body ;

rule_body           = type_line , fields_line , description_line ,
                      source_concept_line , field_definitions_block ;

type_line           = "type:" , SPACE , rule_type , NEWLINE ;

rule_type           = "mixin" | "augmentation" | "projection" ;

fields_line         = INDENT2 , "fields:" , SPACE , yaml_identifier_list , NEWLINE ;

yaml_identifier_list = "[" , IDENTIFIER , ( "," , SPACE , IDENTIFIER )* , "]" ;

description_line    = INDENT2 , "description:" , SPACE , STRING , NEWLINE ;

source_concept_line = INDENT2 , "source_concept:" , SPACE , IDENTIFIER , NEWLINE ;

field_definitions_block = INDENT2 , "field_definitions:" , NEWLINE ,
                          field_definition_entry+ ;

field_definition_entry  = INDENT3 , field_name , ":" , NEWLINE ,
                          field_def_props ;

field_name          = IDENTIFIER ;

field_def_props     = ( INDENT4 , field_def_prop , NEWLINE )+ ;

field_def_prop      = "type:" , SPACE , type_value
                    | "required:" , SPACE , BOOLEAN
                    | "description:" , SPACE , STRING
                    | "default:" , SPACE , SCALAR ;

type_value          = "String" | "Int" | "Float" | "Boolean" | "Number"
                    | "DateTime" | "RichText" | "Reference"
                    | "list" , SPACE , type_value ;
```

## Tokens

```ebnf
IDENTIFIER  = LETTER , ( LETTER | DIGIT | "_" | "-" )* ;
TEXT        = ( PRINTABLE_CHAR )+ ;
STRING      = '"' , ( PRINTABLE_CHAR - '"' )* , '"' ;
SCALAR      = STRING | NUMBER | BOOLEAN | IDENTIFIER ;
NUMBER      = DIGIT+ , ( "." , DIGIT+ )? ;
BOOLEAN     = "true" | "false" ;
LETTER      = "A".."Z" | "a".."z" ;
DIGIT       = "0".."9" ;
SPACE       = " " ;
NEWLINE     = "\n" ;
INDENT      = "  " ;
INDENT2     = "    " ;
INDENT3     = "      " ;
INDENT4     = "        " ;
```

## Structural Rules

1. Every composition file MUST have a top-level `composition:` key with a unique name.
2. The `version:` field MUST be a positive integer.
3. The `source:` field identifies the originating schema domain (e.g., `content`, `media`).
4. The `target:` field specifies which Schemas this composition applies to:
   - `"*"` means it applies to all Schemas.
   - A single identifier targets one Schema.
   - A list targets multiple specific Schemas.
5. The `rules:` block MUST contain at least one rule entry.
6. Each rule MUST have a `type` of `mixin`, `augmentation`, or `projection`:
   - `mixin`: Adds fields directly to the target Schema.
   - `augmentation`: Adds computed/derived fields backed by a concept.
   - `projection`: Exposes a subset of a source concept's state as read-only fields.
7. Each rule MUST have a `fields` list naming the fields it adds.
8. Each rule MUST have a `source_concept` identifying which concept provides the behavior.
9. Each rule MUST have a `field_definitions` block defining the type and metadata of each field.

## Example

```yaml
composition: commentable
version: 1

source: content
target: "*"
rules:
  - type: mixin
    fields: [comments_enabled, comment_count]
    description: "Adds commenting capability to any entity type via the Comment concept"
    source_concept: Comment
    field_definitions:
      comments_enabled:
        type: Boolean
        required: true
        description: "Whether comments are enabled on this entity"
      comment_count:
        type: Number
        required: false
        description: "Cached count of comments on this entity"
```
