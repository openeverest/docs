# Backups and restores

The `backup.openeverest.io` API group holds the resources for backups. For a task-oriented guide, see [Backup and restore](../backups_and_restore/AboutBackups.md).

## BackupStorage

A namespaced S3-compatible bucket. Only the `s3` type is supported.

```yaml
apiVersion: backup.openeverest.io/v1alpha1
kind: BackupStorage
metadata:
  name: s3-backups
  namespace: demo
spec:
  type: s3
  s3:
    bucket: openeverest-backups
    region: us-east-1
    endpointURL: https://s3.us-east-1.amazonaws.com
    forcePathStyle: false
    verifyTLS: true
    credentialsSecretRef:
      name: s3-backups-credentials   # keys AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
```

| Field | Description |
| --- | --- |
| `s3.bucket` | Bucket name. |
| `s3.region` | Bucket region. |
| `s3.endpointURL` | URL of the S3 service. |
| `s3.forcePathStyle` | Use path-style URLs. Needed by most self-hosted S3 services. |
| `s3.verifyTLS` | Verify the endpoint's TLS certificate. |
| `s3.credentialsSecretRef.name` | Secret in the same namespace with `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. |

OpenEverest adopts the credentials Secret, so it is deleted together with the storage. A storage that is still used by an instance or a backup can't be deleted; it stays `Terminating` until it is no longer used.

## BackupClass

A cluster-scoped description of how backups are taken. Providers install their backup classes; you rarely create one yourself.

```sh
kubectl get backupclasses
```

| Field | Description |
| --- | --- |
| `displayName`, `description` | Shown in the UI. |
| `supportedProviders` | Providers that can use the class. |
| `executionMode` | `ProviderManaged` — the provider and its Operator take the backups — or `Job` — OpenEverest runs a Kubernetes Job, for example with `pg_dump`. |
| `supportsImport` | Whether backups in a storage can be discovered and imported with a `BackupImport`. |
| `providerManaged.supportsPITR` | Whether point-in-time recovery is supported. |
| `providerManaged.limits` | Limits per instance, such as the number of PITR-enabled storages. |
| `parametersSchema`, `restoreParametersSchema` | Schemas of the extra parameters accepted by `Backup.spec.parameters` and `Restore.spec.parameters`. |

Only `ProviderManaged` classes can be used in `Instance.spec.backup` and for creating instances from backups.

## Instance backup settings

Backups of an instance are configured in `Instance.spec.backup`:

| Field | Description |
| --- | --- |
| `enabled` | Turns backups on for the instance. |
| `classRef.name` | The `BackupClass` to use. It must list the instance's provider. |
| `storages[].storageRef.name` | A `BackupStorage` in the same namespace. |
| `storages[].schedules[]` | Schedules writing to this storage: `name`, `enabled`, `cron`, and optional `retention` and `parameters`. Schedule names must be unique across storages. |
| `storages[].schedules[].retention` | `{type: count, count: 7}` keeps the last 7 backups; `{type: time, duration: 30d}` keeps backups for 30 days (`d`, `w` or `m`). Omit to keep all backups. |
| `storages[].pitr.enabled` | Upload the transaction log to this storage for point-in-time recovery. |
| `storages[].pitr.parameters` | PITR settings defined by the backup class. |

The point-in-time recovery window of each storage is reported in `Instance.status.backup`.

## Backup

One backup of an instance. Schedules create `Backup` resources automatically; create one yourself for an on-demand backup.

```yaml
apiVersion: backup.openeverest.io/v1alpha1
kind: Backup
metadata:
  name: orders-db-before-migration
  namespace: demo
spec:
  origin:
    type: Instance
    instanceRef:
      name: orders-db
  classRef:
    name: pg
  storageRef:
    name: s3-backups
  deletionPolicy: Delete
```

| Field | Description |
| --- | --- |
| `origin.type` | `Instance` for backups of an OpenEverest instance, `External` for imported backups. |
| `origin.instanceRef.name` | The instance to back up. |
| `classRef.name`, `storageRef.name` | Backup class and storage. |
| `scheduleName` | Set on backups created by a schedule. |
| `parameters` | Extra settings defined by the backup class, such as the backup type. |
| `deletionPolicy` | `Delete` (default) removes the data from the storage when the backup is deleted, `Retain` keeps it. |

The `status.state` is `Pending`, `Running`, `Succeeded`, `Failed`, `Error` or `Deleting`. Only `Succeeded` backups can be restored.

## Restore

Restores data into an existing instance.

```yaml
apiVersion: backup.openeverest.io/v1alpha1
kind: Restore
metadata:
  name: orders-db-restore-1
  namespace: demo
spec:
  instanceRef:
    name: orders-db
  dataSource:
    type: Backup
    backup:
      backupRef:
        name: orders-db-before-migration
```

| Field | Description |
| --- | --- |
| `instanceRef.name` | The instance to restore into. |
| `dataSource.type` | `Backup` or `PointInTime`. |
| `dataSource.backup.backupRef.name` | The backup to restore. |
| `dataSource.pointInTime.source.storageRef.name` | The storage holding the transaction log. |
| `dataSource.pointInTime.source.instanceRef.name` | The instance whose log to use. Defaults to the target instance. |
| `dataSource.pointInTime.recoveryTarget` | `date` or `latest`. |
| `dataSource.pointInTime.date` | The time to restore to, when `recoveryTarget` is `date`. |
| `parameters` | Extra settings defined by the backup class. |

The same `dataSource` structure is used in `Instance.spec.dataSource` to create a new instance from a backup.

## BackupImport

Scans a backup storage for backups that OpenEverest doesn't know about yet, so they can be imported and used to create instances. The **Import database** page in the UI creates `BackupImport` resources for you. Only backup classes with `supportsImport: true` can be used.
