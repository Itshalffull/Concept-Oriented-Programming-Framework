# **Architectural Decomposition of View Systems: Intermediate Representations, Bidirectional Transformations, and Provider Patterns**

## **1\. Introduction to View Architecture Decomposition**

The evolution of enterprise software interfaces demonstrates a persistent transition from monolithic, tightly coupled data-presentation layers to highly modular, decoupled architectures. In conventional paradigms, the logic dictating data retrieval, filtering, sorting, grouping, and visual rendering is frequently unified within a single declarative configuration or a hardcoded component. While efficient for initial development, this unified approach creates rigid systems incapable of supporting fluid, multi-modal user interactions. The modern user expectation demands the ability to seamlessly switch between a graphical query builder, a natural language Domain Specific Language (DSL), and an underlying data execution engine without losing state or context.

An analysis of modern data-driven pipelines reveals a critical opportunity for profound architectural decomposition. By elevating individual responsibilities—such as Filters, Sorts, Groups, Displays, Queries, and Custom Data—into independent, first-class concepts, a system can achieve immense flexibility.1 Rather than existing as properties within a singular view configuration, these distinct concepts can be orchestrated dynamically by a central "Shell View" or synthesized permanently into a "Derived View".1

To enable this decoupling, a robust Intermediate Representation (IR) is absolutely required. This IR serves as the agnostic connective tissue between user-facing inputs and backend data execution engines, operating completely independently of the underlying database architecture.3 Furthermore, establishing a bidirectional synchronization between the abstract IR and various user interfaces demands a rigorous mathematical foundation, utilizing bidirectional transformations (lenses) to ensure state consistency across all visual and textual manifestations.5

This report provides an exhaustive examination of the theoretical foundations, industry implementations, and structural patterns required to architect a fully decomposed, provider-driven view system. It meticulously maps out the taxonomy of independent concepts, establishes the necessity of the Provider Pattern, and delineates the connectivity required to orchestrate these components into a cohesive, highly scalable enterprise application.

## **2\. Deconstructing the Existing View Architecture**

To understand the necessity of this decomposition, one must first analyze the structural limitations of existing unified architectures. Modern frameworks, such as the clef-base architecture, have already begun moving toward data-driven, query-to-render pipelines where every view is treated as a kernel entity rather than a hardcoded component.1

In these systems, a View entity typically contains a specific configuration parsed at render time, encapsulating the data source, the display layout (e.g., table, card-grid, graph), the visible fields, and the configurations for filters, sorts, and groups.1 While this represents a significant advancement over legacy hardcoded screens, it still binds the *definition* of the filter to the *definition* of the view. The data flow often relies on a ViewRenderer that loads the configuration, resolves template variables, and fetches raw data via a query hook.1 If a user wishes to apply the exact same filter logic across a completely different display layout or across a disparate data source, the system often requires duplicating the filter configuration.

Furthermore, architectures built upon compositions of independent, spec-driven services—such as the Clef framework—emphasize total independence and sovereign storage.1 In such frameworks, a concept must never reference the state or internal actions of another concept, with coordination handled exclusively through declarative synchronizations.1 The Hierarchical Derivation Architecture allows an entire application to be expressed as a tree of derived concepts, providing named features with testable operational principles.1

Applying this rigorous philosophy of total independence to the view layer mandates that the view itself be shattered into its constituent primitives. If a Filter is bound to a View, it cannot be independently tested, reused, or serialized into a URL parameter without dragging the View's layout configuration alongside it. By breaking the monolithic view into discrete concepts, the system allows for a "Shell View" to act merely as a micro-frontend container.2 The Shell View coordinates the instantiation of these independent concepts, communicating via the DOM or browser events, thereby preventing the layout from dictating the data retrieval mechanics.2

## **3\. Taxonomy of Decomposed View Concepts**

Transitioning away from a monolithic view configuration requires establishing a formal taxonomy of independent components. Each of these components encapsulates a distinct responsibility, maintains its own state, and is connected to the others via a standardized Intermediate Representation.

The following table delineates the core concepts required for a fully decomposed architecture, their intrinsic responsibilities, and their output types.

| Core Concept | Architectural Responsibility | Functional Output |
| :---- | :---- | :---- |
| **Query** | Defines the fundamental intent to retrieve a specific domain of data. It dictates the root entity and handles security/access contexts.1 | An unrefined, unordered stream of raw data records from a sovereign store. |
| **Filter** | An isolated, composable predicate tree. It evaluates incoming data against a set of logical rules to determine inclusion or exclusion.8 | A restricted subset of the original data stream matching the defined criteria. |
| **Sort** | Encapsulates the logic for ordering records. Consists of tuples defining target attributes and directionality (ascending/descending).10 | A sequentially ordered array of data records based on the defined heuristics. |
| **Group** | Dictates the aggregation and hierarchical clustering of flat data, transforming a one-dimensional array into a multi-dimensional tree.1 | A nested data structure featuring aggregation metrics (e.g., counts, sums). |
| **Custom Data** | Defines the shaping, formatting, and mutation of retrieved attributes before rendering. Includes virtual fields and localized formatters.1 | A mutated record set where raw values have been cast or transformed into display-ready values. |
| **Display** | Controls the visual rendering semantics. It iterates over data without manipulating the underlying values, supporting holistic or per-item layouts.1 | The final visual DOM elements presented to the end user. |

### **3.1 The Query Concept**

The Query concept operates as the foundational data retrieval mechanism. It is entirely agnostic to visual presentation and user-facing filters. In a decomposed architecture, a Query is an independent graph node that defines the source schema and the relationship bindings required to retrieve a cohesive dataset. By isolating the Query, the system allows multiple distinct displays (e.g., a calendar and a data grid) to subscribe to the exact same data retrieval logic without duplicating backend network requests. The Query concept requires an underlying provider to translate its intent into a physical database retrieval command.7

### **3.2 The Filter Concept**

The Filter concept represents the most critical decoupling in the architecture. A Filter is essentially an Abstract Syntax Tree (AST) of predicates.8 Because Filters are first-class concepts, they can be authored independently of Queries. For example, a "Requires Attention" filter can be instantiated and applied universally across a "Tasks" query, an "Invoices" query, or a "Projects" query, provided the underlying IR maps correctly to the target's schema properties.16 This allows users to save custom filters to their profiles and apply them arbitrarily across the entire application ecosystem, a feature impossible in tightly coupled view architectures.8

### **3.3 The Sort and Group Concepts**

Divorcing Sort and Group operations from the core Query allows users to manipulate data structures entirely on the client side or via highly optimized read-models without triggering a full database scan.15 A Sort concept is an array of directives that can be modified interactively by clicking table headers.19 The Group concept is significantly more complex, requiring an IR capable of expressing mathematical aggregation functions (such as sum, average, or count) across pivot boundaries, effectively transforming flat relational data into hierarchical trees suitable for pivot tables or nested lists.12

### **3.4 The Custom Data Concept**

Raw database fields are rarely suitable for direct human consumption. The Custom Data concept encapsulates all mapping logic required to transform physical data into display data.1 This includes concatenating first and last names, calculating relative time distances (e.g., "3 hours ago"), or applying specific badge formatters based on schema rules.1 By isolating this into a discrete concept, the system ensures that the Display component does not contain embedded business logic, maintaining a pure separation of concerns.22

### **3.5 The Display Concept**

The Display concept is the final visual manifestation of the data pipeline. Displays are categorized into holistic layouts (which render an entire dataset as a single structure, such as a timeline or chart) and per-item layouts (which render each row individually, such as a table or card grid).1 The Display concept is completely blind to how the data was filtered, sorted, or grouped; it simply receives an array of Custom Data and iterates over it, applying visual styling.1

## **4\. The Intermediate Representation (IR) Framework**

To successfully connect these isolated concepts, the architecture requires an Intermediate Representation (IR). The IR is a data structure that abstractly models the user's intent without committing to a specific database language (like SQL) or a specific frontend framework (like React).4

### **4.1 Relational Algebra as the Mathematical Baseline**

The theoretical foundation for this IR is relational algebra, which serves as the formal grammar for evaluating and transforming datasets.25 Unlike declarative languages that describe the desired outcome, relational algebra defines the procedural mathematical steps required to isolate data.26 Every query optimizer in existence internally converts SQL into a relational algebra tree prior to execution, proving its efficacy as an intermediate structure.28

