# How OpenEverest works

This page describes what gets installed and which component does what. Knowing this makes it easier to find the right logs when something goes wrong.

## What gets installed

OpenEverest is technology-agnostic: the core installs no database operator, no monitoring stack and no backup tooling. Everything technology-specific comes from extensions that you install separately.

| Release | Installed with | Namespace | Components |
| --- | --- | --- | --- |
| Core (`everest-core`) | `openeverest/openeverest` chart | `everest-system` | `everest-server`, `everest-controller`, the Plugin Hub, the OpenEverest CRDs |
| Each provider | The provider's chart | `everest-system` | The provider controller, usually the Kubernetes Operator it drives, its `Provider` resource, backup classes and presets |
| Each monitoring extension | The extension's chart | `everest-system` | A controller and the `MonitoringClass` it serves |
| Each generic plugin | The plugin's chart | `everest-system` | The plugin's `Plugin` resource and, optionally, a backend |

- **`everest-server`** serves the UI and the REST API. It authenticates users, checks RBAC, and reads and writes OpenEverest custom resources.
- **`everest-controller`** runs the technology-agnostic controllers: backup storages, backups, restores, backup imports, monitoring bindings and plugin registration.
- **`<release>-plugin-hub`** (for example `everest-core-plugin-hub`) is the [Plugin Hub](../extend/hub.md) plugin.

## What happens when you create an instance

1. You log in and get an access token.
2. You create an instance in the UI or through the API. `everest-server` checks your permissions and creates an `Instance` resource.
3. The provider named in `spec.providerRef` sees the new `Instance` and creates the resources of its Kubernetes Operator — for example a `PerconaPGCluster` for the PostgreSQL provider.
4. The Operator creates the pods, volumes and services.
5. The provider reports the progress in the `Instance` status: phase, conditions, ready pods per component and connection details.

Backups and restores follow the same pattern: you create a `Backup` or `Restore`, `everest-controller` validates and tracks it, and the provider has its Operator carry it out.

Monitoring works through bindings: when an instance lists a monitoring destination, `everest-controller` creates a `MonitoringBinding`, and either the provider or a monitoring extension configures the collection. See [Monitoring](../use/monitoring.md).

## Where versions and forms come from

Each provider ships its supported versions, topologies and UI schema in its `Provider` resource. OpenEverest reads them from there; it does not query an external version service. To get new versions, upgrade the provider.

## Logs to check

Start with `everest-server` for UI, API and permission errors, then the provider for problems with instances, then the Operator. See [Diagnostics](troubleshoot.md) for the commands.
