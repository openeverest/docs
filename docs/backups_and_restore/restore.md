# Restore a backup

Restoring replaces the data of an existing instance with the data from a backup or from a point in time. To keep the current instance untouched, [create a new instance from the backup](create_from_backup.md) instead.

:::warning

A restore overwrites all current data of the instance, and the instance is unavailable while the restore runs.

:::

## Restore from a backup

1. On the **Instances** page, open the **Actions** menu of the instance and select **Restore from a backup**. The action is available when the instance has at least one successful backup.
2. Select **From a backup** and choose the backup.
3. Confirm.

The instance switches to **Restoring** and returns to **Ready** when the restore is complete. The **Restores** tab of the instance shows the progress and the history of restores.

## Restore to a point in time

You need [point-in-time recovery](pitr.md) enabled on the instance.

1. Open **Actions** > **Restore from a backup**.
2. Select **From a Point-in-time (PITR)**.
3. Select the storage that holds the log and the date and time to restore to. The time must be inside the recovery window shown in the dialog.
4. Confirm.

## Restore with kubectl

Create a `Restore` that names the target instance and the data source.

From a backup:

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

To a point in time:

```yaml
apiVersion: backup.openeverest.io/v1alpha1
kind: Restore
metadata:
  name: orders-db-restore-2
  namespace: demo
spec:
  instanceRef:
    name: orders-db
  dataSource:
    type: PointInTime
    pointInTime:
      source:
        storageRef:
          name: s3-backups
      recoveryTarget: date        # or "latest"
      date: "2026-11-04T10:00:00Z"
```

Follow the progress:

```sh
kubectl get restores -n demo
```
