# Formal Grammar: schema.yaml

Defines the grammar for Clef Base `schema.yaml` files. Each schema.yaml
declares one or more Schema entities as pure data shapes with typed fields.

See Architecture doc Section 16.

---

## EBNF Grammar

```ebnf
schema_file       = comment_block? , schemas_block ;

comment_block     = ( "#" , TEXT , NEWLINE )+ ;

schemas_block     = "schemas:" , NEWLINE , schema_entry+ ;

schema_entry      = INDENT , schema_name , ":" , NEWLINE , schema_body ;

schema_name       = IDENTIFIER ;

schema_body       = manifest_line , fields_block ;

manifest_line     = INDENT2 , "manifest:" , SPACE , manifest_value , NEWLINE ;

manifest_value    = "content" | "config" ;

fields_block      = INDENT2 , "fields:" , NEWLINE , field_entry+ ;

field_entry       = INDENT3 , field_name , ":" , SPACE , field_value , NEWLINE ;

field_name        = IDENTIFIER ;

field_value       = inline_field | block_field ;

inline_field      = "{" , SPACE , field_props , SPACE , "}" ;

block_field       = NEWLINE , field_prop_lines ;

field_props       = field_prop , ( "," , SPACE , field_prop )* ;

field_prop        = field_prop_key , ":" , SPACE , field_prop_value ;

field_prop_lines  = ( INDENT4 , field_prop , NEWLINE )+ ;

field_prop_key    = "type" | "required" | "description" | "constraints"
                  | "default" ;

field_prop_value  = type_value | BOOLEAN | STRING | constraints_value ;

type_value        = "String" | "Int" | "Float" | "Boolean" | "DateTime"
                  | "RichText" | "Reference" | "list" , SPACE , type_value ;

constraints_value = NEWLINE , constraints_block ;

constraints_block = ( INDENT5 , constraint_entry , NEWLINE )+ ;

constraint_entry  = "allowed_values:" , SPACE , yaml_list
                  | "default:" , SPACE , SCALAR
                  | "min:" , SPACE , NUMBER
                  | "max:" , SPACE , NUMBER
                  | "pattern:" , SPACE , STRING ;

yaml_list         = "[" , SCALAR , ( "," , SPACE , SCALAR )* , "]" ;
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
INDENT5     = "          " ;
```

## Structural Rules

1. Every schema file MUST have a top-level `schemas:` key.
2. Each schema entry MUST have a `manifest` field with value `content` or `config`.
3. Each schema entry MUST have a `fields` block with at least one field.
4. Field types MUST be one of the built-in types or `list <Type>`.
5. The `Reference` type indicates a relation to another Schema entity.
6. The `constraints` block is optional and provides validation rules.
7. Comments (lines starting with `#`) are permitted anywhere.

## Example

```yaml
schemas:
  Article:
    manifest: content
    fields:
      title: { type: String }
      body: { type: RichText }
      author: { type: Reference }
      category: { type: Reference }
      publish_date: { type: DateTime }
      status: { type: String }

  Page:
    manifest: content
    fields:
      title: { type: String }
      body: { type: RichText }
      path: { type: String }
```
