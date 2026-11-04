# Known limitations

OpenEverest 2 is a Developer Preview. This page lists what is missing or behaves differently from what you might expect. Many of these limitations will be removed before the General Availability release.

## Installation and upgrades

- **Not for production.** Use OpenEverest 1.x for production workloads.
- **No upgrades between Developer Previews.** The `Instance` and `Provider` APIs change between previews without a migration path. Install each preview on a fresh cluster.
- **No migration from OpenEverest 1.x yet.** A migration path is planned for the General Availability release. OpenEverest 1.x and 2 can't run in the same cluster.
- **Helm only.** `everestctl install`, `uninstall`, `upgrade` and `namespaces` still target OpenEverest 1.x, and `everestctl` is not published as a binary for OpenEverest 2. Commands such as `everestctl accounts` and `everestctl settings` work when built from source.
- **Provider versions must match the core.** A provider built for an earlier preview may not work with a later core. Check the compatibility shown in the Plugin Hub.
- **One cluster.** OpenEverest manages only the Kubernetes cluster it runs in (`main`).

## Capabilities depend on the provider

Backups, point-in-time recovery, monitoring, exposure options, editable settings and supported topologies are implemented by each provider, and differ between them. Providers marked *Alpha* in the Plugin Hub may support only a subset. Check the provider's README for its capabilities.

## UI

- **Suspend, resume and restart** of instances are not available.
- **Instance logs** and a **components** view are not available in the UI. Use `kubectl logs` and `kubectl get pods`.
- **Instance presets** can be used but not created or edited in the UI. See [Instance presets](../administer/instance_presets.md).
- **Time-based backup retention** can be set only with `kubectl`. The UI edits count-based retention.
- **OpenEverest users and RBAC policies** are managed with `everestctl` or `kubectl`, not in the UI. See [Users](../administer/manage_users.md) and [RBAC](../administer/rbac.md).
- **Read-only users** may see a `403` error on the instance page, because they lack the `read-connection` permission needed to show the credentials.

## Backups

- **Backup storage must be S3-compatible.** Other storage types are not supported.
- Some engines can upload point-in-time recovery data to **only one storage** per instance, for example MongoDB and MySQL.

## Monitoring

- Monitoring is configured with `kubectl` only. UI support for monitoring destinations is not available yet.
- The **Settings** > **Monitoring endpoints** page belongs to the previous monitoring model and no longer configures instance monitoring.
- Monitoring extensions are in early development and are installed from their repositories.
- OpenEverest does not collect Kubernetes infrastructure metrics (nodes, pods, kube-state-metrics).

See [Monitoring](../use/monitoring.md).

## Passwords

The initial password of the `admin` user is stored in plain text in the `everest-accounts` Secret. Change it after installation with `everestctl accounts set-password`, which stores a hash, or use [single sign-on](../security/sso_idp_integration.md).

## OIDC integration with Microsoft Entra

When integrating Microsoft Entra ID as your OIDC provider for OpenEverest, it's essential to ensure that the access tokens issued are compatible with OpenEverest's token validation logic.

**Problem**

By default, Microsoft Entra issues access tokens intended for use with Microsoft's own APIs (e.g., Microsoft Graph). These tokens have the following characteristics:

- **Audience (aud):** "`00000003-0000-0000-c000-000000000000`" (Microsoft Graph)

- **Signature:** Uses a proprietary mechanism that cannot be validated by OpenEverest

Microsoft Entra generates access tokens using a proprietary signature mechanism, which OpenEverest cannot validate. This results in signature verification failures when integrating OpenEverest with Entra-generated tokens.

**Solution**

To obtain access tokens that OpenEverest can validate, request tokens explicitly scoped for the registered application in Microsoft Entra using the `<application-client-id>/.default scope`. This ensures:

- **Audience (aud):** Set to your application's client ID

- **Signature:** Standard JWT, verifiable using the issuer's public keys

**OpenEverest configuration**

Add the application's scope to the OIDC scopes, for example with `everestctl` (or in `oidc.config`, see [Single sign-on](../security/sso_idp_integration.md#configure-openeverest)):

```sh
everestctl settings oidc configure \
--issuer-url=http://url.com \
--client-id=<your-app-client-id> \
--scopes=openid,profile,email,<your-app-client-id>/.default
```

:::note

Note: Replace `<your-app-client-id>` with your actual Microsoft Entra application (client) ID, and ensure the issuer-url points to the correct tenant.

:::

With this configuration, the access token will include `"aud": "<your-app-client-id>"`, and it will have a valid signature that OpenEverest can verify.
