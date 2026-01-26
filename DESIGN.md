# Architecture Design Document

This document describes the software architecture of the Salesforce Git Merge Driver.

## Overview

The merge driver implements a three-way merge algorithm specifically designed for Salesforce metadata XML files. It parses XML into JSON, performs intelligent merging based on metadata structure, and outputs the merged result back to XML.

## Design Patterns

### Strategy Pattern

The merge logic uses the **Strategy Pattern** to handle different merge scenarios. Each scenario (based on which versions have content) has its own strategy implementation.

```
┌─────────────────────┐
│  ScenarioStrategy   │ (interface)
├─────────────────────┤
│ + execute(context)  │
└─────────────────────┘
          △
          │ implements
          │
    ┌─────┴─────┬─────────────┬─────────────┬─────────────┐
    │           │             │             │             │
┌───┴───┐ ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐
│ None  │ │ LocalOnly │ │ OtherOnly │ │ AllPresent│ │    ...    │
│Strategy│ │ Strategy  │ │ Strategy  │ │ Strategy  │ │           │
└───────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘
```

**Strategies:**
- `NoneStrategy` - No content in any source
- `LocalOnlyStrategy` - Only local has content
- `OtherOnlyStrategy` - Only other has content
- `AncestorOnlyStrategy` - Only ancestor has content (deleted in both)
- `LocalAndOtherStrategy` - Both added (no ancestor)
- `AncestorAndLocalStrategy` - Other deleted
- `AncestorAndOtherStrategy` - Local deleted
- `AllPresentStrategy` - Full three-way merge

### Composite Pattern

The merge nodes implement the **Composite Pattern** to handle different data structures uniformly.

```
┌─────────────────────┐
│     MergeNode       │ (interface)
├─────────────────────┤
│ + merge(config)     │
└─────────────────────┘
          △
          │ implements
          │
    ┌─────┴─────┬─────────────────┬─────────────────┐
    │           │                 │                 │
┌───┴───────┐ ┌─┴───────────────┐ ┌┴────────────────┐
│ TextMerge │ │ KeyedArrayMerge │ │ TextArrayMerge  │
│   Node    │ │      Node       │ │      Node       │
└───────────┘ └─────────────────┘ └─────────────────┘
```

**Node Types:**
- `TextMergeNode` - Handles scalar/primitive values
- `KeyedArrayMergeNode` - Handles arrays of objects with key fields (e.g., `fieldPermissions` with `field` key)
- `TextArrayMergeNode` - Handles arrays of primitive values (e.g., `members` in package.xml)
- `ObjectMergeNode` / `NestedObjectMergeNode` - Handles nested object structures

### Factory Pattern

The `MergeNodeFactory` creates the appropriate node type based on the data structure:

```typescript
interface MergeNodeFactory {
  createNode(ancestor, local, other, attribute): MergeNode
}
```

Decision logic:
1. If any value is a string array → `TextArrayMergeNode`
2. If any value is an object → `KeyedArrayMergeNode`
3. Otherwise → `TextMergeNode`

## Core Components

### MergeOrchestrator

The central coordinator that:
1. Determines the merge scenario using `MergeScenarioFactory`
2. Applies early termination optimization when all inputs are equal
3. Selects the appropriate strategy via `ScenarioStrategyFactory`
4. Builds the `MergeContext` and executes the strategy

```typescript
class MergeOrchestrator {
  merge(ancestor, local, other, attribute?, rootKey?): MergeResult
}
```

### MergeContext

Immutable context object passed to strategies:

```typescript
interface MergeContext {
  readonly config: MergeConfig
  readonly ancestor: JsonValue
  readonly local: JsonValue
  readonly other: JsonValue
  readonly attribute: string | undefined
  readonly nodeFactory: MergeNodeFactory
  readonly rootKey: RootKeyInfo | undefined
}
```

### MergeScenario

Enum representing the 8 possible scenarios based on content presence:

| Scenario | Ancestor | Local | Other | Value |
|----------|----------|-------|-------|-------|
| NONE | - | - | - | 0 |
| OTHER_ONLY | - | - | ✓ | 1 |
| LOCAL_ONLY | - | ✓ | - | 10 |
| LOCAL_AND_OTHER | - | ✓ | ✓ | 11 |
| ANCESTOR_ONLY | ✓ | - | - | 100 |
| ANCESTOR_AND_OTHER | ✓ | - | ✓ | 101 |
| ANCESTOR_AND_LOCAL | ✓ | ✓ | - | 110 |
| ALL | ✓ | ✓ | ✓ | 111 |

### Conflict Handling

When conflicts cannot be auto-resolved, the driver generates zdiff3-style conflict markers:

```xml
<<<<<<< ours
    <field>localValue</field>
||||||| base
    <field>originalValue</field>
=======
    <field>remoteValue</field>
>>>>>>> theirs
```

The `ConflictMarkerBuilder` constructs these markers, and `ConflictMarkerFormatter` handles post-processing (entity escaping, indentation correction).

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  XML Input  │────▶│ JSON Parse  │────▶│   Merge     │
│  (3 files)  │     │ (fast-xml)  │     │ Orchestrator│
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
         ┌─────────────────────┐
         │  Scenario Strategy  │
         │  (based on content) │
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│   MergeNode     │   │ ConflictMarker  │
│   (recursive)   │   │    Builder      │
└────────┬────────┘   └────────┬────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │   XML Output        │
         │   (merged file)     │
         └─────────────────────┘
```

## Key Design Decisions

### 1. JSON Intermediate Representation

XML is converted to JSON for easier manipulation. The `fast-xml-parser` library preserves:
- Element order
- Attributes (prefixed with `@_`)
- Text content (stored in `#text` property)

### 2. Key-Based Array Merging

Salesforce metadata arrays (like `fieldPermissions`) use semantic keys rather than position-based merging. The driver identifies key fields from metadata configuration to match elements across versions.

### 3. Early Termination Optimization

When all three inputs are deeply equal, the merge returns immediately without traversing the structure. This significantly improves performance for unchanged files.

### 4. Immutable Context

The `MergeContext` is immutable, ensuring strategies cannot accidentally modify shared state.

### 5. Configurable Conflict Markers

Conflict marker size and labels are configurable via Git's standard parameters (`-L`, `-S`, `-X`, `-Y` flags), allowing integration with existing Git workflows.
