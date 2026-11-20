# Backups and restores

The `backup.openeverest.io` API group holds the resources for backups. For a task-oriented guide, see [Backup and restore](../backups_and_restore/AboutBackups.md).

## BackupStorageClass

A cluster-scoped description of one storage technology: the parameters a storage of that technology takes, how it authenticates, and the forms the UI shows for it. OpenEverest ships the `s3` class.

```sh
kubectl get backupstorageclasses
```

| Field | Description |
| --- | --- |
| `displayName` | Shown in the UI as the storage **Type**. |
| `parametersSchema` | OpenAPI schema of `BackupStorage.spec.parameters`. |
| `authModes[]` | The authentication modes a storage of this class can use, each with the keys its credentials Secret must hold (`credentials.required`, `credentials.optional`). |
| `validations[]` | CEL rules that the schema can't express, each with a `message` and a `reason`. A storage that breaks one is not accepted. |
| `uiSchema` | The forms of the class: `location`, `storage` (the parameters) and `credentials` for each authentication mode. |

### The s3 class

The `s3` class works with Amazon S3 and with S3-compatible object storage, such as MinIO, SeaweedFS, Ceph RGW or Google Cloud Storage in S3 interoperability mode.

| Parameter | Description |
| --- | --- |
| `region` | **Required.** Region of the bucket, for example `us-east-1`. Storage without regions usually accepts `us-east-1`. |
| `endpointURL` | **Required.** URL of the S3 service, for example `https://s3.us-east-1.amazonaws.com`. An `http://` URL uses plain HTTP. |
| `forcePathStyle` | Use path-style URLs. Needed by most self-hosted S3 services, such as MinIO. |
| `implementation` | `aws`, `minio`, `ceph`, `gcs` or `other`. Tells the provider which S3 implementation it talks to, for engines that handle S3-compatible storage differently from Amazon S3. Defaults to `aws`. |

Its only authentication mode is `AccessKey`, whose Secret holds `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Bucket names must be 3 to 63 lowercase letters, digits, `.`, `-` or `_`.

## BackupStorage

A namespaced place to write backups to, of the technology its class describes.

```yaml
apiVersion: backup.openeverest.io/v1alpha1
kind: BackupStorage
metadata:
  name: s3-backups
  namespace: demo
spec:
  backupStorageClassRef:
    name: s3
  location:
    objectStore:
      bucket: openeverest-backups
      prefix: demo
  parameters:
    region: us-east-1
    endpointURL: https://s3.us-east-1.amazonaws.com
  authentication:
    mode: AccessKey
    credentialsSecretRef:
      name: s3-backups-credentials
  tls:
    ca:
      secretKeyRef:
        name: s3-backups-ca
        key: ca.crt
```

| Field | Description |
| --- | --- |
| `backupStorageClassRef.name` | **Required.** The `BackupStorageClass`. Immutable. |
| `location.objectStore.bucket` | **Required.** Name of an existing bucket. Immutable. |
| `location.objectStore.prefix` | Path within the bucket, for example `team-a/prod`. Immutable. |
| `parameters` | The parameters of the class, checked against its `parametersSchema`. |
| `authentication.mode` | **Required.** One of the class's `authModes`. `Anonymous` is not accepted. |
| `authentication.credentialsSecretRef.name` | Secret in the same namespace with the keys the mode requires. See [Secrets and credentials](../security/secrets.md). |
| `tls.ca.secretKeyRef` | Secret key with the PEM CA certificates that signed the server certificate, for endpoints with a private CA. |
| `tls.insecureSkipVerify` | Don't verify the server certificate. Can't be combined with `tls.ca`. |

The location is immutable because engines treat it as their backup catalog. To move backups elsewhere, create a new storage.

Each instance writes under its own path, `<prefix>/backups/<namespace>/<instance>/<instance-uid>/<storage>`, so instances never share a directory. Each `Backup` records its path in `status.path`.

### Status

OpenEverest checks every storage against its class and reports the result in the `Accepted` condition. It doesn't check that the bucket is reachable.

| `Accepted` reason | Meaning |
| --- | --- |
| `Accepted` | The storage is valid for its class. |
| `ClassNotFound` | The `BackupStorageClass` doesn't exist. |
| `InvalidClass` | The class itself is invalid. |
| `InvalidLocation`, `InvalidParameters` | The location or the parameters break the class's schema or rules. The message says which. |
| `AuthModeUnsupported` | The class doesn't offer the authentication mode. |
| `CredentialsNotFound` | The credentials Secret is missing or lacks a key the mode requires. |
| `InvalidCABundle` | The CA Secret or key is missing, or holds something other than CA certificates. |

`status.backupClasses[]` lists, for each backup class, whether it can write to this storage. `kubectl get backupstorages` shows the class, the bucket, the authentication mode and the `Accepted` reason; `-o wide` adds the credentials Secret, the CA Secret and whether verification is skipped.

To find the storages that use a Secret:

```sh
kubectl get backupstorages -n demo \
  --field-selector spec.authentication.credentialsSecretRef.name=s3-backups-credentials
