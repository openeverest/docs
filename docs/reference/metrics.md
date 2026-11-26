# OpenEverest metrics

The OpenEverest controller exposes Prometheus metrics about everything OpenEverest manages in the cluster: providers and plugins, monitoring and backup integrations, instances, backups and restores. Use them to count instances, find the ones that need attention, alert on missing backups, or see how many resources your instances request.

These metrics describe OpenEverest objects. Metrics of the database engines themselves come from [monitoring extensions](../use/monitoring.md).

## Scrape the metrics

The controller serves the metrics at `https://everest-controller-metrics.everest-system.svc:8443/metrics`. Clients must authenticate with a Kubernetes token that is allowed to `get` the `/metrics` URL. The chart creates the `everest-metrics-reader` ClusterRole for that: bind it to the service account your Prometheus runs as.

```sh
kubectl create clusterrolebinding prometheus-everest-metrics \
  --clusterrole=everest-metrics-reader \
  --serviceaccount=<prometheus-namespace>:<prometheus-service-account>
```

With the Prometheus Operator, the chart can create the ServiceMonitor too:

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --reuse-values \
  --set controller.metrics.serviceMonitor.enabled=true \
  --set controller.metrics.serviceMonitor.labels.release=<your-prometheus-release>
```

The controller serves a self-signed certificate, so the ServiceMonitor skips certificate verification.

:::warning

The metrics name every namespace, instance and backup storage in the cluster. Anyone allowed to read them sees the whole inventory, whatever their OpenEverest permissions.

:::

To turn the endpoint off, set `controller.metricsBindAddress` to `"0"`.

Only the controller replica that holds the leader election lease reports the inventory, so scraping every replica gives one copy of each series. The other replicas report `openeverest_build_info` only.

The series carry no cluster label. To tell clusters apart, add one when you scrape, for example with Prometheus `external_labels`.

## Metrics

Every metric is a gauge. For a status, such as a phase or a condition, there is one series per possible value: `1` for the current one and `0` for the others.

Instances, namespaces and providers are named by the `openeverest_instance`, `openeverest_namespace` and `openeverest_provider` labels, the same labels providers put on database metrics. They don't collide with the `instance` and `namespace` labels Prometheus adds to every series it scrapes, and they let you join OpenEverest metrics with database metrics.

### Build

| Metric | Labels | Description |
| --- | --- | --- |
| `openeverest_build_info` | `version`, `contract_version` | Always 1. |

### Providers and plugins

| Metric | Labels | Description |
| --- | --- | --- |
| `openeverest_extension_info` | `type`, `name`, `version` | An extension installed from a catalog (`InstalledExtension`). |
| `openeverest_extension_phase` | `type`, `name`, `phase` | Its phase: `Pending`, `Installed`, `Upgrading`, `Failed` or `Uninstalling`. |
| `openeverest_provider_info` | `openeverest_provider`, `contract_version` | A provider, however it was installed. |
| `openeverest_provider_condition` | `openeverest_provider`, `condition`, `status` | Each condition of a provider. |

### Monitoring and backup integrations

| Metric | Labels | Description |
| --- | --- | --- |
| `openeverest_class_info` | `kind`, `name`, `controller` | A `MonitoringClass`, `BackupClass` or `BackupStorageClass`. `controller` is the monitoring class's controller, or the provider that runs a provider-managed backup class. |
| `openeverest_class_accepted` | `kind`, `name`, `status` | Whether a class is accepted. |
| `openeverest_backup_storage_info` | `openeverest_namespace`, `name`, `class` | A backup storage. |
| `openeverest_monitoring_destination_info` | `openeverest_namespace`, `name`, `class` | A monitoring destination. |
| `openeverest_monitoring_destination_ready` | `openeverest_namespace`, `name`, `status` | Whether a monitoring destination is ready. |

### Instances

| Metric | Labels | Description |
| --- | --- | --- |
| `openeverest_instance_info` | `openeverest_namespace`, `openeverest_instance`, `openeverest_provider`, `version` | An instance. `version` is the version it runs, or the one its spec asks for until the provider reports. |
| `openeverest_instance_phase` | `openeverest_namespace`, `openeverest_instance`, `phase` | Its lifecycle phase: `Pending`, `Provisioned` or `Terminating`. The phase says nothing about health: alert on conditions instead. |
| `openeverest_instance_condition` | `openeverest_namespace`, `openeverest_instance`, `condition`, `status` | The summary conditions `Ready`, `Available`, `Stalled`, `NeedsAttention` and `Unattended`. |
| `openeverest_instance_component_replicas` | `openeverest_namespace`, `openeverest_instance`, `component`, `kind` | Pods of a component as the provider reports them: `desired`, `current` and `ready`. |
| `openeverest_instance_resource_requests` | `openeverest_namespace`, `openeverest_instance`, `component`, `resource` | CPU (cores), memory (bytes) and storage (bytes) a component requests, times its replicas. |
| `openeverest_instance_resource_limits` | `openeverest_namespace`, `openeverest_instance`, `component`, `resource` | CPU (cores) and memory (bytes) limits of a component, times its replicas. |
| `openeverest_instance_pitr_available` | `openeverest_namespace`, `openeverest_instance`, `storage` | Whether the point-in-time recovery window on a backup storage is available. Only for storages with PITR enabled. |
| `openeverest_instance_last_successful_backup_timestamp_seconds` | `openeverest_namespace`, `openeverest_instance`, `storage` | When the latest successful backup to a backup storage completed. |

Resources come from the instance spec, so they are a lower bound: components the provider adds by default, sidecars and exporters aren't counted, and neither are resources a spec doesn't set.

### Backups and restores

| Metric | Labels | Description |
| --- | --- | --- |
| `openeverest_backups` | `openeverest_namespace`, `openeverest_instance`, `storage`, `state` | Number of backups in each state. `openeverest_instance` is empty for imported backups. |
| `openeverest_restores` | `openeverest_namespace`, `openeverest_instance`, `state` | Number of restores in each state. |

## Examples

Instances per provider:

```promql
count by (openeverest_provider) (openeverest_instance_info)
```

Instances that are not ready:

```promql
openeverest_instance_condition{condition="Ready", status="true"} == 0
```

Instances without a successful backup in the last 25 hours:

```promql
time() - openeverest_instance_last_successful_backup_timestamp_seconds > 25 * 3600
```

CPU requested per namespace:

```promql
sum by (openeverest_namespace) (openeverest_instance_resource_requests{resource="cpu"})
```
