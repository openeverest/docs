# What's new in OpenEverest 2.0.0 Alpha 1

:::warning[Alpha — not for production]

Features and APIs can still change before General Availability. Install on a fresh cluster, with providers built for this release — see [Before you install](#before-you-install).

:::

**New to OpenEverest?** Start with the [Quickstart Guide](https://openeverest.io/docs/2.0.0-alpha.1/quick-install), or [read the blog post](https://openeverest.io/blog/v2-developer-preview-release/) on the v2 architecture.

This is the first Alpha of OpenEverest v2. The architecture is in place, and APIs change less often than between Developer Previews. It also brings [breaking changes](#breaking-changes) to Instance status, monitoring, backup storages, presets, RBAC, Secrets, events and SSO.

---

## Release highlights

### Monitoring integrations are plugins

Core no longer ships a monitoring backend. The `MonitoringConfig` resource and the bundled VictoriaMetrics operator and kube-state-metrics are gone. Monitoring is now a plugin type, next to providers and generic plugins. The model borrows from Gateway API:

- **`MonitoringClass`** (cluster-scoped) is installed by a monitoring integration. It describes a backend: its parameters, authentication modes and forms. The first integrations are [monitoring-pmm](https://github.com/openeverest/monitoring-pmm), [monitoring-prometheus](https://github.com/openeverest/monitoring-prometheus), [monitoring-victoriametrics](https://github.com/openeverest/monitoring-victoriametrics) and [monitoring-coroot](https://github.com/openeverest/monitoring-coroot).
- **`MonitoringDestination`** (namespaced) is where a namespace sends its data: a class, its parameters, an authentication mode with a credentials Secret, and optional TLS settings (a CA bundle, or skipping verification).
- **`MonitoringBinding`** is created by core for each destination an Instance lists. Each condition has exactly one writer, and no integration ever writes to an Instance.

```yaml
apiVersion: monitoring.openeverest.io/v1alpha1
kind: MonitoringDestination
metadata: {name: pmm-prod, namespace: team-a}
spec:
  classRef: {name: pmm}
  parameters: {url: https://pmm.example.com}
  authentication:
    mode: ServiceAccountToken
    credentialsSecretRef: {name: pmm-prod-credentials}
---
# On the Instance
spec:
  monitoring:
    destinations:
      - {name: pmm, destinationRef: {name: pmm-prod}}
```

A class is fulfilled in one of two ways. Either the provider renders an operator-native integration (*ProviderManaged*, such as PMM), or the integration scrapes the endpoints the provider publishes in `status.monitoring.sources` (*ExtensionManaged*). Each `MonitoringClass` publishes, per Provider, whether it can be used and whether enabling it restarts pods. On the Instance, `MonitoringConfigured` and `MonitoringReady` report the state of each destination. They never take a serving database out of `Ready`. A destination still in use cannot be deleted.

To collect metrics with a scraper OpenEverest does not configure, set `spec.monitoring.sources.metrics.policy: Always`. The endpoints are then published even when no destination needs them.

In the UI, **Settings → Monitoring destinations** replaces *Monitoring endpoints*. The creation wizard has a new **Monitoring** step, and the instance overview shows and edits each destination.

See [Monitoring](https://openeverest.io/docs/2.0.0-alpha.1/use/monitoring) and [Monitoring extensions](https://openeverest.io/docs/2.0.0-alpha.1/extend/monitoring-extensions).

### Backup storages defined by classes

`BackupStorage` was hard-wired to S3: adding a storage technology meant a new core release. A new **`BackupStorageClass`** kind (cluster-scoped) now describes a storage technology: its parameters, authentication modes, validation rules and forms. Core ships one class, `s3`, for Amazon S3 and S3-compatible stores. Its `implementation` parameter (`aws`, `minio`, `ceph`, `gcs` or `other`) covers gateways that need engine-specific settings.

```yaml
apiVersion: backup.openeverest.io/v1alpha1
kind: BackupStorage
metadata: {name: s3-prod, namespace: team-a}
spec:
  backupStorageClassRef: {name: s3}                                   # immutable
  location: {objectStore: {bucket: my-backups, prefix: team-a/prod}}  # immutable
  parameters: {region: us-east-1, endpointURL: https://s3.us-east-1.amazonaws.com}
  authentication:
    mode: AccessKey
    credentialsSecretRef: {name: s3-prod-credentials}  # AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
  tls: {ca: {secretKeyRef: {name: s3-prod-ca, key: ca.crt}}}           # optional
```

- Each `BackupClass` declares which storage classes and authentication modes it can write to. Core publishes once whether a class works with a Provider and with each storage. Incompatible backups, restores and imports are rejected when they are created, not after they fail.
- An Instance judges each of its storages separately. One broken storage no longer blocks the others, and schedules keep running against the last configuration that worked.
- Each Instance writes to its own path in the bucket (`<prefix>/backups/<namespace>/<instance>/<uid>/<storage>`), and every Backup records its path. Restores still resolve after the source Instance is gone.
- A storage that Instances, Backups, Restores or imports still use cannot be deleted. It reports `Deleting` with reason `WaitingForReferrers`.

In the UI, storages are added and edited from the forms their class ships, and `?dryRun=All` checks a storage before it is saved. See [Backup storage](https://openeverest.io/docs/2.0.0-alpha.1/backups_and_restore/backup_storage).

### Cluster and namespace presets

Presets now come in two scopes:

- **`ClusterInstancePreset`** (cluster-scoped, previously `InstancePreset`). Providers ship these with well-known configurations.
- **`InstancePreset`** (now namespaced). These can reference objects in their namespace, such as backup storages, monitoring destinations and Secrets. Teams use them to publish their own configurations.

The self-service RBAC action is renamed from `deploy` to **`create-from-preset`**. It allows creating an Instance that is an exact copy of a preset, and its metadata is now checked against an allowlist as well. When a copy differs from its preset, the API answers `403` with reason `PresetMismatch` and lists every field that differs. A missing permission returns a plain `403`, so users can tell the two apart.

See [Instance presets](https://openeverest.io/docs/2.0.0-alpha.1/administer/instance_presets).

### Lifecycle events and an open-source audit plugin

Lifecycle events are now stored as Kubernetes Events, the same way Argo CD records its audit trail. They are served per cluster at `GET /v1/clusters/{cluster}/events`. Events are recorded for every change, whether it was made through the API, `kubectl` or GitOps. Each event names the actor and, for Instances, Backups and Restores, the Instance and its provider. Clients list the events, then stream new ones with `watch=true&since=<resourceVersion>`.

Reading events needs the new `read-events` action on the object's resource. Login and logout events need `read` on `platform-events`. Events are kept for the cluster's Event TTL, one hour by default. See [Lifecycle events](https://openeverest.io/docs/2.0.0-alpha.1/administer/events).

[solanicaio/plugin-audit](https://github.com/solanicaio/plugin-audit), an open-source generic plugin, consumes this stream. It stores the events and adds a searchable audit log to the UI.

### Import databases from external backups, and manage their Secrets

**Import database** creates a database from a backup that is already in a backup storage and has no live source Instance. Use it for a migration, for disaster recovery, or to copy a database from another cluster. A `BackupClass` declares whether it supports imports. A Backup records the engine version, topology and backup type of its source, so the UI can tell in advance whether a restore will work. If an import was given the wrong user credentials, the Instance now fails with a condition instead of restoring forever.

The **Secrets API** now manages every Secret labelled for OpenEverest: provider Secrets, monitoring and backup storage credentials, and CA bundles (`openeverest.io/definition: ca-bundle`, under the key `ca.crt`).

- Rotate credentials in place with `PATCH …/secrets/{name}`, a JSON merge patch that requires `resourceVersion`.
- Every Secret write supports `?dryRun=All`.
- Responses never include data, and they return only allowlisted metadata.
- Referencing a Secret from a destination or a storage needs the new `secrets:use` permission. Seeing a Secret's name is not enough.
- Core counts the monitoring destinations that use each Secret. A Secret in use cannot be deleted, and the API answers `409 InUse`. Backup storage Secrets are not protected yet.

See [Secrets and credentials](https://openeverest.io/docs/2.0.0-alpha.1/security/secrets).

### SSO reworked

The UI now exchanges the IdP's **ID token** for an OpenEverest token on `POST /v1/auth/token`, using an RFC 8693 token-exchange grant. ID tokens are fully validated: signature, issuer, audience and `azp`, and they must have been issued in the last 5 minutes. IdPs that give the browser opaque access tokens, such as Auth0 and Authentik, now work. The API accepts only tokens OpenEverest issued itself. Invalid OIDC settings disable SSO with an error log instead of stopping the API server.

The login screen is redesigned and works on mobile.

See [SSO and IdP integration](https://openeverest.io/docs/2.0.0-alpha.1/security/sso_idp_integration) and the SSO items in [Breaking changes](#breaking-changes).

### Instance status that generic tools understand

`status.phase` had eleven values, which made it the source of truth. It now has three display values: `Pending` (never served clients), `Provisioned` (has been available) and `Terminating`. Conditions carry the rest, as the [Kubernetes API conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#typical-status-properties) recommend:

- **Summary conditions:**
  - `Available`: can clients connect right now? It stays `True` through a rolling upgrade.
  - `Ready`: is the latest spec carried out? Its `reason` is the status word, such as `Creating`, `ApplyingChanges`, `Upgrading`, `Restoring` or `CrashLoopBackOff`.
  - `Reconciling`, `Stalled` and `NeedsAttention`.
- **Checks:** `ReferencesResolved`, `Synced`, `PodsScheduled`, `PodsReady`, `EngineHealthy`, `DataSourceReady` and `BackupConfigured` gate `Ready`. `ConnectionDetailsReady`, `MonitoringConfigured` and `MonitoringReady` do not.
- **Operations:** `Restoring`, `Upgrading` and `StorageResizing`.
- **`Unattended`**, written by core when no provider reconciles the Instance. Its reason is `ProviderNotFound` when the named provider is not installed (including a typo), or `NotResponding` when the provider has stopped reporting.

`status.observedGeneration` tells a stale status from a current one, so `kubectl wait --for=condition=Ready`, kstatus, Flux and Helm 4 work as expected. `kubectl get instances` shows `AVAILABLE` and `STATUS` columns. The UI shows the same status word everywhere, and a single alert explains what needs attention.

```console
$ kubectl get instances
NAME      PROVIDER                 VERSION   AVAILABLE   STATUS                  AGE
billing   percona-server-mongodb   8.0.8     True        Upgrading               42m
legacy    percona-server-mongodb   8.0.32    False       CrashLoopBackOff        3m6s
orders    percona-server-mongodb   8.0.12    True        Ready                   8m29s
```

See [Instance](https://openeverest.io/docs/2.0.0-alpha.1/crd/instance).

### Invalid specs are rejected when they are written

Providers can serve an admission webhook that checks every Instance against what the Provider declares: parameter schemas, the fields each topology supports, the version catalog, and the provider's own rules. An invalid spec is rejected however it is written (`kubectl`, Argo CD, Flux, the API or the UI), with every error on its field path. The HTTP API returns these errors on a `422` as per-field `causes`, and admission warnings as `Warning` headers. `?dryRun=All` validates an Instance write without saving it.

---

## Breaking changes

There is no conversion for any of these changes, because v2 previews are fresh installs.

### For everyone

**1. Instance status.** `status.phase` is now `Pending`, `Provisioned` or `Terminating`. `status.message` is removed; read the message of the `Ready` condition instead. `spec.providerRef` is immutable. Gate actions on conditions, not on the phase. Providers on the old provider-runtime write phases the CRD now rejects, so their status is never updated.

**2. `MonitoringConfig` is removed**: the CRD, the `/monitoring-configs` routes, the `monitoring-configs` RBAC resource, and `pmm` monitoring components on Instances. The API server does not start while the `everest-rbac` policy still names `monitoring-configs`. Install a monitoring integration, create a `MonitoringDestination`, and list it in `spec.monitoring.destinations[]`. Core no longer installs the VictoriaMetrics operator or kube-state-metrics.

**3. `BackupStorage` is reshaped.** `spec.type`, `spec.s3` and the write-only `accessKeyId` and `secretAccessKey` fields are replaced by `backupStorageClassRef`, `location.objectStore`, `parameters`, `authentication` and `tls`. The class and the location are immutable. The API server no longer creates credentials Secrets: create the Secret first (`POST …/secrets`), then the storage. `Anonymous` authentication is refused.

**4. Presets.** `InstancePreset` is now namespace-scoped. The cluster-scoped kind is `ClusterInstancePreset`, with its own routes (`/clusters/{cluster}/cluster-instance-presets`), its own RBAC resource (`cluster-instance-presets`) and its own Instance annotation (`openeverest.io/cluster-instance-preset`). The `…/resolve` endpoint is removed.

**5. RBAC.**
- `instances, deploy` is renamed to `instances, create-from-preset`. Policies that still use `deploy` fail validation, and the API server does not start with them.
- Referencing a Secret from a `MonitoringDestination` or a `BackupStorage`, or changing the spec of one that references a Secret, needs `secrets, use` on that Secret. `read` is no longer enough.
- Creating a `BackupImport` needs `backup-imports, create` on the whole namespace (`<cluster>/<namespace>/*`) and `backup-storages, read` on the storage.
- Listing, creating or deleting Backups with an external origin needs `backups` permissions on the whole namespace.
- Reading lifecycle events needs `read-events` on the object's resource, and login events need `platform-events, read`.

`role:admin` already has all of these.

**6. Writes from kubectl and GitOps.** The `secret-reference.openeverest.io` admission policy admits a `MonitoringDestination` or `BackupStorage` that references Secrets only when the writer can `get` those Secrets. Kubernetes' built-in `admin` and `edit` roles already can. A Flux tenant ServiceAccount, for example, may need the permission added.

**7. Secrets API.** List, get and delete return or remove every labelled Secret, including ones not created through the API. Labelled CA bundles must hold their certificates under `ca.crt`. A Secret that a monitoring destination still uses cannot be deleted: the API answers `409 InUse`.

**8. Events.** The in-memory `GET /v1/events` stream is replaced by `GET /v1/clusters/{cluster}/events`.

**9. SSO.** The changes for identity providers:
- IdP tokens are no longer accepted as bearer tokens. Scripts must exchange an ID token first.
- Groups must be in the **ID token**: for example, Keycloak's "Add to ID token" mapper, or the ID-token groups claim in Entra ID or Okta.
- ID tokens must be signed with an asymmetric key. Authentik providers that sign with HS256 need a signing key.
- Microsoft Entra ID needs a tenant-specific issuer (`https://login.microsoftonline.com/<tenant-id>/v2.0`).

**10. Uninstall.** `helm uninstall` is refused while core still protects monitoring destinations, backup storages or Secrets with its finalizers, because removing core first would leave them, and their namespaces, impossible to delete. Delete those objects, or their namespaces, then uninstall. To uninstall anyway, run `helm uninstall --no-hooks` and remove the finalizers by hand.

### For provider developers

**11. Status helpers.** `controller.Status` now reports facts: `Converged`, `Available`, `ConnectionDetails`, `Operations`, `Problems` and desired replicas per component (`WithDesiredReplicas`). The phase-named helpers (`Creating`, `Updating`, …) still work as deprecated aliases. A provider that needs edits blocked during a long operation must name it: `StorageResizing` or `Upgrading`.

**12. `Validate` takes no client.** Move rules that read other objects into `ValidateReferences`, and drop the checks the runtime now does itself: catalog lookups, required components, and single-field bounds. Instances that do not match what their Provider publishes stop syncing with `ValidationFailed`.

**13. Backup classes.**
- `BackupClass` requires `spec.backupStorageClasses`.
- `providerManaged.providerRef` replaces `supportedProviders`.
- The `Job` execution mode is removed (`spec.job`, `status.jobRef`).
- provider-runtime claims the classes a provider ships. Providers need `patch` on `backupclasses/status` and `get`, `list` and `watch` on `backupstorageclasses`.
- `BackupStorageCredentialsNotFound` is replaced by `BackupStorageNotAccepted`.

**14. Presets in provider charts.** A provider chart that ships default presets must ship them as `ClusterInstancePreset`.

**15. Monitoring.** The monitoring contract is new: `Provider.spec.monitoring`, `RequiredSources()` and `MonitoringBindings()`. The [provider-sdk](https://github.com/openeverest/provider-sdk) generates the declarations from `definition/monitoring.yaml`. A component type's `kind` is declared on `Provider.spec.componentTypes`.

---

## Known issues

- After a provider restart, a stalled Instance shows a warning again for a full deadline, because the `Stalled` timers are kept in memory. `kubectl get` columns can show the last result while the status is stale; `kubectl describe` and the UI show `Unattended`.
- For a few seconds after a backup storage or class is created, `BackupConfigured` is `False` and the Instance shows a warning.
- Nothing stops a spec edit, a second restore or a backup while a restore runs. The UI holds edits back during restores, upgrades and storage resizes.
- Argo CD has no built-in health check for Instances yet.
- A refused `helm uninstall` leaves the release marked `uninstalling`. Run `helm uninstall` again once the protected objects are gone.
- Backup storage credentials Secrets are not counted or protected from deletion yet. Deleting one that a storage still uses stops its backups.
- Events from `kubectl` deletions have no actor, and other direct Kubernetes changes name the client instead of the user.

---

## Changes

### Added

- **Monitoring integrations:** API, controllers, provider contract and HTTP routes ([#3440](https://github.com/openeverest/openeverest/pull/3440), [#3441](https://github.com/openeverest/openeverest/pull/3441), [#3442](https://github.com/openeverest/openeverest/pull/3442), [#3443](https://github.com/openeverest/openeverest/pull/3443)). Also added:
  - authentication modes and TLS on destinations ([#3472](https://github.com/openeverest/openeverest/pull/3472), [#3473](https://github.com/openeverest/openeverest/pull/3473));
  - connection sources and pod metadata for agents such as Coroot ([#3502](https://github.com/openeverest/openeverest/pull/3502), [#3551](https://github.com/openeverest/openeverest/pull/3551), [#3554](https://github.com/openeverest/openeverest/pull/3554));
  - client certificates on metrics endpoints ([#3527](https://github.com/openeverest/openeverest/pull/3527));
  - destination readiness ([#3585](https://github.com/openeverest/openeverest/pull/3585));
  - the metrics source policy ([#3605](https://github.com/openeverest/openeverest/pull/3605));
  - in-use protection, field selectors and dry run for destinations ([#3564](https://github.com/openeverest/openeverest/pull/3564), [#3589](https://github.com/openeverest/openeverest/pull/3589), [#3547](https://github.com/openeverest/openeverest/pull/3547)).
- **Monitoring UI:** wizard step, Settings page and instance overview card ([#3504](https://github.com/openeverest/openeverest/pull/3504), [#3505](https://github.com/openeverest/openeverest/pull/3505), [#3506](https://github.com/openeverest/openeverest/pull/3506), [#3528](https://github.com/openeverest/openeverest/pull/3528), [#3597](https://github.com/openeverest/openeverest/pull/3597)).
- **`BackupStorageClass`** and the built-in `s3` class ([#3508](https://github.com/openeverest/openeverest/pull/3508), [#3555](https://github.com/openeverest/openeverest/pull/3555)). Also added:
  - class and storage compatibility verdicts ([#3553](https://github.com/openeverest/openeverest/pull/3553));
  - rejection of incompatible backups, restores and imports at admission ([#3557](https://github.com/openeverest/openeverest/pull/3557));
  - dry run for storages ([#3548](https://github.com/openeverest/openeverest/pull/3548));
  - storage forms built from the class ([#3631](https://github.com/openeverest/openeverest/pull/3631), [#3632](https://github.com/openeverest/openeverest/pull/3632), [#3633](https://github.com/openeverest/openeverest/pull/3633)).
- **Namespaced `InstancePreset`** in the API, the CLI and RBAC ([#3419](https://github.com/openeverest/openeverest/pull/3419), [#3424](https://github.com/openeverest/openeverest/pull/3424), [#3430](https://github.com/openeverest/openeverest/pull/3430), [#3445](https://github.com/openeverest/openeverest/pull/3445)).
- **Lifecycle events** as Kubernetes Events, served per cluster ([#3603](https://github.com/openeverest/openeverest/pull/3603), [#3651](https://github.com/openeverest/openeverest/pull/3651)).
- **Import database** from an external backup in the UI ([#3420](https://github.com/openeverest/openeverest/pull/3420)). Also added:
  - `supportsImport` on backup classes ([#3344](https://github.com/openeverest/openeverest/pull/3344));
  - backup source metadata ([#3367](https://github.com/openeverest/openeverest/pull/3367));
  - listing Backups through the API ([#3394](https://github.com/openeverest/openeverest/pull/3394));
  - the user Secret mismatch condition ([#3463](https://github.com/openeverest/openeverest/pull/3463)).
- **Secrets API:** monitoring class and CA bundle definitions ([#3523](https://github.com/openeverest/openeverest/pull/3523), [#3524](https://github.com/openeverest/openeverest/pull/3524)), dry run ([#3580](https://github.com/openeverest/openeverest/pull/3580)), `PATCH` ([#3581](https://github.com/openeverest/openeverest/pull/3581), [#3583](https://github.com/openeverest/openeverest/pull/3583)), every labelled Secret ([#3590](https://github.com/openeverest/openeverest/pull/3590)), in-use counts and protection ([#3596](https://github.com/openeverest/openeverest/pull/3596)), and a Secret `type` on Provider Secret definitions ([#3429](https://github.com/openeverest/openeverest/pull/3429)).
- **SSO token exchange** for opaque and JWT OIDC tokens ([#3525](https://github.com/openeverest/openeverest/pull/3525)) and a new login screen ([#3469](https://github.com/openeverest/openeverest/pull/3469)).
- **Instance status:** `observedGeneration` and the `Ready` condition, backup referents on `BackupConfigured`, backup operations that stay `Pending` while a referent is missing, and the full condition model ([#3351](https://github.com/openeverest/openeverest/pull/3351), [#3352](https://github.com/openeverest/openeverest/pull/3352), [#3353](https://github.com/openeverest/openeverest/pull/3353), [#3354](https://github.com/openeverest/openeverest/pull/3354), [#3652](https://github.com/openeverest/openeverest/pull/3652)).
- **Validation:**
  - Instances are checked against their Provider ([#3359](https://github.com/openeverest/openeverest/pull/3359)).
  - `validationtest` runs a provider's validation without a cluster ([#3360](https://github.com/openeverest/openeverest/pull/3360)).
  - The Instance admission webhook ([#3362](https://github.com/openeverest/openeverest/pull/3362)).
  - A topology can offer a choice of component types ([#3536](https://github.com/openeverest/openeverest/pull/3536)).
  - Conformance and Go checks for UI schemas ([#3537](https://github.com/openeverest/openeverest/pull/3537), [#3279](https://github.com/openeverest/openeverest/pull/3279)).
- **API:**
  - `?dryRun=All` on Instance writes ([#3544](https://github.com/openeverest/openeverest/pull/3544)).
  - Per-field `causes` on a `422` ([#3535](https://github.com/openeverest/openeverest/pull/3535)), and more detail on a `409` ([#3345](https://github.com/openeverest/openeverest/pull/3345)).
  - Admission warnings as `Warning` headers ([#3538](https://github.com/openeverest/openeverest/pull/3538)).
  - `GET /v1/clusters/{cluster}/storage-classes`, now used by the UI ([#3669](https://github.com/openeverest/openeverest/pull/3669), [#3671](https://github.com/openeverest/openeverest/pull/3671)).
- **UI:**
  - `secret` and `quantity` field types in the UI generator ([#2543](https://github.com/openeverest/openeverest/pull/2543), [#3522](https://github.com/openeverest/openeverest/pull/3522) by @AdityaPimpalkar).
  - Time-based retention in the schedule form ([#3341](https://github.com/openeverest/openeverest/pull/3341) by @AdityaPimpalkar).
  - Version pickers pre-select the provider's default version ([#3507](https://github.com/openeverest/openeverest/pull/3507) by @ujjwalv01).
  - Installable providers are suggested when none are installed ([#3471](https://github.com/openeverest/openeverest/pull/3471)).
- **Uninstall check:** core refuses to uninstall while it still protects objects ([#3588](https://github.com/openeverest/openeverest/pull/3588)).
- **Project:** a documented release process and security response process, an OSS Scanner build and a threat model ([#3620](https://github.com/openeverest/openeverest/pull/3620), [#3618](https://github.com/openeverest/openeverest/pull/3618), [#3513](https://github.com/openeverest/openeverest/pull/3513), [#3514](https://github.com/openeverest/openeverest/pull/3514)).

### Changed & Improved

- **Breaking changes**, detailed in [Breaking changes](#breaking-changes):
  - [#3652](https://github.com/openeverest/openeverest/pull/3652), [#3444](https://github.com/openeverest/openeverest/pull/3444), [#3432](https://github.com/openeverest/openeverest/pull/3432), [#3509](https://github.com/openeverest/openeverest/pull/3509), [#3549](https://github.com/openeverest/openeverest/pull/3549), [#3558](https://github.com/openeverest/openeverest/pull/3558), [#3419](https://github.com/openeverest/openeverest/pull/3419), [#3495](https://github.com/openeverest/openeverest/pull/3495), [#3617](https://github.com/openeverest/openeverest/pull/3617), [#3587](https://github.com/openeverest/openeverest/pull/3587), [#3595](https://github.com/openeverest/openeverest/pull/3595);
  - [#3590](https://github.com/openeverest/openeverest/pull/3590), [#3398](https://github.com/openeverest/openeverest/pull/3398), [#3425](https://github.com/openeverest/openeverest/pull/3425), [#3603](https://github.com/openeverest/openeverest/pull/3603), [#3525](https://github.com/openeverest/openeverest/pull/3525), [#3588](https://github.com/openeverest/openeverest/pull/3588), [#3359](https://github.com/openeverest/openeverest/pull/3359), [#3473](https://github.com/openeverest/openeverest/pull/3473).
- `GET /v1/clusters/{cluster}/cluster-info` is deprecated in favour of the storage classes routes ([#3669](https://github.com/openeverest/openeverest/pull/3669)).
- Local development, CI and linting ([#3627](https://github.com/openeverest/openeverest/pull/3627), [#3512](https://github.com/openeverest/openeverest/pull/3512), [#3621](https://github.com/openeverest/openeverest/pull/3621), [#3343](https://github.com/openeverest/openeverest/pull/3343), [#3372](https://github.com/openeverest/openeverest/pull/3372), [#3599](https://github.com/openeverest/openeverest/pull/3599)).
- Dependency updates, including cert-manager 1.20.3 and k3s 1.37.2 ([#3630](https://github.com/openeverest/openeverest/pull/3630), [#3532](https://github.com/openeverest/openeverest/pull/3532), [#3570](https://github.com/openeverest/openeverest/pull/3570), [#3572](https://github.com/openeverest/openeverest/pull/3572), [#3574](https://github.com/openeverest/openeverest/pull/3574), [#3576](https://github.com/openeverest/openeverest/pull/3576)).

### Fixed

- **Security:**
  - Instance, backup and restore writes did not authorize the objects they reference ([#3310](https://github.com/openeverest/openeverest/pull/3310) by @VijetaPriya47).
  - The UI showed connection details and backup actions to users without permission ([#3305](https://github.com/openeverest/openeverest/pull/3305) by @sb123sb123).
  - Preset-only users could add any labels or annotations to an Instance ([#3617](https://github.com/openeverest/openeverest/pull/3617)).
  - Secret responses returned all metadata ([#3584](https://github.com/openeverest/openeverest/pull/3584)).
  - Preset create and update RBAC was wrong ([#3474](https://github.com/openeverest/openeverest/pull/3474)).
  - A ReDoS in `kebabize` ([#3559](https://github.com/openeverest/openeverest/pull/3559)).
- UI RBAC checks used v1 resource names ([#3427](https://github.com/openeverest/openeverest/pull/3427) by @SamarthSRao, [#3460](https://github.com/openeverest/openeverest/pull/3460)).
- The default storage class was detected from any value of `is-default-class` ([#3319](https://github.com/openeverest/openeverest/pull/3319) by @jhalak101205-cpu).
- Events: the stream always failed because `limit` was defaulted ([#3650](https://github.com/openeverest/openeverest/pull/3650)), and Provider installs were not recorded ([#3653](https://github.com/openeverest/openeverest/pull/3653)).
- provider-runtime:
  - CEL rules on integer parameters always failed ([#3614](https://github.com/openeverest/openeverest/pull/3614)).
  - The connection Secret did not name the Provider ([#3552](https://github.com/openeverest/openeverest/pull/3552)).
- Monitoring destinations could not be deleted while their Instances were being deleted ([#3586](https://github.com/openeverest/openeverest/pull/3586)).
- UI:
  - The wizard ignored form modes in defaults and validation ([#3434](https://github.com/openeverest/openeverest/pull/3434)).
  - Data source fields were auto-selected in edit mode ([#3500](https://github.com/openeverest/openeverest/pull/3500)).
  - No toast appeared after an on-demand backup ([#3421](https://github.com/openeverest/openeverest/pull/3421) by @ujjwalv01).
  - Long sidebar labels were cut off ([#3467](https://github.com/openeverest/openeverest/pull/3467)).
  - The builder seed schema put validation rules in the wrong place ([#3565](https://github.com/openeverest/openeverest/pull/3565) by @Shubhamnish1030).
- Nightly release e2e fixes ([#3370](https://github.com/openeverest/openeverest/pull/3370), [#3395](https://github.com/openeverest/openeverest/pull/3395), [#3464](https://github.com/openeverest/openeverest/pull/3464), [#3498](https://github.com/openeverest/openeverest/pull/3498), [#3634](https://github.com/openeverest/openeverest/pull/3634)).

---

## Installing OpenEverest 2.0.0 Alpha 1

### Before you install

- **Install on a fresh cluster.** You cannot upgrade from Developer Preview 4 or from v1. Several CRDs change shape, and `InstancePreset` changes scope, so there is no conversion. Running v1 and v2 side by side in one cluster is not supported.
- **Use providers built for this release.** A provider built on an older provider-runtime writes Instance phases that the new CRD rejects. Core, the Helm chart and every provider move together; the versions are listed below.
- **Keep running v1 for production.** A v1 → v2 migration path ships with v2 General Availability. See [v1 support and end-of-life timeline](#v1-support-and-end-of-life-timeline).

### Install

v2 is installed with Helm. You need a running Kubernetes cluster and `helm`.

```bash
helm repo add openeverest https://openeverest.github.io/helm-charts/
helm repo update
helm install everest-core openeverest/openeverest \
  --devel --version "2.0.0-alpha.1" \
  --namespace everest-system --create-namespace

# admin password
kubectl get secret everest-accounts -n everest-system \
  -o jsonpath='{.data.users\.yaml}' | base64 --decode | yq '.admin.passwordHash'

# UI
kubectl port-forward svc/everest 8080:8080 -n everest-system
```

`everestctl` is not published as a binary with this release, because its `install` and `uninstall` commands still target v1. To use its day-2 commands against a v2 installation, build it from source with `make build-cli` on the `v2.0.0-alpha.1` tag.

Providers and monitoring integrations are released independently. Install them from their own repositories or from the Plugin Hub, and pick versions built against `2.0.0-alpha.1`. Earlier provider releases write Instance phases this release rejects.

- Providers: [MongoDB](https://github.com/openeverest/provider-percona-server-mongodb) `TBD` · [MySQL](https://github.com/openeverest/provider-percona-xtradb-cluster) `TBD` · [PostgreSQL](https://github.com/openeverest/provider-percona-postgresql) `TBD`
- Monitoring integrations: [PMM](https://github.com/openeverest/monitoring-pmm) `0.1.0` · [Prometheus](https://github.com/openeverest/monitoring-prometheus) `0.1.0` · [VictoriaMetrics](https://github.com/openeverest/monitoring-victoriametrics) `0.1.0` · [Coroot](https://github.com/openeverest/monitoring-coroot) `0.1.0`
- Plugins: [Audit](https://github.com/solanicaio/plugin-audit) `TBD`

---

## v1 support and end-of-life timeline

| Stage | Description |
|-------|-------------|
| **Now** | v2 Alpha: testing and feedback. v1 is still the released, supported version. |
| **v2 GA** | Expected in a few months, together with the supported v1 → v2 migration path. |
| **GA + 3 months** | v1 enters Maintenance Mode: security patches and critical fixes only. |
| **GA + 12 months** | v1 reaches End of Life. |

You do not need to plan a migration during the preview. v1 stays supported, and you will not have to rebuild what you run on it by hand.

---

## Get involved

Build a provider, a monitoring integration or a plugin against the new API, and tell us where it hurts.

- [Provider SDK](https://github.com/openeverest/provider-sdk) and the [provider development guide](https://github.com/openeverest/provider-sdk/blob/main/PROVIDER_DEVELOPMENT.md)
- [Monitoring extensions](https://openeverest.io/docs/2.0.0-alpha.1/extend/monitoring-extensions) · [Generic Plugin Template](https://github.com/openeverest/generic-plugin-template) · [Generic Plugins Spec](https://github.com/openeverest/specs/blob/main/specs/003-generic-plugins.md)

---

## Thanks to our contributors

@AdityaPimpalkar, @jhalak101205-cpu, @SamarthSRao, @sb123sb123, @Shubhamnish1030, @ujjwalv01, @VijetaPriya47

---

**Full Changelog**: https://github.com/openeverest/openeverest/compare/v2.0.0-dev.4...v2.0.0-alpha.1
