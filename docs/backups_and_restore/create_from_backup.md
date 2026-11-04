# Create an instance from a backup

Creating a new instance from a backup leaves the original instance untouched. Use it to recover deleted data side by side, to create a copy for testing or analytics, or to verify that your backups can be restored.

The new instance is created in the same namespace as the backup, with the same provider.

## From a backup of an existing instance

1. On the **Instances** page, open the **Actions** menu of the source instance and select **Create DB from a backup**.
2. Select **From a backup** and choose the backup, or select **From a Point-in-time (PITR)** and choose the storage and the time to recover to.
3. Continue to the creation form. It is pre-filled with the configuration of the source instance. Change the name and any settings you need, then click **Create**.

The new instance starts in the **Restoring** phase and becomes **Ready** when the data is loaded.

## Import a backup from storage

If the backup is in a bucket but OpenEverest does not know about it — for example, it was taken by an OpenEverest installation in another cluster, or the source instance was deleted together with its backup records — import it:

1. On the **Instances** page, click **Import database**.
2. Select the **Namespace**, the **Backup storage** that points to the bucket, the **Backup class** and the **Database provider**. Only backup classes that support importing are listed.
3. Click **Scan storage**. OpenEverest lists the backups it finds, with their path, version, type, topology and completion time. Scanning can take a minute.
4. Select a backup and continue to configure the new instance.
5. Click **Create**.

## With kubectl

Set `spec.dataSource` on a new instance. The instance must enable backups and register the storage that holds the source backup, so that the provider can read it.

From a backup:

```yaml
apiVersion: core.openeverest.io/v1alpha1
kind: Instance
metadata:
  name: orders-db-copy
  namespace: demo
spec:
  providerRef:
    name: provider-percona-postgresql
  backup:
    enabled: true
    classRef:
      name: pg
    storages:
      - storageRef:
          name: s3-backups
  dataSource:
    type: Backup
    backup:
      backupRef:
        name: orders-db-before-migration
```

From a point in time of another instance:

```yaml
spec:
  dataSource:
    type: PointInTime
    pointInTime:
      source:
        instanceRef:
          name: orders-db
        storageRef:
          name: s3-backups
      recoveryTarget: date
      date: "2026-11-04T10:00:00Z"
```

The source backup must have the status `Succeeded`, and its backup class must support the new instance's provider.
