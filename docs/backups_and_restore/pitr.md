# Point-in-time recovery

Point-in-time recovery (PITR) continuously uploads an instance's transaction log — such as PostgreSQL WAL, MySQL binary logs or the MongoDB oplog — to a backup storage. Together with a full backup, this lets you restore the instance to any moment within the recovery window, not only to the moment a backup was taken. Use it to recover from accidental writes or deletes.

PITR is available only for providers whose backup class supports it. The Plugin Hub shows which providers do.

## Enable PITR

PITR builds on full backups, so the instance needs at least one backup schedule on the storage first.

1. Open the instance and go to the **Backups** tab, or open the **Backups** step when you create the instance.
2. Turn on **Point-in-time Recovery** and select the backup storage to upload the log to.
3. Optionally, adjust the **PITR Configuration**. The available settings come from the backup class, for example the upload interval.
4. Save.

With `kubectl`, set `pitr.enabled` on a storage entry of the instance:

```yaml
spec:
  backup:
    storages:
      - storageRef:
          name: s3-backups
        schedules:
          - name: daily
            enabled: true
            cron: "0 2 * * *"
        pitr:
          enabled: true
```

Some engines can upload their log to only one storage at a time — for example MongoDB and MySQL. Others, such as PostgreSQL, can archive to every storage.

## Check the recovery window

The instance reports, for every PITR-enabled storage, the earliest and latest time you can restore to:

```sh
kubectl get instance orders-db -n demo -o jsonpath='{.status.backup}'
```

The window starts at the oldest full backup that has a continuous log after it. If the log has a gap — for example after PITR was turned off for a while — the window starts after the gap.

## Restore to a point in time

See [Restore a backup](restore.md#restore-to-a-point-in-time) and [Create an instance from a backup](create_from_backup.md).
