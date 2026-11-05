# Custom resources

All OpenEverest state is stored in Kubernetes custom resources. The UI and the API read and write these resources on your behalf; you can also manage them directly with `kubectl`, Helm or a GitOps tool such as Argo CD or Flux.

## When to use custom resources directly

The UI and the [API](../API.md) are the recommended way for most users, because they add authentication, [RBAC](../administer/rbac.md) and validation of what each user may do. Use the custom resources directly when:

- you manage instances declaratively, in Git, alongside your applications;
- you automate OpenEverest from a Kubernetes-native tool;
- you need a field that the provider's UI schema does not expose.

Kubernetes RBAC, not OpenEverest RBAC, controls who can change custom resources with `kubectl`.

## API groups

| Group | Resources |
| --- | --- |
| `core.openeverest.io` | `Provider`, `Instance`, `InstancePreset`, `ClusterInstancePreset` |
| `backup.openeverest.io` | `BackupStorage`, `BackupClass`, `Backup`, `Restore`, `BackupImport` |
| `monitoring.openeverest.io` | `MonitoringClass`, `MonitoringDestination`, `MonitoringBinding` |
| `extensions.openeverest.io` | `Plugin`, `InstalledExtension` |

All resources are at version `v1alpha1`. During the Developer Preview, their schemas can change between releases.

## Resources

| Resource | Scope | Created by | Description |
| --- | --- | --- | --- |
| `Provider` | Cluster | Provider chart | A technology: versions, topologies, components and UI schema. |
| `Instance` | Namespace | You | A running deployment of a technology. See [Instance](instance.md). |
| `InstancePreset` | Namespace | You | A starting configuration for instances in one namespace. See [Instance presets](../administer/instance_presets.md). |
| `ClusterInstancePreset` | Cluster | Provider chart or you | A starting configuration for instances in any namespace. |
| `BackupStorage` | Namespace | You | An S3-compatible bucket for backups. See [Backups and restores](backups.md). |
| `BackupClass` | Cluster | Provider chart | How backups are taken for one or more providers. |
| `Backup` | Namespace | You or a schedule | One backup of an instance. |
| `Restore` | Namespace | You | Restores a backup or a point in time into an instance. |
| `BackupImport` | Namespace | You | Scans a backup storage for backups to import. |
| `MonitoringClass` | Cluster | Monitoring extension | A monitoring technology, such as PMM or Prometheus. See [Monitoring](monitoring.md). |
| `MonitoringDestination` | Namespace | You | A monitoring server that instances send to. |
| `MonitoringBinding` | Namespace | OpenEverest | Links an instance to a destination. Read-only. |
| `Plugin` | Cluster | Plugin chart | A registered generic plugin. |

## Explore the schemas

The [custom resources reference](/api/next/crds/) lists every field of every resource. In a cluster, use `kubectl explain` to read the documentation of any field:

```sh
kubectl explain instance.spec
kubectl explain instance.spec.backup.storages
kubectl explain backupstorage.spec.s3
kubectl explain monitoringdestination.spec
```

The fields that depend on the technology — topology parameters, component parameters, backup parameters — are described by the `Provider` and `BackupClass` resources:

```sh
kubectl get provider provider-percona-postgresql -o yaml
kubectl get backupclass pg -o yaml
```

## Check the status

Every resource reports its state in `status.conditions`. For example, to see why an instance is not ready:

```sh
kubectl get instance orders-db -n demo -o jsonpath='{range .status.conditions[*]}{.type}{"\t"}{.status}{"\t"}{.message}{"\n"}{end}'
```

```text
BackupConfigured   True    Backup configuration applied to engine
PodsScheduled      True
PodsReady          False   engine: 2 of 2 pods are not ready
Ready              False   database is initializing
```

See [Diagnostics](../troubleshoot/troubleshoot.md).
