# Instance

An `Instance` is one running deployment of a technology. It is namespaced and references a cluster-scoped `Provider`, which reconciles it.

## Example

```yaml
apiVersion: core.openeverest.io/v1alpha1
kind: Instance
metadata:
  name: orders-db
  namespace: demo
spec:
  providerRef:
    name: provider-percona-postgresql
  version: 18.4-1
  topology:
    type: cluster
  components:
    engine:
      replicas: 3
      resources:
        requests:
          cpu: "1"
          memory: 2Gi
        limits:
          cpu: "1"
          memory: 2Gi
      storage:
        size: 50Gi
        storageClass: fast-ssd
    proxy:
      type: pgbouncer
      replicas: 2
      service:
        serviceType: LoadBalancer
  backup:
    enabled: true
    classRef:
      name: pg
    storages:
      - storageRef:
          name: s3-backups
        schedules:
          - name: daily
            enabled: true
            cron: "0 2 * * *"
            retention:
              type: count
              count: 7
        pitr:
          enabled: true
  deletionPolicy: Cascade
```

## Spec

| Field | Description |
| --- | --- |
| `providerRef.name` | **Required.** Name of the `Provider`. List them with `kubectl get providers`. |
| `version` | Version bundle to deploy. Defaults to the provider's `defaultVersion`. |
| `topology.type` | Topology, as defined by the provider in `spec.topologies`. When omitted, the provider decides; set it explicitly when the provider offers more than one. |
| `topology.parameters` | Topology-level settings defined by the provider. |
| `parameters` | Instance-level settings defined by the provider. |
| `components` | Map of component name to [component settings](#components). Valid names depend on the provider and topology. |
| `backup` | Backup class, storages, schedules and point-in-time recovery. See [Backups and restores](backups.md). |
| `dataSource` | Create the instance from a backup or a point in time. See [Create an instance from a backup](../backups_and_restore/create_from_backup.md). |
| `monitoring.destinations` | Up to 8 monitoring destinations to send to, each with a `name`, a `destinationRef.name` and optional `parameters`. See [Monitoring](monitoring.md). |
| `userSecretRef.name` | Secret with the initial credentials, for providers that support it. Immutable. When omitted, the provider generates credentials. |
| `maintenance` | How disruptive changes are approved. See [Maintenance](#maintenance). |
| `deletionPolicy` | What happens to the instance's `Backup` and `Restore` resources when it is deleted: `Cascade` (default) deletes them, `Orphan` keeps them. |

Fields you omit get the provider's defaults.

### Components

Each entry in `spec.components` configures one component. The provider decides which fields each component supports — see the topology's `supportedFields` in the `Provider`.

| Field | Description |
| --- | --- |
| `type` | Component type, when the provider offers several — for example the proxy type. |
| `version`, `image` | Override the version or image of this component. |
| `replicas` | Number of pods. |
| `resources` | CPU and memory requests and limits, as in a Kubernetes container. |
| `storage.size`, `storage.storageClass` | Size and StorageClass of the data volumes. |
| `service.serviceType` | How the component is exposed: `ClusterIP`, `NodePort` or `LoadBalancer`. `service.annotations` and `service.loadBalancerService` configure the service further. |
| `schedulingPolicy` | `nodeSelector`, `affinity`, `tolerations`, `topologySpreadConstraints` and `schedulerName`. See [Pod scheduling](../administer/pod_scheduling.md). |
| `parameters` | Component settings defined by the provider, such as engine configuration. |

### Maintenance

Some changes need a restart or downtime — for example, the new images that a provider upgrade brings. `spec.maintenance` decides which of them the provider applies on its own:

| Field | Description |
| --- | --- |
| `maintenance.autoApproveUpTo` | The most disruptive change applied automatically: `NonDisruptive` (default), `RollingRestart` or `Downtime`. |
| `maintenance.approved` | One-time approval for a held change. Set it to the `approvalToken` of the change in `status.pendingMaintenance`. |

Held changes are listed in `status.pendingMaintenance` with a description, a severity and an approval token. Version changes that you request through `spec.version` are not held.

## Status

| Field | Description |
| --- | --- |
| `phase` | `Pending`, `Provisioning`, `Initializing`, `Ready`, `Updating`, `Restoring`, `Suspending`, `Suspended`, `Resuming`, `Terminating` or `Failed`. |
| `version` | The version bundle that is currently applied. |
| `message` | A human-readable summary of the state. |
| `conditions` | See [Conditions](#conditions). |
| `components` | For each component: the label selector of its pods, the number of replicas and the number of ready replicas. |
| `connectionSecretRef` | The Secret with the connection details, named `<instance>-conn`. See [Connect to an instance](../use/connect.md). |
| `backup` | Backup state, including the point-in-time recovery window of each storage. |
| `monitoring` | The metrics endpoints the instance exposes (`sources`) and the state of each monitoring destination (`destinations`). |
| `pendingMaintenance` | Disruptive changes waiting for approval. |

### Conditions

| Condition | Meaning |
| --- | --- |
| `Ready` | The instance is up and accepting connections. |
| `PodsScheduled` | `False` when a pod has waited more than a minute for a node. The message says which component and why. |
| `PodsReady` | `False` when pods are not ready. The reason names the worst problem, for example `CrashLoopBackOff`, `ImagePullBackOff`, `CreateContainerConfigError` or `NotReady`. |
| `BackupConfigured` | Whether the backup configuration was applied. `False` when, for example, the provider doesn't support a requested setting. |
| `MonitoringConfigured` | Whether every monitoring destination is configured. Present only when the instance has monitoring destinations. |

Example status of a PostgreSQL instance that is starting:

```yaml
status:
  phase: Initializing
  message: database is initializing
  version: 18.4-1
  components:
    - name: engine
      replicas: 2
      readyReplicas: 0
      selector: core.openeverest.io/component=engine,core.openeverest.io/instance=orders-db
    - name: proxy
      replicas: 2
      readyReplicas: 0
      selector: core.openeverest.io/component=proxy,core.openeverest.io/instance=orders-db
  conditions:
    - type: BackupConfigured
      status: "True"
      reason: Configured
      message: Backup configuration applied to engine
    - type: PodsScheduled
      status: "True"
      reason: Scheduled
    - type: PodsReady
      status: "False"
      reason: NotReady
      message: |-
        engine: 2 of 2 pods are not ready
        proxy: 2 of 2 pods are not ready
    - type: Ready
      status: "False"
      reason: Initializing
      message: database is initializing
```
