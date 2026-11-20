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
| `monitoring.sources.metrics.policy` | When the provider runs its metrics exporters: `OnDemand` (default) while a destination needs metrics, `Always` even without destinations. See [Expose metrics without a destination](../use/monitoring.md#expose-metrics-without-a-destination). |
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

The status follows the [Kubernetes API conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#typical-status-properties): conditions are the source of truth, and the phase is only a coarse label for display. Tools that read conditions, such as `kubectl wait`, Argo CD, Flux and Helm, understand the state of an instance without knowing anything about the provider.

| Field | Description |
| --- | --- |
| `phase` | `Pending` — the instance has never served clients; `Provisioned` — it has been available at least once; `Terminating` — it is being deleted. Use it for wording only, never to decide what to do. |
| `observedGeneration` | The `metadata.generation` of the spec the status describes. While it is lower than `metadata.generation`, the provider has not reported on the latest change yet. It is `-1` until a provider first reports. |
| `version` | The version bundle that is currently applied. |
| `conditions` | See [Conditions](#conditions). |
| `components` | For each component: the label selector of its pods, `replicas` (the pods that are not terminating), `readyReplicas`, and `desiredReplicas` (how many pods it will have once the current spec is applied). |
| `connectionSecretRef` | The Secret with the connection details, named `<instance>-conn`. See [Connect to an instance](../use/connect.md). |
| `backup` | The state of each backup storage, including its point-in-time recovery window. See [Instance backup settings](backups.md#instance-backup-settings). |
| `monitoring` | The metrics endpoints the instance exposes (`sources`) and the state of each monitoring destination (`destinations`). |
| `pendingMaintenance` | Disruptive changes waiting for approval. |

`kubectl get instances` shows the `AVAILABLE` and `STATUS` columns; `-o wide` adds `PHASE`, `STALLED`, `TOPOLOGY` and `MESSAGE`. `spec.providerRef` can't be changed after creation.

### Conditions

**Summary conditions** answer the questions every reader has:

| Condition | Question |
| --- | --- |
| `Available` | Can clients use the instance right now? It stays `True` through a rolling change of a highly available instance, and is `False` while a restore replaces the data. |
| `Ready` | Has the latest spec been carried out in full? Its **reason is the status word** that the UI, `everestctl` and `kubectl get` show — for example `Ready`, `Creating`, `ApplyingChanges`, `Upgrading`, `Restoring`, `CrashLoopBackOff` or `BackupStorageNotFound` — and its message is a sentence you can act on. |
| `Reconciling` | Is the provider still working on it? Wait. |
| `Stalled` | Has progress stopped in a way that waiting won't fix? Act. While `Ready` is not `True`, exactly one of `Reconciling` and `Stalled` is `True`. |
| `NeedsAttention` | Is there a problem someone may want to look at? It is `True` as soon as a check fails, before it is known whether the problem clears by itself. |

**Checks** are `True` when fine, `Unknown` while not known yet, and `False` when there is a problem. These gate `Ready`:

| Check | `False` when |
| --- | --- |
| `ReferencesResolved` | The provider, the user Secret or another object the instance names is missing or doesn't fit. |
| `Synced` | The provider's calls to apply the spec or read the state have failed for a minute in a row. |
| `PodsScheduled` | A pod has waited more than a minute for a node. The message says which component and why. |
| `PodsReady` | A pod is in a back-off: `CrashLoopBackOff`, `ImagePullBackOff` or `CreateContainerConfigError`. It is `Unknown` with reason `NotReady` while pods are only starting. |
| `EngineHealthy` | The provider reports a problem with the engine. |
| `DataSourceReady` | The instance can't be created from its `spec.dataSource`. Set only for instances created from a backup. |
| `BackupConfigured` | A backup storage or the backup class can't be used. Set only when backups are enabled. |

These checks don't gate `Ready`: `ConnectionDetailsReady` (the connection Secret is filled in), `MonitoringConfigured` and `MonitoringReady` (see [Monitoring](monitoring.md)).

**Operations** are `True` while a long operation runs, then `False` with reason `Succeeded`: `Restoring`, `Upgrading` and `StorageResizing`. While one runs, it gives `Ready` its status word.

**Other conditions:** `MaintenancePending` (a disruptive change waits for approval), `ComponentVersionDeprecated` (a component runs a version the provider deprecated) and `Unattended`.

### When an instance is stalled

| Situation | `Stalled` becomes `True` |
| --- | --- |
| The provider rejects the spec (reason `ValidationFailed`), gives up retrying, or reports a problem it can't recover from | At once |
| A check fails, for example a missing Secret, a crash loop or pods that can't be scheduled | After 10 minutes. Until then, only `NeedsAttention` is `True`. |
| Nothing fails, but nothing finishes either, and no operation runs | After 30 minutes |

The deadlines start again when you change the spec.

### When no provider reconciles the instance

Only the provider named in `spec.providerRef` updates an instance's status. When it doesn't, OpenEverest sets the `Unattended` condition itself:

| Situation | `Unattended` |
| --- | --- |
| The provider in `spec.providerRef` doesn't exist, for 1 minute — for example because of a typo | `True`, reason `ProviderNotFound`. The message lists the installed providers. |
| The provider exists, but hasn't reported on the current spec for 5 minutes | `Unknown`, reason `NotResponding`. Check that the provider is running, and its logs. |

`Unattended` is present only while something is wrong, and is removed as soon as the provider catches up. Because `spec.providerRef` can't be changed, delete an instance that names the wrong provider and create it again.

### Example

A PostgreSQL instance that is starting:

```yaml
status:
  phase: Pending
  observedGeneration: 1
  components:
    - name: engine
      replicas: 2
      desiredReplicas: 2
      readyReplicas: 0
      selector: core.openeverest.io/component=engine,core.openeverest.io/instance=orders-db
    - name: proxy
      replicas: 2
      desiredReplicas: 2
      readyReplicas: 0
      selector: core.openeverest.io/component=proxy,core.openeverest.io/instance=orders-db
  conditions:
    - type: Available
      status: "False"
      reason: NotAvailable
    - type: Ready
      status: "False"
      reason: Creating
      message: Waiting for the database to start
    - type: Reconciling
      status: "True"
      reason: Creating
      message: Waiting for the database to start
    - type: Stalled
      status: "False"
      reason: Reconciling
    - type: NeedsAttention
      status: "False"
      reason: NoProblems
    - type: ReferencesResolved
      status: "True"
      reason: Resolved
    - type: Synced
      status: "True"
      reason: Synced
    - type: PodsScheduled
      status: "True"
      reason: Scheduled
    - type: PodsReady
      status: "Unknown"
      reason: NotReady
      message: |-
        engine: 2 of 2 pods are not ready
        proxy: 2 of 2 pods are not ready
    - type: BackupConfigured
      status: "True"
      reason: Configured
      message: Backup configuration applied to engine
```

To wait until an instance has applied its latest spec:

```sh
kubectl wait instance/orders-db -n demo --for=condition=Ready --timeout=10m
```
