# Monitoring extensions

A monitoring extension connects OpenEverest instances to one monitoring technology, such as PMM, Prometheus or VictoriaMetrics. The OpenEverest core contains no monitoring backend: every monitoring technology is added by an extension, in the same way that every data technology is added by a [provider](providers.md).

:::info[Work in progress]

The monitoring extension API was added after OpenEverest 2.0.0 Developer Preview 4 and is still evolving.

:::

## What an extension contains

A monitoring extension is a Helm chart with:

- a cluster-scoped **`MonitoringClass`**, which names the technology, declares the parameters and authentication modes a `MonitoringDestination` of that class accepts, and says how the class is fulfilled;
- a **controller** that claims the class, checks every destination of the class (reachability, credentials, server version), and — for extension-managed classes — configures the collection for each instance.

Users then create `MonitoringDestination`s of the class and reference them from their instances. See [Monitoring](../use/monitoring.md).

## Provider-managed and extension-managed classes

Monitoring is a contract between three parties: the core, the provider of the instance and the monitoring extension.

- **Provider-managed classes** are fulfilled by the provider. The provider declares in `Provider.spec.monitoring.integrations` which operator-native integrations it can render, for example `pmm` with a range of supported agent versions. When an instance sends to a destination of such a class, the provider configures its Operator to run the agent, using the agent image named by the class. The extension only checks destinations.
- **Extension-managed classes** are fulfilled by the extension. The provider declares in `Provider.spec.monitoring.componentTypes` what each component exposes — native metrics, metrics through an exporter, or none — and publishes the actual endpoints of each instance in `Instance.status.monitoring.sources`. The extension's controller turns them into the configuration of its backend, for example one Prometheus `PodMonitor` per component.

The core connects the two: for every instance entry it creates a `MonitoringBinding`, decides whether the provider and the class are compatible and in which mode, and reports the result on the binding and on the instance. Each condition has exactly one writer, and extensions never write `Instance` resources.

## Build a monitoring extension

The `provider-runtime/monitoring` package of the [openeverest repository](https://github.com/openeverest/openeverest) contains the helpers an extension's controller uses to claim a class and to report the status of destinations and bindings. The existing extensions in the [openeverest GitHub organization](https://github.com/openeverest), such as [monitoring-prometheus](https://github.com/openeverest/monitoring-prometheus), are working examples.

A monitoring extension also needs to respect the provider contract:

- declare every `MonitoringClass` it installs and the mode in which each class is fulfilled;
- validate the destination parameters and authentication modes declared by the class;
- write only the status it owns — destination `Ready` and binding `Configured`;
- for an extension-managed class, require only the metrics or connection capabilities published by the provider;
- for a provider-managed class, match the operator-native integration and supported agent versions declared by the provider.

The API types and CRD reference are documented in [Monitoring custom resources](../crd/monitoring.md). The foundational API was introduced in [openeverest/openeverest#3440](https://github.com/openeverest/openeverest/pull/3440).

## Publish to the Hub

Publish the chart to an OCI registry, then add an integration formula at `extensions/integrations/<slug>/` in the [Hub repository](https://github.com/openeverest/hub). A monitoring formula has `metadata.type: integration` and an `integration` block in `spec`:

```yaml
metadata:
  type: integration

spec:
  integration:
    area: monitoring
    monitoring:
      classes: [prometheus]
      executionModes: [ExtensionManaged]
      requires:
        metrics: true
```

| Field | Meaning |
| --- | --- |
| `area` | The integration area. Monitoring is the currently supported area. |
| `classes` | The `MonitoringClass` names installed by the chart. |
| `executionModes` | How the classes are fulfilled: `ProviderManaged`, `ExtensionManaged`, or both. |
| `requires.metrics` | The providers' components must publish metrics endpoints. Use for extension-managed metric collectors. |
| `requires.connection` | The providers must publish connection endpoints and accept pod annotations. Use for external agents that discover database connections. |
| `nativeIntegration` | The operator-native integration name required by a provider-managed class, matched against `Provider.spec.monitoring.integrations`. |

Declare the chart, version, and Helm release settings under `spec.artifacts` and `spec.install`, and put external services — for example a PMM server or Prometheus Operator — in `spec.install.prerequisites`. The Hub formula describes discovery and installation; the external monitoring system is not part of the extension's controller chart.

The [monitoring formulas in the Hub](https://github.com/openeverest/hub/tree/main/extensions/integrations) are working examples. See [Plugin Hub](hub.md#publishing-an-extension) for the complete publishing flow.