The core strength of relational algebra lies in the property of closure: every operation executed on a relation produces a new, mathematically sound relation.26 This guarantees that independent view concepts can be endlessly composed without structural failure. The Filter concept maps directly to the Selection operator (![][image1]), which restricts tuples based on precise predicates.25 The Custom Data and Display concepts map to the Projection operator (![][image2]), which isolates specific attributes while discarding irrelevant data.25 The Query concept maps to Cross-Products (![][image3]) and Joins (![][image4]), which merge independent data domains into unified relations.26 By designing the system's IR to mimic these operators, the UI can construct complex, nested data pipelines while guaranteeing mathematical consistency across all transformations.27

Furthermore, relational algebra provides distributive laws and algebraic criteria for decomposition.29 An algebraic criterion dictates that a relation can be decomposed exactly when the subsets, derived by projection, can always be joined back to form the original relation without data loss.29 This attribute preservation ensures that when the Shell View decomposes a monolithic dataset into independent fragments for separate display widgets, the underlying data integrity remains absolute.31

### **4.2 Abstract Syntax Trees (AST) and Expression Builders**

In practical implementation, this relational algebra is serialized into an Abstract Syntax Tree (AST).32 An AST naturally accommodates the hierarchical nature of logical grouping, arithmetic operations, and nested filtering rules necessary for a comprehensive Filter or Query concept.28

In ecosystems utilizing Clean Architecture and Command Query Responsibility Segregation (CQRS), passing hardcoded SQL strings across architectural boundaries strictly violates dependency inversion.9 To solve this, frameworks like Microsoft's.NET utilize Expression Trees as a programmatic IR.8 An Expression Tree represents code as a traversable data structure rather than compiled machine instructions.8 The application layer constructs a generic predicate tree, utilizing Expression Builders to safely collect independent predicate blocks and combine them with logical operators.9 The infrastructure layer then receives this abstract tree and compiles it into an optimized SQL execution plan.8

Similarly, the Elixir ecosystem utilizes the Ecto library to handle composable queries through a highly sophisticated internal binding system.7 Ecto provides an IR encapsulated within the %Ecto.Query{} struct.7 Ecto demonstrates how queries can be inherently composable; a base query defining the fundamental data source can be arbitrarily extended later with additional filters or projections.7 Crucially, Ecto utilizes positional and named bindings to track references to different data schemas within the query AST, ensuring that complex joins do not lose their relational mapping.7 Ecto's support for "bindingless" syntax further highlights the value of data-driven IRs, allowing applications to pass dictionaries or maps directly into the query expression, bypassing string concatenation entirely.7

### **4.3 Structure of the Proposed IR**

A standardized IR specification representing a Filter concept within this architecture must be heavily influenced by both.NET Expression Trees and Ecto's composability.7 The AST must be serializable to JSON to traverse network boundaries.

A sample representation of this IR is detailed below:

JSON

{  
  "Concept": "Filter",  
  "Operator": "AND",  
  "Bindings": { "task": "TaskSchema", "proj": "ProjectSchema" },  
  "Nodes": }  
      \]  
    }  
  \]  
}

This structure achieves critical architectural objectives. It remains completely agnostic to database dialects, containing no proprietary SQL syntax.3 It is easily traversable by a provider utilizing a recursive Visitor Pattern.37 Furthermore, a graphical query builder UI can map each node in the Nodes array to a distinct visual row, rendering dropdowns for fields and operators, thus establishing a direct 1:1 mapping between the IR and the visual DOM.38

## **5\. Academic Foundations of Bidirectional Transformations**

When a decomposed architecture supports multiple interfaces for manipulating the same conceptual filter—such as a graphical dropdown UI and a natural language text DSL—maintaining synchronization between these disparate representations requires bidirectional transformations (BX).5 The academic framework governing BX is recognized broadly as Lens Theory.6

### **5.1 Lens Theory and Algebraic Laws**

A lens is composed of two primary functions that bridge a concrete source state (e.g., the JSON AST IR) and an abstract view state (e.g., a user-facing DSL string).6 The Get function projects the source IR into the DSL format. Conversely, the Put (or Putback) function translates modifications made by the user in the DSL back into structural updates on the underlying IR.6

To guarantee system stability and prevent data corruption, these transformations must strictly adhere to specific algebraic lens laws 6:

| Lens Law | Formal Definition | Architectural Implication for UI and IR |
| :---- | :---- | :---- |
| **GetPut (Hippocracy)** | **![][image5]** | If the AST is translated to a DSL, and that exact DSL string is immediately parsed back into the system without modifications, the AST must remain completely unchanged. The parsing mechanism must not introduce destructive defaults.6 |
| **PutGet (Correctness)** | **![][image6]** | If a user types a new complex DSL query (![][image7]), updating the underlying AST (![][image8]), and the system immediately re-renders the DSL from that new AST, the output must exactly match what the user typed, preserving their intent.6 |
| **PutPut (History Ignorance)** | **![][image9]** | Successive updates to the textual view overwrite previous ones cleanly. If a user changes a filter twice in rapid succession, the final state of the AST reflects only the final string. The system does not suffer from lingering state artifacts.6 |

In the proposed architecture, lenses act as the critical translation layer between the internal IR and the varied UI components.44 An *asymmetric lens* is typically utilized when the IR is designated as the absolute source of truth, and the UI components are merely transient projections of that truth.42 In this configuration, updates to the view are propagated back to the source, but the source itself is assumed to contain more comprehensive data than the view displays.42 The "view-update problem" from database literature explicitly addresses the challenges of this asymmetric translation, ensuring that destructive UI edits do not unintentionally corrupt hidden source fields.41

### **5.2 Applicative Bidirectional Programming**

Historically, implementing these bidirectional systems required writing two completely separate functions—the parser and the unparser—and manually ensuring they remained synchronized.42 This rudimentary design is highly error-prone and tedious to maintain.42

Recent advancements in applicative bidirectional programming provide frameworks where transformations can be written as unidirectional programs in standard functional languages, yielding programs that are inherently bidirectional by construction.44 By utilizing frameworks inspired by Definite Clause Grammars and logic programming, developers can define syntax-semantics relations that are fully reversible.46 This means defining the mapping between the AST node and the DSL text once, automatically generating both the parser that reads the text and the pretty-printer that outputs the text.47 This significantly reduces the maintenance burden and mathematically guarantees that the PutGet and GetPut laws are satisfied.44

## **6\. Translating IR to Interfaces: Parsing and Pretty Printing**

To facilitate the bidirectional transition between a natural language DSL and the underlying AST, the system must employ rigorous parsing and unparsing techniques. The translation mechanics map closely to concepts found in Cross-Language Information Retrieval (CLIR), where queries must be translated across linguistic boundaries while preserving exact semantic intent.48 Similarly, translating from a human-readable DSL into a machine-readable AST requires structural query representation techniques that ensure semantic fidelity.50

### **6.1 Forward Translation: DSL to IR**

When a user interacts with a text-based filter, the system must translate this unstructured text into the rigid AST required by the Data Providers. A premier industry example of this is the Todoist task management application, which utilizes a highly expressive natural language DSL for complex view filtering.51 Users construct specific visual parameters using text queries such as today & p1 or (today | overdue).52

Underneath this interface, Todoist employs an advanced, multi-stage parsing architecture.21 The translation follows these sequential steps:

1. **Lexical Analysis and Tokenization:** The natural language string is passed through a lexer, which splits the query into identifiable tokens.32 Tools like Todoist's internal Filterist library or Smart Date Parsers identify phrases like "last 2 months" as relative date tokens, mapping them to specific bounds.21  
2. **Syntactic Analysis:** A parser evaluates the tokens against a defined grammar to map the relationships between them.32 This creates the initial AST, distinguishing between attribute lookups (e.g., priority p1), logical operators (&, |), and contextual groupings defined by parentheses.21  
3. **Semantic Validation:** The AST is checked for invalid semantics against a rules file that contains a list of valid keywords and symbols supported by the schema.34

This forward translation effectively acts as the Put function from Lens theory, taking the user's view representation and forcing the underlying AST state to conform to it.6

### **6.2 Reverse Translation: IR to DSL via Pretty Printing**

The true power of a bidirectional architecture is realized when a user modifies the AST through an alternative interface—such as a graphical query builder—and the system must regenerate the corresponding DSL text.47

If a user utilizes a dropdown menu to change their priority filter from p1 to p2, the visual component directly updates the JSON AST in memory.56 To update the text input box, the system employs an "Unparser" or "Pretty Printer".47

