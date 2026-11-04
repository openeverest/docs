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
