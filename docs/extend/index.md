# Extend OpenEverest

OpenEverest v2 is built on a modular, extensible architecture. Rather than baking every database technology and feature directly into the core, v2 provides complementary extension types that let developers, operators, and the community bring new capabilities to the platform — without forking or modifying the core.

This shift was a deliberate design goal: integrate a new database technology in days, not months.

## Extension types

### Providers

A **Provider** is a self-contained plugin that teaches OpenEverest how to manage a specific technology. It encapsulates the reconciliation logic for an operator, defines the available components and deployment topologies, and ships the UI schema that generates the create/edit forms in the OpenEverest interface.

Providers are installed independently of the OpenEverest core and can be upgraded on their own release cycle.

→ [Learn about Providers](providers.md)

### Generic Plugins

A **Generic Plugin** extends OpenEverest with new functionality beyond database provisioning. A plugin can contribute UI pages, sidebar entries, database detail panels, backend API logic, and CLI subcommands — all without rebuilding or redeploying the OpenEverest core.

Generic Plugins cover use cases like SQL query browsers, AI data copilots, external database discovery, data migration tools, and compliance/audit tooling.

→ [Learn about Generic Plugins](generic-plugins.md)

### Monitoring extensions

A **monitoring extension** connects instances to one monitoring technology, such as PMM or Prometheus. It installs a `MonitoringClass` and the controller that serves it. The core installs no monitoring backend of its own.

→ [Learn about monitoring extensions](monitoring-extensions.md)

### Plugin Hub

The **Plugin Hub** is the central catalog for discovering and installing Providers and Generic Plugins. It combines a community-maintained registry with an in-product browser that shows which extensions are available and which are already installed on your cluster.

→ [Learn about the Plugin Hub](hub.md)

## Architecture overview

The diagram below shows how providers and generic plugins relate to the OpenEverest core:

```mermaid
graph TB
  subgraph OpenEverest Core
    API[API Server]
    UI[Web UI Shell]
  end

  subgraph Providers
    P[Provider Plugin\nreconciles Instance CRD]
  end

  subgraph Generic Plugins
    GPF[Plugin Frontend Bundle]
    GPB[Plugin Backend Pod]
  end

  subgraph Third-party
    OP[Database Operator]
    TR[Operator-managed resources]
  end

  UI -->|discovers & loads| GPF
  API -->|proxies requests to| GPB
  P -->|creates & manages| TR
  OP -->|reconciles| TR
  API -->|Instance CRD| P
```

## Specifications and further reading

The full architectural specifications are maintained in the [openeverest/specs](https://github.com/openeverest/specs) repository:

- [Spec 001 — Modular core / Provider plugins](https://github.com/openeverest/specs/blob/main/specs/001-plugins-architecture.md)
- [Spec 003 — Generic plugins](https://github.com/openeverest/specs/blob/main/specs/003-generic-plugins.md)