The Pretty Printer operates by traversing the updated AST using the Visitor Pattern.37 The Visitor Pattern relies on double dispatch to decouple the traversal logic from the AST node definitions.37 A PrintVisitor class defines specific methods for each node type (e.g., visit\_OperatorNode, visit\_ValueNode).37

1. The Visitor is passed to the root of the AST.  
2. Upon visiting an AND operator node, the Visitor recursively calls the print function on its children and inserts the & character between their outputs.  
3. Upon visiting the modified Equals node for priority, the Visitor outputs the string p1.  
4. The output strings are concatenated, yielding the new DSL string today & p2.

This reverse translation acts as the Get function from Lens theory.6 By combining the Lexer/Parser with the PrintVisitor, the architecture provides a perfect two-way mapping mechanism that allows users to switch seamlessly between graphical interfaces and textual DSLs.47

## **7\. Industry Paradigms in Decoupled Query Execution**

Analyzing established systems provides empirical blueprints for decoupling view logic from data access and effectively utilizing intermediate representations. These paradigms range from legacy proprietary databases to modern web protocols, each demonstrating specific approaches to isolating the core concepts of filtering, sorting, and display.

### **7.1 Microsoft filePro: Decoupling Selection from Display**

A foundational example of decoupled processing exists within Microsoft filePro, a historical database management and rapid application development system.58 filePro explicitly separates the data storage mechanism from the user's querying interface through the deployment of "scan/selection" processing, internally referred to as \-v tables.59

Rather than tightly binding the database query logic to the final output report format, \-v tables function as standalone, interactive selection screens.59 These tables capture user criteria—such as prompting for an invoice date greater than a specific threshold—and translate these arbitrary inputs into an internal selection set.59 This explicit abstraction layer guarantees that the underlying output processing table (representing the Display concept) remains entirely agnostic to how the data was filtered.59 The filePro architecture provides early proof that isolating the Filter concept from the Display concept radically improves the reusability of rendering logic across diverse query scenarios.59

### **7.2 OData: Standardized Intermediate Representation over HTTP**

The Open Data Protocol (OData) represents one of the most comprehensive industry standardizations of a query IR mapped over RESTful interfaces.11 OData essentially abstracts complex database operations into system query options prefixed with a $ character, exposing them via standard HTTP URLs.13

OData's architecture effectively decomposes view requirements into discrete, highly composable URL parameters:

* **The Filter Concept:** The $filter option evaluates logical operators (eq, ne, gt), arithmetic operations, and complex canonical functions (such as startswith or hassubset) against a collection.16  
* **The Sort Concept:** The $orderby option dictates the sequence of results, supporting multi-column sorting directions and parameter aliases.10  
* **The Custom Data Concept:** The $select option projects specific attributes, while $expand supports the inlining of associated hierarchical data entries.13