```

A storage that instances, backups, restores or backup imports still use isn't deleted. It reports `Deleting` with reason `WaitingForReferrers` and a message such as *"still referenced by 1 Instance(s), 1 Backup(s)"*, and is removed once nothing uses it. Deleting a storage never deletes its Secrets or the data in the bucket.

## BackupClass

A cluster-scoped description of how backups are taken. Providers install their backup classes; you rarely create one yourself.

```sh
kubectl get backupclasses
```

| Field | Description |
| --- | --- |
| `displayName`, `description` | Shown in the UI. |
| `executionMode` | Who takes the backups. `ProviderManaged`, the only mode, means the provider and its Operator. |
| `providerManaged.providerRef.name` | The provider that runs the class. Immutable. |
| `providerManaged.supportsPITR` | Whether point-in-time recovery is supported. |
| `providerManaged.limits` | Limits per instance, such as the number of storages or of PITR-enabled storages. |
| `backupStorageClasses[]` | The storage classes the class can write to, each with the `authModes` it supports, an optional `parametersSchema` that narrows the class's parameters, and `tls.customCA` and `tls.insecureSkipVerify` (`Supported` or `None`). |
| `supportsImport` | Whether backups in a storage can be discovered and imported with a `BackupImport`. |
| `parametersSchema`, `restoreParametersSchema` | Schemas of the extra parameters accepted by `Backup.spec.parameters` and `Restore.spec.parameters`. |

The provider marks the classes it ships as `Accepted`. OpenEverest publishes in `status.providers[]` whether the class can be used with its provider, and in each `BackupStorage`'s `status.backupClasses[]` whether it can write to that storage. Each verdict is `Compatible`, `Pending` (it may still become compatible, for example while the provider starts) or `Incompatible`, with a reason. A `Backup`, `Restore` or `BackupImport` that combines an incompatible class, provider and storage is rejected when it is created.

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

`Instance.status.backup.storages[]` reports, for each storage, the location it is configured with and its point-in-time recovery window. Each storage is checked separately, so one storage that can't be used doesn't stop the others. Such a storage gets a `reason` and a `message`:

| Reason | Meaning |
| --- | --- |
| `BackupStorageNotFound` | The `BackupStorage` doesn't exist. |
| `BackupStorageNotAccepted` | The storage isn't `Accepted`. The message gives its reason. |
| `BackupStorageIncompatible` | The instance's backup class can't write to the storage. |
| `BackupStorageLocationChanged` | The storage now points somewhere else than when it was configured, for example because it was deleted and created again with the same name. |
| `UnsupportedParameter`, `ImplementationUnsupported`, `TLSOptionUnsupported` | The provider can't use a parameter, the S3 implementation or the TLS setting of the storage. |

While a storage can't be used, the provider keeps the last configuration that worked for it, so schedules and point-in-time recovery keep running. The `BackupConfigured` condition of the instance names every storage that isn't configured.

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

The `status.state` is `Pending`, `Running`, `Succeeded`, `Failed`, `Error` or `Deleting`. Only `Succeeded` backups can be restored. A backup stays `Pending`, with a message naming what is missing, while its class, storage or instance doesn't exist yet.

`status.path` is the directory in the bucket the backup was written to, so it can be restored after its instance is gone. `status.sourceMetadata` records the engine version, topology and backup type of the source, which decide where the backup can be restored.

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
