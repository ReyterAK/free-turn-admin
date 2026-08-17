# FreeTurn Admin

# Coding Style

Release 0.5 Final

---

# Architecture

The project uses a layered architecture.

```
UI
    ↓
UI Bridge
    ↓
UI Modules
    ↓
Store Layer
    ↓
Entity Layer
    ↓
ApiClient
    ↓
REST API
    ↓
Backend
```

---

# Layers

## UI Modules

Responsible only for UI logic.

Allowed:

- Store
- SchemaEntityLayer

Forbidden:

- EntityLayer
- fetch()
- direct API calls

---

## Store Layer

Responsible for application state.

Allowed:

- EntityLayer

Forbidden:

- DOM
- HTML rendering

---

## Entity Layer

Responsible for business operations.

Allowed:

- ApiClient

Forbidden:

- DOM
- Store
- HTML

---

## ApiClient

Single HTTP transport.

All REST requests go through ApiClient.

No fetch() anywhere else.

---

# Module Layout

Every UI module must follow this structure.

```javascript
const XxxModule = {

    //
    // lifecycle
    //

    async init() {

    },

    bindEvents() {

    },

    //
    // data
    //

    async refresh() {

    },

    render() {

    },

    //
    // helpers
    //

    //

    //
    // actions
    //

};
```

---

# Naming

Use only these names.

Lifecycle

- init()
- bindEvents()

Data

- refresh()
- render()

Helpers

- renderRow()
- helper methods

Actions

- add()
- edit()
- remove()
- save()
- restart()
- open()
- close()
- submit()

---

# Store API

Every Store exposes

```javascript
refresh()

get()

subscribe()
```

No

- load()
- reload()
- fetch()
- init()

---

# Entity API

Entity Layer uses business names.

Examples

```javascript
getAll()

add()

update()

remove()

restart()
```

---

# Logging

Initialization log goes at the end of init().

Example

```javascript
console.log(
    "[ClientsModule] initialized"
);
```

---

# DOM

Never cache DOM globally.

Lookup inside methods.

Example

```javascript
const table =
    document.getElementById(
        "clients-table"
    );
```

---

# HTML

HTML communicates only with uiBridge.

Never call modules directly from HTML except through uiBridge compatibility functions.

---

# Formatting

Use vertical formatting.

Example

```javascript
const clients =
    ClientStore
        .get()
        .slice()
        .sort(...);
```

Avoid long horizontal chains.

---

# Goal

Code should be readable after six months without additional comments.