Internally, OData parses these string parameters using robust Extended Backus-Naur Form (EBNF) grammars, converting the raw URL into a programmatic AST.60 This AST serves as the formal IR, which is subsequently interpreted by a backend provider (such as Microsoft's Entity Framework) into a physical database query.8 By forcing the client application to communicate exclusively through this standardized IR string, OData successfully decouples the frontend view from the physical backend data store.

### **7.3 GraphQL: Bidirectional Schema Mapping and Relay Connections**

GraphQL significantly advances the concept of view decoupling by shifting the responsibility of defining the data shape entirely to the client application.62 In a GraphQL architecture, the client submits a hierarchical query structure (acting as the IR), and the server maps this request bidirectionally to its internal physical schema utilizing resolver functions.64

For complex paginated and sorted views, the GraphQL ecosystem standardizes around the Relay connection specification.63 This pattern introduces independent architectural concepts for data traversal:

* **Nodes:** The actual data entity representing the physical record.62  
* **Edges:** Represent the contextual relationship between two data points, often containing specific metadata like a pagination cursor or a relational role (e.g., a user's specific role within a particular project).65

By explicitly storing relationship data on the edge rather than the node, GraphQL cleanly isolates the Custom Data entity from the specific Query Context.65 Furthermore, the implementation of custom scalar types and bidirectional relationship mappings allows the GraphQL schema to dynamically adjust to complex UI requirements without demanding alterations to the underlying physical data providers.62

## **8\. The Provider Pattern Application**

While the IR describes *what* is requested, the system requires an authoritative mechanism to determine *how* that request is executed against physical infrastructure. The Provider Pattern, an implementation of the classic Strategy Design Pattern, fulfills this critical role.66

A Provider is an injectable interface that receives the abstract IR (the AST) and translates it into a domain-specific execution plan—be it an Entity Framework query, a raw SQL string, a MongoDB aggregation pipeline, or a downstream API HTTP request.68 By abstracting execution into discrete Providers, the system guarantees that the View concepts remain entirely decoupled from the persistence infrastructure.69

### **8.1 Concept-to-Provider Mapping**

Not every concept requires a provider. Visual concepts manage presentation logic, while data-oriented concepts require providers to translate intent into execution.

| View Concept | Requires Provider? | Provider Functionality |
| :---- | :---- | :---- |
| **Filter / Sort / Group** | Yes | Generates target-specific query logic. A FilterProvider traverses the AST to build execution strings (e.g., SQL WHERE clauses).67 |
| **Query** | Yes | Receives the output of the Filter/Sort/Group providers and executes the final data fetch against the physical store.64 |
| **Custom Data** | Partial | Often executes purely in-memory via formatters, but may require a projection provider if delegating transformations to the database level. |
| **Display** | No | Operates entirely on the client side, utilizing DOM APIs or UI frameworks to render the resolved data.14 |

### **8.2 Execution Topologies**

In a system featuring multiple database technologies (polyglot persistence), multiple providers are registered and resolved at runtime.71

* **The SQL Provider** maps an Operator: "GreaterThan" node from the IR to the SQL \> operator, utilizing parameterized queries to prevent injection vulnerabilities.4  
* **The OData Provider** maps the exact same AST node to the $filter=Field gt Value syntax, encoding it into an HTTP URI for a downstream REST service.16  
* **The In-Memory Provider** maps the node to a native JavaScript or C\# array filter() callback, executing the logic purely on the client side against an already retrieved dataset.8

This highly abstracted approach is prominently utilized in modern UI frameworks like the MUI Data Grid.38 In MUI, filtering operators are defined as injected functions (e.g., getApplyFilterFn).38 If a developer requires a custom, highly specific filtering mechanism, they merely inject a new Provider object defining how that logic evaluates data, leaving the grid's visual architecture and HTML structure entirely untouched.38

### **8.3 Translating Complex DSLs into the IR via Providers**

An advanced application of the Provider Pattern involves utilizing it to translate external query structures back into the system's internal IR. For instance, if a user submits a raw SQL string to the system, a highly advanced SQLASTProvider can utilize parser generators like ANTLR or JavaCC to lex the SQL text, generate a SQL AST, and subsequently translate that structural tree back into the system's agnostic IR.28

This capability enables extreme interoperability. A user could write a SQL query, and the system could translate it via the IR into a Todoist-style natural language DSL string, or vice versa.74 While parsing complex languages into a generic IR poses significant architectural challenges 73, achieving this bidirectional translation (effectively establishing a symmetric lens between distinct DSLs) provides unparalleled flexibility in enterprise environments. It allows technical analysts to write SQL while enabling business users to manipulate the exact same query using graphical builders or natural language.50

## **9\. Connectivity and Orchestration Matrix**

With the fundamental concepts isolated, the IR specified, and the Providers defined, the final architectural challenge is the composition of the ecosystem. These discrete pieces must interact fluidly at runtime to produce a functioning, responsive application.

### **9.1 The Shell View as the Orchestrator**

Derived from micro-frontend architectural patterns, the Shell View is the primary container and coordinator.2 The Shell View itself possesses no innate business logic; rather, it acts as a layout grid that instantiates and connects the independent conceptual fragments.2

The Shell View manages a centralized State Object (the ViewModel) containing the current IR for Queries, Filters, Sorts, and Groups.2 Communication between the independent concepts relies heavily on Interface-Driven Design and native browser event dispatches, avoiding tightly coupled function calls.2

### **9.2 The Data Hydration Pipeline**

When a user interacts with the application, the architecture executes a precise, unidirectional flow of data:

1. **Initialization:** The Shell View loads, instantiating the required Display concept (e.g., a Data Grid) and establishing the base Query concept.1  
2. **Interaction:** A user types priority: high into a text input element representing the DSL.  
3. **Parsing:** The Shell View captures this input and dispatches the string to a stateless parsing utility. The parser returns a generated Filter IR (AST).  
4. **State Update:** The Shell View updates its central State Object, replacing the old Filter IR with the newly generated tree.  
5. **Event Dispatch:** The Shell View triggers a generic event (e.g., queryStateChanged) notifying the Query concept that execution parameters have been modified.2  
6. **Provider Compilation:** The Query concept combines the Filter IR, Sort IR, and its own base configuration. It passes this unified IR structure to the registered Data Provider.67  
7. **Data Fetching:** The Data Provider generates the required network payload (e.g., a GraphQL query or SQL string) from the IR, executes the fetch against the database, and returns the raw data payload.64  
8. **Data Formatting:** The raw data is passed through the Custom Data concept, where formatters convert timestamps and identifiers into human-readable strings.1  
9. **Rendering:** Finally, the formatted data is handed to the Display concept, which iterates over the array and renders the updated visual output to the screen.1

This precise flow mirrors the classic Pipe and Filter architectural pattern, where data flows unidirectionally through distinct, independent processing stages, preventing state corruption and enabling massive scalability.78

### **9.3 The Derived View concept**

While the Shell View provides dynamic composition, the architecture also supports the Derived View concept.1 A Derived View is a named, statically pre-configured synthesis of the core concepts.1 For example, a "High Priority Tasks" dashboard is simply a Derived View that permanently binds a "Tasks" Query concept to a predefined "Priority=1" Filter concept, presented within a "List" Display concept.

Derived views possess no independent state or unique operational logic; their operational principles are entirely inherited from the composition of their constituent parts.1 In framework suites like Clef Bind, these derivations become specific interface entities, such as named REST resources or CLI subcommand groups, providing predictable, testable access points to complex data aggregations.1

## **10\. Conclusion**

The monolithic view configuration represents an architectural anti-pattern that severely impedes scalability and restricts user interaction paradigms. By systematically decomposing views into independent, first-class concepts—Queries, Filters, Sorts, Groups, Displays, and Custom Data—systems can achieve profound modularity and reusability.

The absolute cornerstone of this architecture is the Intermediate Representation (IR), functioning as an Abstract Syntax Tree that agnostically captures user intent without binding to specific database technologies. Supported by the mathematical rigor of relational algebra and the state-synchronization guarantees provided by Lens Theory and bidirectional transformations, this IR enables fluid, real-time transitions between diverse user interfaces. Users can seamlessly switch between graphical drag-and-drop builders and powerful natural language DSLs without data loss or semantic drift.

Furthermore, by comprehensively implementing the Provider pattern, the framework thoroughly isolates the abstract expression of data criteria from its physical execution. This strict separation of concerns ensures that the frontend presentation layer remains resilient, universally adaptable, and entirely decoupled from the evolving complexities of the underlying backend infrastructure. The resulting architecture is not merely a method of displaying data, but a highly dynamic, composable ecosystem capable of adapting to the most demanding multi-modal enterprise requirements.

#### **Works cited**

1. views-architecture.md  
2. Micro Frontends \- extending the microservice idea to frontend ..., accessed April 2, 2026, [https://micro-frontends.org/](https://micro-frontends.org/)  
3. SPARQLing Database Queries from Intermediate Question Decompositions \- ACL Anthology, accessed April 2, 2026, [https://aclanthology.org/2021.emnlp-main.708.pdf](https://aclanthology.org/2021.emnlp-main.708.pdf)  
4. \[1607.04197\] Design of an intermediate representation for query languages \- arXiv, accessed April 2, 2026, [https://arxiv.org/abs/1607.04197](https://arxiv.org/abs/1607.04197)  
5. Bidirectional Data Transformation by Calculation, accessed April 2, 2026, [https://www.dcc.fc.up.pt/\~hpacheco/publications/phdthesis.pdf](https://www.dcc.fc.up.pt/~hpacheco/publications/phdthesis.pdf)  
6. Bidirectional transformation \- Wikipedia, accessed April 2, 2026, [https://en.wikipedia.org/wiki/Bidirectional\_transformation](https://en.wikipedia.org/wiki/Bidirectional_transformation)  
7. Ecto.Query — Ecto v3.13.5, accessed April 2, 2026, [https://hexdocs.pm/ecto/Ecto.Query.html](https://hexdocs.pm/ecto/Ecto.Query.html)  
8. How to Build a Query Builder with Expression Trees in .NET \- OneUptime, accessed April 2, 2026, [https://oneuptime.com/blog/post/2026-01-25-query-builder-expression-trees-dotnet/view](https://oneuptime.com/blog/post/2026-01-25-query-builder-expression-trees-dotnet/view)  
9. Building Dynamic Filters in Clean Architecture (CQRS) using ExpressionBuilder | ZèD, accessed April 2, 2026, [https://imzihad21.github.io/articles/a/building-dynamic-filters-in-clean-architecture-cqrs-using-expressionbuilder-142](https://imzihad21.github.io/articles/a/building-dynamic-filters-in-clean-architecture-cqrs-using-expressionbuilder-142)  
10. OData Query Options | Mendix Documentation, accessed April 2, 2026, [https://docs.mendix.com/refguide9/odata-query-options/](https://docs.mendix.com/refguide9/odata-query-options/)  
11. Query options overview \- OData \- Microsoft Learn, accessed April 2, 2026, [https://learn.microsoft.com/en-us/odata/concepts/queryoptions-overview](https://learn.microsoft.com/en-us/odata/concepts/queryoptions-overview)  
12. User interface components or design patterns for multiple sort/filter orders, accessed April 2, 2026, [https://ux.stackexchange.com/questions/94071/user-interface-components-or-design-patterns-for-multiple-sort-filter-orders](https://ux.stackexchange.com/questions/94071/user-interface-components-or-design-patterns-for-multiple-sort-filter-orders)  
13. Performing OData Queries \- SAP Learning, accessed April 2, 2026, [https://learning.sap.com/courses/building-odata-services-with-sap-gateway/performing-odata-queries](https://learning.sap.com/courses/building-odata-services-with-sap-gateway/performing-odata-queries)  
14. Best Practices for Usable and Efficient Data table in Applications \- UX Planet, accessed April 2, 2026, [https://uxplanet.org/best-practices-for-usable-and-efficient-data-table-in-applications-4a1d1fb29550](https://uxplanet.org/best-practices-for-usable-and-efficient-data-table-in-applications-4a1d1fb29550)  
15. How to filter and sort data from multiple microservices? \- Stack Overflow, accessed April 2, 2026, [https://stackoverflow.com/questions/48458627/how-to-filter-and-sort-data-from-multiple-microservices](https://stackoverflow.com/questions/48458627/how-to-filter-and-sort-data-from-multiple-microservices)  
16. Filter rows using OData \- Power Apps \- Microsoft Learn, accessed April 2, 2026, [https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/filter-rows](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/filter-rows)  
17. Filters overview | Adobe Workfront, accessed April 2, 2026, [https://experienceleague.adobe.com/en/docs/workfront/using/reporting/reports/report-elements/filters-overview](https://experienceleague.adobe.com/en/docs/workfront/using/reporting/reports/report-elements/filters-overview)  
18. Filter UX Design Patterns & Best Practices \- Pencil & Paper, accessed April 2, 2026, [https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)  
19. Data Grid 2 | Mendix Documentation, accessed April 2, 2026, [https://docs.mendix.com/appstore/modules/data-grid-2/](https://docs.mendix.com/appstore/modules/data-grid-2/)  
20. Find, filter, and sort using natural language with smart grid | Microsoft Learn, accessed April 2, 2026, [https://learn.microsoft.com/en-us/dynamics365/release-plan/2024wave2/sales/dynamics365-sales/find-filter-sort-using-natural-language-smart-grid](https://learn.microsoft.com/en-us/dynamics365/release-plan/2024wave2/sales/dynamics365-sales/find-filter-sort-using-natural-language-smart-grid)  
21. Introducing Holistics Open-source Smart Date Parser, accessed April 2, 2026, [https://www.holistics.io/blog/introducing-holistics-open-source-smart-date-parser/](https://www.holistics.io/blog/introducing-holistics-open-source-smart-date-parser/)  
22. Decoupling UIs from Domain logics | Clean architecture \- Software Engineering Stack Exchange, accessed April 2, 2026, [https://softwareengineering.stackexchange.com/questions/455201/decoupling-uis-from-domain-logics-clean-architecture](https://softwareengineering.stackexchange.com/questions/455201/decoupling-uis-from-domain-logics-clean-architecture)  
23. Data Tables: Four Major User Tasks \- NN/G, accessed April 2, 2026, [https://www.nngroup.com/articles/data-tables/](https://www.nngroup.com/articles/data-tables/)  
24. Micro Applications and Decomposition of UI | by Anil Sharma | trillo-platform \- Medium, accessed April 2, 2026, [https://medium.com/trillo-platform/micro-applications-and-decomposition-of-ui-1062e3b1a345](https://medium.com/trillo-platform/micro-applications-and-decomposition-of-ui-1062e3b1a345)  
25. Relational Algebra, accessed April 2, 2026, [https://db.in.tum.de/\~grust/teaching/ss06/DBfA/db1-03.pdf](https://db.in.tum.de/~grust/teaching/ss06/DBfA/db1-03.pdf)  
26. An easy introduction to relational algebra for developers | by Sumit M. \- Medium, accessed April 2, 2026, [https://medium.com/@sumit\_m/an-easy-introduction-to-relational-algebra-for-developers-c1c55c294416](https://medium.com/@sumit_m/an-easy-introduction-to-relational-algebra-for-developers-c1c55c294416)  
27. An Algebraic View of Databases \- DEV Community, accessed April 2, 2026, [https://dev.to/lovestaco/an-algebraic-view-of-databases-36p8](https://dev.to/lovestaco/an-algebraic-view-of-databases-36p8)  
28. Design and Practice of Self-Developed SQL Parser \- Alibaba Cloud Community, accessed April 2, 2026, [https://www.alibabacloud.com/blog/design-and-practice-of-self-developed-sql-parser\_598414](https://www.alibabacloud.com/blog/design-and-practice-of-self-developed-sql-parser_598414)  
29. Lecture 7: Relational algebra and SQL \- Rasmus Pagh, accessed April 2, 2026, [https://rasmuspagh.net/courses/IDB04/Algebra.pdf](https://rasmuspagh.net/courses/IDB04/Algebra.pdf)  
30. A UI library for a relational language, accessed April 2, 2026, [https://www.scattered-thoughts.net/writing/relational-ui/](https://www.scattered-thoughts.net/writing/relational-ui/)  
31. Properties of Relational Decomposition \- GeeksforGeeks, accessed April 2, 2026, [https://www.geeksforgeeks.org/dbms/properties-of-relational-decomposition/](https://www.geeksforgeeks.org/dbms/properties-of-relational-decomposition/)  
32. The key technologies behind SQL Comprehension | dbt Developer Blog, accessed April 2, 2026, [https://docs.getdbt.com/blog/sql-comprehension-technologies](https://docs.getdbt.com/blog/sql-comprehension-technologies)  
33. How to Write Syntax Tree-Based Domain-Specific Languages in Go \- Better Programming, accessed April 2, 2026, [https://betterprogramming.pub/how-to-write-syntax-tree-based-domain-specific-languages-in-go-b15537f0d2f3](https://betterprogramming.pub/how-to-write-syntax-tree-based-domain-specific-languages-in-go-b15537f0d2f3)  
34. An Intermediate Representation-based Approach for Query Translation using a Syntax-Directed Method, accessed April 2, 2026, [https://thesai.org/Downloads/Volume11No8/Paper\_70-An\_Intermediate\_Representation\_based\_Approach.pdf](https://thesai.org/Downloads/Volume11No8/Paper_70-An_Intermediate_Representation_based_Approach.pdf)  
35. Building Dynamic Filters in Clean Architecture (CQRS) using ExpressionBuilder, accessed April 2, 2026, [https://dev.to/imzihad21/building-dynamic-filters-in-clean-architecture-cqrs-using-expressionbuilder-142](https://dev.to/imzihad21/building-dynamic-filters-in-clean-architecture-cqrs-using-expressionbuilder-142)  
36. Filter using Expression Trees \- Stack Overflow, accessed April 2, 2026, [https://stackoverflow.com/questions/13292123/filter-using-expression-trees](https://stackoverflow.com/questions/13292123/filter-using-expression-trees)  
37. How to pretty-print an AST using Visitor pattern? \- Stack Overflow, accessed April 2, 2026, [https://stackoverflow.com/questions/56305861/how-to-pretty-print-an-ast-using-visitor-pattern](https://stackoverflow.com/questions/56305861/how-to-pretty-print-an-ast-using-visitor-pattern)  
38. Data Grid \- Filter customization \- MUI X, accessed April 2, 2026, [https://mui.com/x/react-data-grid/filtering/customization/](https://mui.com/x/react-data-grid/filtering/customization/)  
39. Best way to add filtering for the data in grid ? dynamic filter fields or filter for each column separatly? \- User Experience Stack Exchange, accessed April 2, 2026, [https://ux.stackexchange.com/questions/81485/best-way-to-add-filtering-for-the-data-in-grid-dynamic-filter-fields-or-filter](https://ux.stackexchange.com/questions/81485/best-way-to-add-filtering-for-the-data-in-grid-dynamic-filter-fields-or-filter)  
40. Engineering bidirectional transformations \- White Rose Research Online, accessed April 2, 2026, [https://eprints.whiterose.ac.uk/id/eprint/129991/1/bx\_paper.pdf](https://eprints.whiterose.ac.uk/id/eprint/129991/1/bx_paper.pdf)  
41. The Weird World of Bi-Directional Programming \- Computer and Information Science, accessed April 2, 2026, [https://www.cis.upenn.edu/\~bcpierce/papers/lenses-etapsslides.pdf](https://www.cis.upenn.edu/~bcpierce/papers/lenses-etapsslides.pdf)  
42. Lenses and Bidirectional Programming in Curry \- Michael Hanus, accessed April 2, 2026, [https://www.michaelhanus.de/lehre/abschlussarbeiten/msc/dylus.pdf](https://www.michaelhanus.de/lehre/abschlussarbeiten/msc/dylus.pdf)  
43. Introduction to Bidirectional Transformations \- University of Oxford Department of Computer Science, accessed April 2, 2026, [https://www.cs.ox.ac.uk/people/jeremy.gibbons/publications/ssbx-intro.pdf](https://www.cs.ox.ac.uk/people/jeremy.gibbons/publications/ssbx-intro.pdf)  
44. Matsuda, K., & Wang, M. (2018). Applicative bidirectional programming mixing lenses and semantic bidirectionalization. Journ \- University of Bristol, accessed April 2, 2026, [https://research-information.bris.ac.uk/ws/files/147585416/Meng\_Wang\_Applicative\_Bidirectional\_Programming.pdf](https://research-information.bris.ac.uk/ws/files/147585416/Meng_Wang_Applicative_Bidirectional_Programming.pdf)  
45. Bidirectional Programming Languages \- ResearchGate, accessed April 2, 2026, [https://www.researchgate.net/publication/40505579\_Bidirectional\_Programming\_Languages](https://www.researchgate.net/publication/40505579_Bidirectional_Programming_Languages)  
46. Bidirectional parsing \- IFL 2014, accessed April 2, 2026, [https://ifl2014.github.io/submissions/ifl2014\_submission\_18.pdf](https://ifl2014.github.io/submissions/ifl2014_submission_18.pdf)  
47. Defining a parser and a (pretty-)printer simultaneously? : r/ProgrammingLanguages \- Reddit, accessed April 2, 2026, [https://www.reddit.com/r/ProgrammingLanguages/comments/14pghf5/defining\_a\_parser\_and\_a\_prettyprinter/](https://www.reddit.com/r/ProgrammingLanguages/comments/14pghf5/defining_a_parser_and_a_prettyprinter/)  
48. Bridging Language Gaps: Advances in Cross-Lingual Information Retrieval with Multilingual LLMs \- arXiv, accessed April 2, 2026, [https://arxiv.org/html/2510.00908v1](https://arxiv.org/html/2510.00908v1)  
49. Combining Query Translation Techniques to Improve Cross-Language Information Retrieval, accessed April 2, 2026, [https://www.researchgate.net/publication/221397822\_Combining\_Query\_Translation\_Techniques\_to\_Improve\_Cross-Language\_Information\_Retrieval](https://www.researchgate.net/publication/221397822_Combining_Query_Translation_Techniques_to_Improve_Cross-Language_Information_Retrieval)  
50. SQL-to-Text Generation with Weighted-AST Few-Shot Prompting \- arXiv, accessed April 2, 2026, [https://arxiv.org/html/2511.13907v1](https://arxiv.org/html/2511.13907v1)  
51. Introduction to filters \- Todoist, accessed April 2, 2026, [https://www.todoist.com/help/articles/introduction-to-filters-V98wIH](https://www.todoist.com/help/articles/introduction-to-filters-V98wIH)  
52. 24 Todoist Filters to Keep You Super Organized, accessed April 2, 2026, [https://www.todoist.com/inspiration/todoist-filters](https://www.todoist.com/inspiration/todoist-filters)  
53. The Ultimate Todoist Setup: Filters, Labels, and Time Sectors \- YouTube, accessed April 2, 2026, [https://www.youtube.com/watch?v=1aXKbT8nvrE](https://www.youtube.com/watch?v=1aXKbT8nvrE)  
54. Filter Assist: AI-Generated Filters in Todoist \- Doist Engineering, accessed April 2, 2026, [https://www.doist.dev/filter-assist/](https://www.doist.dev/filter-assist/)  
55. PxdScript language tutorial series \- Chapter 3 \- Parsing / AST / pretty printing \- peroxide, accessed April 2, 2026, [https://www.peroxide.dk/download/tutorials/pxdscript/chapter3.html](https://www.peroxide.dk/download/tutorials/pxdscript/chapter3.html)  
56. \[DataGrid\] Completely customised UI for (server-based) filterering · Issue \#9782 · mui/mui-x, accessed April 2, 2026, [https://github.com/mui/mui-x/issues/9782](https://github.com/mui/mui-x/issues/9782)  
57. Parsing, ASTs, Pretty Printing, and the Visitor Design Pattern \- Cornell: Computer Science, accessed April 2, 2026, [https://www.cs.cornell.edu/courses/cs2112/2020fa/recitations/06parsing/Recitation6.pdf](https://www.cs.cornell.edu/courses/cs2112/2020fa/recitations/06parsing/Recitation6.pdf)  
58. filePro \- Wikipedia, accessed April 2, 2026, [https://en.wikipedia.org/wiki/FilePro](https://en.wikipedia.org/wiki/FilePro)  
59. SORT/SELECT Processing \- filePro, accessed April 2, 2026, [https://www.fptech.com/fptech/fpmanual/pages/filepro/Sort\_Select\_Processing.htm](https://www.fptech.com/fptech/fpmanual/pages/filepro/Sort_Select_Processing.htm)  
60. OData Version 4.01. Part 2: URL Conventions, accessed April 2, 2026, [https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html)  
61. Basic Tutorial · OData \- the Best Way to REST, accessed April 2, 2026, [https://www.odata.org/getting-started/basic-tutorial/](https://www.odata.org/getting-started/basic-tutorial/)  
62. The Anatomy of a GraphQL Schema \- Nikos Voulgaris, accessed April 2, 2026, [https://nvoulgaris.com/the-anatomy-of-a-graphql-schema/](https://nvoulgaris.com/the-anatomy-of-a-graphql-schema/)  
63. Explaining GraphQL Connections. Edges have never been so fun\! | by Caleb Meredith, accessed April 2, 2026, [https://medium.com/apollo-stack/explaining-graphql-connections-c48b7c3d6976](https://medium.com/apollo-stack/explaining-graphql-connections-c48b7c3d6976)  
64. Mapping Language Overview \- Apollo GraphQL Docs, accessed April 2, 2026, [https://www.apollographql.com/docs/graphos/connectors/mapping](https://www.apollographql.com/docs/graphos/connectors/mapping)  
65. Best practices for data on bidirectional (Relay) edges : r/graphql \- Reddit, accessed April 2, 2026, [https://www.reddit.com/r/graphql/comments/jpwuql/best\_practices\_for\_data\_on\_bidirectional\_relay/](https://www.reddit.com/r/graphql/comments/jpwuql/best_practices_for_data_on_bidirectional_relay/)  
66. design pattern for pluggable communications modules \- Stack Overflow, accessed April 2, 2026, [https://stackoverflow.com/questions/5110736/design-pattern-for-pluggable-communications-modules](https://stackoverflow.com/questions/5110736/design-pattern-for-pluggable-communications-modules)  
67. How to Create API Filtering Patterns \- OneUptime, accessed April 2, 2026, [https://oneuptime.com/blog/post/2026-01-30-api-filtering-patterns/view](https://oneuptime.com/blog/post/2026-01-30-api-filtering-patterns/view)  
68. How to design filters for a generic, pluggable collection? \- Stack Overflow, accessed April 2, 2026, [https://stackoverflow.com/questions/29826040/how-to-design-filters-for-a-generic-pluggable-collection](https://stackoverflow.com/questions/29826040/how-to-design-filters-for-a-generic-pluggable-collection)  
69. The Decoupling Principle For Future-Proof Data Architectures \- Awadelrahman M. A. Ahmed, accessed April 2, 2026, [https://awadrahman.medium.com/the-decoupling-principle-for-future-proof-data-architectures-9c8ace859905](https://awadrahman.medium.com/the-decoupling-principle-for-future-proof-data-architectures-9c8ace859905)  
70. How to Design Decoupled Systems \- Coding Daddy Dobbs, accessed April 2, 2026, [https://codingdaddy.dobbs.technology/2021/02/02/how-to-design-decoupled-systems/](https://codingdaddy.dobbs.technology/2021/02/02/how-to-design-decoupled-systems/)  
71. Deconstructing patterns | Architectural Metapatterns, accessed April 2, 2026, [https://metapatterns.io/analytics/the-heart-of-software-architecture/deconstructing-patterns/](https://metapatterns.io/analytics/the-heart-of-software-architecture/deconstructing-patterns/)  
72. Sorting, Filtering and Grouping With KendoReact Data Grid \- Telerik.com, accessed April 2, 2026, [https://www.telerik.com/blogs/sorting-filtering-grouping-kendoreact-data-grid](https://www.telerik.com/blogs/sorting-filtering-grouping-kendoreact-data-grid)  
73. Translating one DSL to another \- Stack Overflow, accessed April 2, 2026, [https://stackoverflow.com/questions/62250607/translating-one-dsl-to-another](https://stackoverflow.com/questions/62250607/translating-one-dsl-to-another)  
74. SQL Translator is a tool for converting natural language queries into SQL code using artificial intelligence. This project is 100% free and open source. \- GitHub, accessed April 2, 2026, [https://github.com/whoiskatrin/sql-translator](https://github.com/whoiskatrin/sql-translator)  
75. Bridging SQL Dialects: Building a unified translator \- DoorDash, accessed April 2, 2026, [https://careersatdoordash.com/blog/doordash-sql-dialects-unified-translator/](https://careersatdoordash.com/blog/doordash-sql-dialects-unified-translator/)  
76. UI composition \- the blind spot of distributed systems \- Particular Software, accessed April 2, 2026, [https://particular.net/blog/secret-of-better-ui-composition](https://particular.net/blog/secret-of-better-ui-composition)  
77. find \- Find architecture model elements using query \- MATLAB, accessed April 2, 2026, [https://www.mathworks.com/help/systemcomposer/ref/systemcomposer.arch.model.find.html](https://www.mathworks.com/help/systemcomposer/ref/systemcomposer.arch.model.find.html)  
78. Pipe and Filter Architecture \- System Design \- GeeksforGeeks, accessed April 2, 2026, [https://www.geeksforgeeks.org/system-design/pipe-and-filter-architecture-system-design/](https://www.geeksforgeeks.org/system-design/pipe-and-filter-architecture-system-design/)  
79. What is data pipeline architecture? \- Fivetran, accessed April 2, 2026, [https://www.fivetran.com/blog/data-pipeline-architecture](https://www.fivetran.com/blog/data-pipeline-architecture)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAXCAYAAAA/ZK6/AAAAdklEQVR4XmNgGAWDFUgBcQgWLIKsCAQ0gfg/HtyLUMrAYAYVdEUS2wPE/5D4KACkeAKamC9UHANMYsAusZUBuzjDASD+hC7IAFE8BV0QBBqA+C2aWBkQ/0UTQwEgyRggZgTi6UD8EcrGC7SBOACIWdElRgGpAAAduxxe0wEfgAAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAXCAYAAAA/ZK6/AAAAfUlEQVR4XmNgGAWDDfADcQgeLIlQysCwB4j/E8C9MMVlQFwHZbMA8VUo2xOIfaFsFCCGxI4A4nQoeysQyyDJYQUgqxmR2CjuRgdBQPwWiQ/SYIrExwA/gbgViQ/SMB+JjwKMGSAKxJHEQLaBxLACZiC2QxMDuV8YTWwUEAUADt4bCINmmhwAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAXCAYAAADUUxW8AAAAVUlEQVR4XmNgGAVDECgBMTe6IBrIQhdABn+BmB9dEAq+MuCWAwNGBuwGgDQKoYlhBegGEK0RBmAGkKwRBMjWTLaz0TXCAFEGYNMIA3ijiuJEMgpoCQBNcRGp5I4szQAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAYCAYAAAAcYhYyAAAAuUlEQVR4XmNgGAUjALChC5AAGGGMh0D8H4hlEHJEgckMEH3GIA7IEJjgRyBmhvJxAScGhKW+DGiGgADIgFdAvA5JDAb4gPgvEEciiWE1BAZAtoBsA9kKAqeAeCNCGg7wGgICdgwQg7YB8R0GpEBEAgQN0WKgwBBOIP4FxGVIYqCwAgU6KPCRAVZDjgPxeQbstoIAelihGJLEALEdFAPEgFwGiPoYBqghd4FYD1kFCQAUa/rogqNgMAEA8Akn8EU0kvUAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJMAAAAWCAYAAADEmK5+AAAE5ElEQVR4Xu2aT8hVRRTAj5iglIklZOjCQheCSpAoirVRsIhEJEEQxV0RqCCE4EJQadFOBBEi+IiIyD/LILDFgxaFrsOwBAv/LCIDwSCjdH7MHN/5zjdzv3vfd+/H4/l+cHjvnnPn3nvOzJ1zZt4TGTNmzJgx9ZgX5E2vHFFm6utGidfIsSDIOq98miAw/3llht1BbgQ5K/1gnumbB2ZbkO+C/B7kPaPfFORZc9wGbfn6V5BF5tjyaZB3vHI2OCkxiI+S3EnHyMOku/3k7G4guC96pWGFxOfYmY7pYJ7tQpCrSTcIVyRe97L0779d4vNsSLa2acvX56T6+aa7T6foYPIwbaL/xRsaMF/iNXjTPUeDfOuVBg2afwvnJP1ep68DHUTbPyRex/O6RPtP3lAT2u7xSmnf1/NBTjud8oZE/2YddaLn9EppoNVlh8T2uZSBfplXGn6Ucqc+CLLYK6eBlME9SRNVcM77XlkDHYgveYO07+sSqe4XbK94Zde8LfHGdLoHB2Y6mHqSb6+BrwJ7KcB/e0UN6BSuyYxbBefQWU2ZkLxPXflKG2q+HL0g33hl11B88lDMUJ5TEm0fGB0zzM9BPjQ6hYGpUMwitOd8vm829otSDp6iA3m/NwwAqYdrVaUapdTxc4OckFhTHjZ69fUfibMe37cae1e+fi+x/3LskrIfnaFOeFZL1H9hdOTz6+k7ti3G9nHSAemEgO5LuuPpeG2yw90gn5vjHJ9J//lUvp50Rn3+ldi+KtVUcUliYavp+oDEmYiaBt9YgXF9VmD+xenKV2LObJvjVcn3a2doMZoTpla/IiCvPyOxQziHAacQsFvmGLReogj3oKconY6DMvXZWHU2wfo5CDp724J9jcQZR9FUlkuPXfn6rpR90lp4oTc42JdiO6GJZNHOrltsvpU+v5KpTnB8zOl6Qf53OoXzCUYTVko/yLkBWmK5xDZ/ekNC09QqidsCfNdBQTFN24l0zKxLvNDZwYXdx0Tpytc6g+llb+iKnsQb5t6mKmhj30qdUvm0oCsVgVUBJhClXWJNp7karwQBpc1v3iD9NKU1FcJ3TWfMKOi+lFgv8cy5HWjSTaku6srXoRpMGrwmaIpjWldsvaSoM6XVBrbS1M+bb+sxi3ZuE0jNtCnNTKCpkJ1nC7UOeq5RQveCSjN8V77WGUyzkua4CTdruousDti3hXpJO+pm+vT7S6wu7MYl55eKUt7wUscwA7DK9BwKst4rDWy88jylbYFSyj+S9Dk07fv9JY7txmXbvipDU4AfkHzwpoONMNppatSfHnoS316KdLBvFWnhevquVC2XaYf4dMLKMrfhqGkMsXWMRTcsWZGxxLc8n2zWL0XbUcNYfpX+4LUzBPe/l74rbfpqYWugVEbw8pbq1dbILUERv41fxSfSb/dRkNfMsQaFoD5MOn4H8zBLaQdY6ExWTy/I1GecMOd5rknc56mqEXgmBoG/7g/Jfi59epbK5PPxxw9Ifr7AxvU9bfuqcF4pRfZkcl078hCMQfd9cvDLeu5nm2GgbV8ZiLkBqmAjizw1UA/U2ZGuy32vGCLa9pUfekv1FD/0Vu1PjSxt/V2CwFK/DTNt+crip+p/UdialC0jAzVWVWDq4gvkYaQtX4fyz3HDAkEubdyNGjP1da1MXfkps/q33ccru5N20vbBAwAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJgAAAAWCAYAAAA8eFWJAAAFl0lEQVR4Xu2aW6htUxjHP7lERKIQ2uVWbiG3yOWF8ICSB4U6eVFSihBFR/LgxYNOnUJtHkTiUQkPKw8UbyJyKSSK5OVQ7savMb72t/9njDnnWnuttWfnrF99rTm/cVlzjTG+yxhzma1YsWLFivlwcJKrVDkiDk9yripHxCOqCNylijFwTZJ3k3yX5Nagv8zyYM8TFtc/qhwRRyX5VZUVHrA8Xk8kOaDoXt0oXihrST5SZYFn+at8bjsfJvkvyTtJjim66ywvgEtK2byhb/8u5UXLk8b3It+Xe4R26D72yguC78AIWtxkuc5Z5f7kcs9YPuWVejjDNv9OhPvIIUn2lDLkpySHhfLdSZ4M95ELkvygymWCV+Khf7b6Sr/QcvmnWjCAQy23xfspDyd5S5UVaP+bKhPHWS6biH4azrTcB55KeSHJLlUGmDja6pj5c50i+j5et9yO8a7B97S8PWW0jYsuwgK7VpXLAOvkwfrCAHXuVuUA3MJroRX9iaoUKKfeuhYUKENmhX5r7X3CjtCCwB9JnlVlodZnHxgc7W7RgsLbSc5WZeDNJK+oskDaw/MuHTxD18p3qHOsKgcwsfpgu1fs437L9WpWjYegbCsDx+//WpWWDYPcpcVBlr+7tcB+VMUAWAT0iedUTkvyniqFrjF1g5llDmfmNstfOjRM1TjQcmJLznBf0LM5QGj3ebm+PJQTDoaEXCafPjQMwWuWy6LrP9Xys+iulPZXlGu8dny+l8v1WikHkmY8QgtfYMj5UjYrJ1jubyJ6IDTWxiDii4gQXeN3ywa7NLBQHqgvTLV4w/IP9/C3w3LI8Qm803L/j5f7uNXHwl8K9y1oX8u/3Np3Bh0bEazfJ+roUMaC8X6wYp7nUcv1dpT7aN2MDSGriy9tY5G5PLipxnQQjulDvR/PcYfoWtD+RlUWGIOJKheFJ/bILHCMQdtoVedY9kyO518k+gr6vgn0ZLkm7KI0r8NCofa93OOpIutFX6NroiLP297PhmedFe/DwVj78uMIRoTh1MCg2Yn38UyS56aQ23OzzZxk+Yf8ogUFDyGnW/YM0cJ94pkgYBDYAKCLC26S5N9wHxkygZ704q2G4CGYQYyTgiejn4uDDpiMVpimfi3v6+IG23uBTIu2/8zaxzg1+E2tyIC+Fg0WgoeRb7XA8iJhQXmOhnDtHsMnHo9A/sVCqZ0VUaeVxwxZYN9YrlfzgC38WCRaFdfoyJscz1daO+OuBcbRBuNXgzC0lQWGwdOesb7S2rvnFqNZYJ6ktjwYeBjVXRYPqhOmeD7R8j6U9YVI6rQ8YAsPj/F4gUnXHaHvuGLeFaGsZQAYTczvIhPrHtM+Jpa/mwU87W+H7QiRzddRnqS2jih8stTK/eigxvXlU8+/ONuJh61MQsvSwEN4zOmG4Is/wr17Uj/SWC96h81BPGxlclsGQBlerAZ94nmUxyzvcPvgOehjT5JLpWwIXYax1CQf/JCVnSDHDZEjSxmiVu7tOJuJfJXkonLtYRSo/0W5dvqOKZ623L7lAVt4WHceKvc8D69xdhb9xDbCxZplS4y0jik8BNdCDZ6ezY/i3jI+VwsMkXqfaMEAPOzrfDlsgtRZLBweioXhA+DyQSnfXT6V421zfd69xUVKv3+GMgVvVhtw352qdIVj5X3baHd1knvKdVwUcRddOyxloWpYBRY8i5YNgz7jvaGewq73b+t+MwDnWe6rltP2MeSgtRXa90n4wbOewS0az1H7FsQ01DziPKH/0b0q2k54+z/kLcJ2wXnWLlVugSEJ9qy4h2p5Pl5213LDfR7yv2nOeZZJ36RNA/8NW1PlHCGVIXTX4F8fmgPvNzB5rb+gjIGhfzjsY5GLi77ZlNTASMgl+dxvYZHpy+kxwYZgzH+ZZhPT4mZVLIP/AZDNkgsdpcmXAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAVCAYAAAB2Wd+JAAAArUlEQVR4XmNgGBlAGIgfAfF/JAzio4N3DAh5EBsOWqGCvsiCaAAkz4guCNIAkqhCl4CC6UDsii4IApoMEI170CUYIN65iy4IAzwMEI0P0SWA4DUQc6ILIgOQxt9oYkFA3IwmhgFgoQYDoID4i8THCZ4wQDSCnA0C/5Dk8IIDDBCNSkA8H4htUWTxAFhcpgLxdTQ5vAAWlyDMiiaHF8DishhdghDgAOKr6IIjFQAAbqAm08w0s2oAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAXCAYAAADduLXGAAAAqklEQVR4XmNgGD4gFYj/A/ErKP0RiJlRVEDBHiC+giamzwDRhAJssQlCwTd0gSdA/BBdEAowxEGmgjAjugQQ9KILXGdAaHgAxCYosmiAnwGhGBnnICtCBmEMmIp/oqjAAcQZEBpEYIIsQBwB46CBaAaIYkmYgAtUEBvwZYAohoOtQDwJWQAJ3AbiVcgC/xggukGhgQwagPgvsgAHEN8CYk4GzFDYhaRu+AMAdzku5+kvO2YAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPUAAAAWCAYAAAAYYdpJAAAGqklEQVR4Xu2cW6itUxSAh1wi5FoIbbeUWxQR4Ymi8IAHQu0HJ5JShCg6yIM3eTkltUkieZMS0ooX8Saig9rkUoSXQzmu8zPnOHuuscf8//nvtdbeq7PmV6P9/2Ne1lz/nGPOMeb81xZpNBqNRqPRGMr+QS63yjni9CBHWuWccpHE5zkPPGQVjcWAAfi3Vc4RFwZ5xyoN+wR5LMg3Qe7L9M9l15vJr0EOs8otYCnIR1bZmC2PSxyI/yb5Pt0ju5Puuz25ZwMGfZRVJp6X8fZ9m+4RyqH7WDPPgEMkfkYX90jMc2K6PzPdfxXkFs3UA55A/j0R7nMOCLIrpSE/BjloLMcaNe0u8XaQX2Ttc7h+cCyHyCMpTeXd8eQxdgR5wiobs0c7x8KgQf+FTRjAgRLruNgmSBwsb1qlA+V/s8rAMRLTRkY/hDMk1uGtbHzvq6wy47og/1hl4GyJdR5hE3p4TWK5821CAo+g1qt5NcjTVjmA0phQ7g7ygFU60GbqKU1AjRmgs/rI6JW+zu2DgU/5g22CRP3xVmkgnXwrNiExafuo1yuvE0YXpN9hlYm+sh5McpS73iYk3gpyllUWOFo21gal67nuJ/WTC7wR5GWrbMyOqyV2HsZnYaXp6twaRuKXZzXy9JZ7JebzVq9TJKb9YRMGgAeAq2zB2LviQX02nlGzOnWVLXGFxDq9WPy0IO9ZZQ/URZ0b4WeJ5b3J+MMgJ1llB7V93ZgSbALxwFmxLcRCpN2Z6ejkz4PclekUJgjlxiSUJz/Xl2TpuJqfZvclMDjqwFAsuJikXZnpLpAYjxLb5uwb5Nx0zeZc3r6X0vVSSoc/xTdYJZ/wMLhpcJzE+kZGD6yM3jPo4n3p3+QrMZLYFtqUg6fwutH1oS443k9jE9CBadFY88VMR9y5M12TdmmW9mTSgRrNbUn3aLo/J6XDD0FeyO5LUN6Lp3VV257pbpB4jKIrA26iwuetpmtcU9rzsMR8y+kevYLe8w5yaJc+P5Wbx3IMQ0Mh2pqDW36r0dVAn3jPrgb6xvYxsIcwdHIB6rrWKhvTh1XXDkqV32X9rvQHEg1F41wMX2Egsjudo/E0m2UW9HZX1aJxrSfs/lrXkDaDxqY53GPEOStJb1HjsquUB/Gibdsku71ah8IEyRHVRsCIvO9XAzv3lM37iO/lhWk1MLnY529hsnh2oJzwf8nGHtToutzMHN0JZtPDDhbPaEbi7w4D+ftmbjXOmriQAaGeADH2Z1maxt52ADDQvBBAXWsvJOlim8Rype9cgzVqvoedXIGQo8/TmcSo1dshNAGeBUeeOexo69Hi19K9gvOs+9rbmAIjiR2Su501UIaYWFGj4W8OOlYyjxqjXpWYz1vpS+iubyk0UDTO8ya0Q6XbqHn7rZSGx2I/awj5BtVlsn7X/3CJ+xkYW5+RTGLU+hx1ExGDtsd+X2bXtPOn7N7SjHqToNOGdrq63nm86RmNurClVZa0PvebPENXPV3d81UDQ7Nxqq5E3oTW536zuufxeg4rlrf61zKStc/u+u4YSJ+RTGLUQFmMEY/OO/Mm/aZ0rXswJWblftuFZKHR1Wjo0YsOlHylwmBYYWA1/bXn05y95i+gkL9rUOIqUz73CGoYyfrBxf0z6VqNeyXpFY6R8pWItNJGWWkywNBJ83bDeQvrVKt0oB3UsUvie9wlaoza2yijP/RZ9EE7kK7JRdH+LkFan2fWmJBliQ/acz+7OFnGBzXvRnM/kjio2UyDfLOKzZ6d6VrpO9J6SmL50kpfYruMDy5mcx1QGKmuLCNZG/BLEvPllI601C21r3ECG1q2HlCvoGvQK0x+5PvEJhhqjJojLRv+4ElQ/4rRe7DxSN6aF16IrRkLHhrqeBNhYwroSmDFxktdqMEh9wc5L7vHgIGO3J10vKxgYdX2Brmem1spubsexHpajveqtb25IeY7/97KxWag58Vg6BydXSPr24i+BLv1f0k5Flc4S6cufY4laoyaeuyRlPYVxt0H8XTNOTd5qLdEe/lkgaCj+14T3SrUI5kmdtWchD6jVo+iRI2x1oBncmy69jwb4HszSTYWAM49a37QsVWw49v1g46h2HP8Segzat62K52X8528H9gMZTnI7bL2dp63+qvr3ed5NPYiiMW8c9h5gJCka7Ubwisy/hrqRtGd+VzsLj15Sj+4mORlFotth2fUO6Tu11yNvQgGWWkAzgM1/yShhmkYdC1d/ySBd+BZPTcDvrO3L9FYADDs9u+MpgNv1c2Lq+v96KcxZf4Dofbo67zhiyAAAAAASUVORK5CYII=>