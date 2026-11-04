# Change and delete instances

## Change an instance

1. Open the instance from the **Instances** page.
2. On the **Overview** tab, find the card with the setting you want to change — for example *Resources*, *Proxy* or *Advanced configuration* — and click **Edit**.
3. Change the values and click **Save**.

The instance switches to **Updating** while the provider rolls out the change, then returns to **Ready**.

Which settings you can change after creation is decided by the provider. Cards without an **Edit** button are read-only, and some fields — such as the topology — can only be set at creation.

### Scale an instance

- **Vertical scaling** — change the CPU and memory limits and requests of a component.
- **Horizontal scaling** — change the number of nodes or replicas of a component, or the number of shards for sharded topologies.
- **Storage** — increase the disk size. This works only if the StorageClass allows volume expansion (`allowVolumeExpansion: true`). Most storage cannot be shrunk.

Scaling a component may restart its pods one at a time.

### Change the version

If the provider allows version changes, the version card has an **Edit** button. A version change usually restarts the instance's pods. Check the provider's documentation for the supported upgrade paths.

### Maintenance and disruptive changes

Some changes can only be applied by restarting the instance or taking it offline — for example a new image delivered by a provider upgrade. The `spec.maintenance` section of the `Instance` controls which of these the provider applies automatically:

```yaml
spec:
  maintenance:
    autoApproveUpTo: NonDisruptive   # NonDisruptive | RollingRestart | Downtime
```

Actions above this level wait in `status.pendingMaintenance`. To approve one, copy its `approvalToken` into `spec.maintenance.approved`. See [Instance](../crd/instance.md#maintenance).

## Delete an instance

1. On the **Instances** page, open the **Actions** menu of the instance, or open the instance and click **Actions**.
2. Select **Delete**.
3. Type the name of the instance to confirm.
4. Choose whether to keep the backups:
    - With **Keep backups storage data** selected, the instance's `Backup` and `Restore` resources are kept, and you can later [create a new instance](../backups_and_restore/create_from_backup.md) from them.
    - Otherwise, the backups are deleted together with the instance.
5. Click **Delete**.

:::danger

Deleting an instance permanently deletes its data volumes. You can't undo it.

:::

The same choice is available with `kubectl` through the instance's `spec.deletionPolicy`: `Cascade` (default) deletes the instance's backups and restores, `Orphan` keeps them.

```sh
kubectl delete instance orders-db -n demo
```

## Suspend, resume and restart

Suspending, resuming and restarting instances from the UI is not available in the OpenEverest 2 Developer Preview yet.
