# Known limitations

OpenEverest 2 is in Alpha. This page lists what is missing or behaves differently from what you might expect. Many of these limitations will be removed before the General Availability release.

## Installation and upgrades

- **Not for production.** Use OpenEverest 1.x for production workloads.
- **No upgrades between preview releases.** The APIs change between Developer Previews, Alphas and Betas without a migration path. Install each one on a fresh cluster.
- **No migration from OpenEverest 1.x yet.** A migration path is planned for the General Availability release. OpenEverest 1.x and 2 can't run in the same cluster.
- **Helm only.** `everestctl install`, `uninstall`, `upgrade` and `namespaces` still target OpenEverest 1.x, and `everestctl` is not published as a binary for OpenEverest 2. Commands such as `everestctl accounts` and `everestctl settings` work when built from source.
- **Provider versions must match the core.** A provider built for another OpenEverest release may not work. Check the compatibility shown in the Plugin Hub and the versions named in the release notes.
- **One cluster.** OpenEverest manages only the Kubernetes cluster it runs in (`main`).

## Capabilities depend on the provider

Backups, point-in-time recovery, monitoring, exposure options, editable settings and supported topologies are implemented by each provider, and differ between them. Providers marked *Alpha* in the Plugin Hub may support only a subset. Check the provider's README for its capabilities.

## UI

- **Suspend, resume and restart** of instances are not available.
- **Instance logs** and a **components** view are not available in the UI. Use `kubectl logs` and `kubectl get pods`.
- **Instance presets** can be used but not created or edited in the UI. See [Instance presets](../administer/instance_presets.md).
- **OpenEverest users and RBAC policies** are managed with `everestctl` or `kubectl`, not in the UI. See [Users](../administer/manage_users.md) and [RBAC](../administer/rbac.md).

## Instance status

- **Spec edits are not checked against running operations.** A spec change, a second restore or a backup during a restore is accepted; the UI holds edits back while a restore, an upgrade or a storage resize runs.
- **After a provider restart, a stalled instance shows a warning again** for a full deadline (10 or 30 minutes) before it reads as stalled.
- **`kubectl get instances` shows the last status while the provider hasn't reported on a change yet.** `kubectl describe`, `everestctl` and the UI show the `Unattended` condition when no provider is working on the instance.
- **Argo CD has no built-in health check for instances yet.**

## Lifecycle events

- **Events are kept for the cluster's Event TTL**, one hour by default. See [Lifecycle events](../administer/events.md#retention-and-limitations).

## Backups

- **Only S3-compatible storage ships with OpenEverest**, as the `s3` backup storage class. Other storage technologies need their own backup storage class, and a backup class that can write to it.
- **The credentials Secrets of backup storages are not protected from deletion yet.** Deleting one that a storage uses stops that storage's backups until the Secret is back. See [Secrets and credentials](../security/secrets.md#secrets-in-use-cant-be-deleted).
- **OpenEverest doesn't test that a bucket is reachable** when a storage is added. A wrong endpoint or wrong credentials show up when the first backup fails.
- Some engines can upload point-in-time recovery data to **only one storage** per instance, for example MongoDB and MySQL.

## Monitoring

- Monitoring extensions are in early development. Each provider supports a different set of them; see the compatibility the `MonitoringClass` reports for each provider.
- OpenEverest does not collect Kubernetes infrastructure metrics (nodes, pods, kube-state-metrics).

See [Monitoring](../use/monitoring.md).

## Passwords

The initial password of the `admin` user is stored in plain text in the `everest-accounts` Secret. Change it after installation with `everestctl accounts set-password`, which stores a hash, or use [single sign-on](../security/sso_idp_integration.md).

## OIDC integration with Microsoft Entra

- **Single-tenant issuer URL only.** OpenEverest accepts an ID token only if its issuer matches the configured issuer URL. Use the v2.0 issuer URL of your tenant, `https://login.microsoftonline.com/<tenant-id>/v2.0`. The multi-tenant endpoints (`common`, `organizations` and `consumers`) are not supported.

- **Users in more than 200 groups get no group-based permissions.** Above that limit, Microsoft Entra leaves out the `groups` claim of the ID token and adds a reference to Microsoft Graph instead (the groups overage claim). OpenEverest doesn't query Microsoft Graph, so these users get only the permissions granted to their subject. To stay under the limit, emit only the groups assigned to the application (**Token configuration** > **Add groups claim** > **Groups assigned to the application**).

See [OpenEverest OIDC configuration for Microsoft Entra](../security/sso_idp_integration.md#openeverest-oidc-configuration-for-microsoft-entra) for the setup.
