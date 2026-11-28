# Install with Argo CD

You can manage OpenEverest, its providers and your database instances with [Argo CD](https://argo-cd.readthedocs.io/). This page shows a tested setup: OpenEverest `2.0.0-alpha.1` and the Percona Server for MongoDB provider `0.6.1` on Argo CD `v3.6`.

The setup uses three Argo CD Applications, synced in order:

| Wave | Application | Source |
|------|-------------|--------|
| 0 | `openeverest` | OpenEverest Helm chart |
| 1 | `provider-percona-server-mongodb` | Provider Helm chart |
| 2 | `databases` | Your Git repository with `Instance` manifests |

You can wrap them in an [app of apps](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/) so the sync waves apply.

## Before you begin

- A cluster that meets the [prerequisites](prerequisites.md).
- Argo CD v2.10 or later, with access to `https://openeverest.github.io/helm-charts/` and the OCI registry `ghcr.io/openeverest/charts`.

## Step 1: Add a health check for instances

Argo CD doesn't know how to read the health of an OpenEverest `Instance`. Without a health check, an Application reports **Healthy** even when an instance failed validation. Add this check to the `argocd-cm` ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  resource.customizations.health.core.openeverest.io_Instance: |
    hs = { status = "Progressing", message = "Waiting for the provider to report on this Instance" }
    if obj.status == nil then
      return hs
    end
    if obj.metadata.generation ~= nil and obj.status.observedGeneration ~= nil
        and obj.status.observedGeneration < obj.metadata.generation then
      return hs
    end
    local ready = nil
    if obj.status.conditions ~= nil then
      for _, c in ipairs(obj.status.conditions) do
        if c.type == "Stalled" and c.status == "True" then
          hs.status = "Degraded"
          hs.message = c.message
          return hs
        end
        if c.type == "Ready" then
          ready = c
        end
      end
    end
    if ready ~= nil then
      hs.message = ready.message
      if ready.status == "True" then
        hs.status = "Healthy"
      end
    end
    return hs
```

With it, an instance that is stalled (for example, one rejected by validation) shows as **Degraded** with the reason. An instance that is being created or updated shows as **Progressing**. An instance that is ready shows as **Healthy**.

## Step 2: Install OpenEverest

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: openeverest
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "0"
spec:
  project: default
  source:
    repoURL: https://openeverest.github.io/helm-charts/
    chart: openeverest
    targetRevision: 2.0.0-alpha.1
    helm:
      valuesObject:
        upgrade:
          preflightChecks: false
  destination:
    server: https://kubernetes.default.svc
    namespace: everest-system
  ignoreDifferences:
    - group: ""
      kind: Secret
      name: everest-jwt
      namespace: everest-system
      jsonPointers: [/data]
    - group: ""
      kind: Secret
      name: everest-accounts
      namespace: everest-system
      jsonPointers: [/data]
      jqPathExpressions: ['.metadata.annotations["insecure-password/admin"]']
    - group: ""
      kind: Secret
      name: everest-controller-webhook-server-cert
      namespace: everest-system
      jsonPointers: [/data]
    - group: admissionregistration.k8s.io
      kind: ValidatingWebhookConfiguration
      name: everest-controller-validating-webhook-configuration
      jqPathExpressions: [".webhooks[]?.clientConfig.caBundle"]
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - RespectIgnoreDifferences=true
      - ServerSideApply=true
```

Why these settings are needed:

- **`upgrade.preflightChecks: false`**. The chart runs a pre-upgrade check as a Helm hook. Argo CD runs it as a `PreSync` hook on every sync, the check fails outside `helm upgrade`, and the sync hangs.
- **`ignoreDifferences` for `everest-jwt` and `everest-accounts`**. The chart generates the JWT signing key and the initial admin password. Argo CD renders the chart with `helm template` on every sync, so it would otherwise replace them with new random values. That would log everyone out and reset the admin password.
- **The `insecure-password/admin` annotation**. The chart marks the initial admin password as plain text with this annotation. `everestctl accounts set-password` stores a hash and removes the annotation. Without the ignore rule, Argo CD adds the annotation back, OpenEverest then reads the hash as a plain-text password, and the admin can no longer log in.
- **The webhook certificate and `caBundle`**. These are generated at render time and would change on every sync.
- **`RespectIgnoreDifferences=true`**. Makes Argo CD skip the ignored fields when it applies, not only when it compares.

Get the initial admin password as described in [Install OpenEverest](install_everest_helm_charts.md).

## Step 3: Add a provider

Install the provider in a later sync wave. Add a `retry` policy: on the first sync, the provider's resources depend on OpenEverest CRDs that the Kubernetes API may not serve yet. Argo CD doesn't retry a failed sync of the same revision on its own.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: provider-percona-server-mongodb
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  project: default
  source:
    repoURL: ghcr.io/openeverest/charts
    chart: provider-percona-server-mongodb
    targetRevision: 0.6.1
  destination:
    server: https://kubernetes.default.svc
    namespace: everest-system
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    retry:
      limit: 10
      backoff:
        duration: 10s
        factor: 2
        maxDuration: 3m
    syncOptions:
      - ServerSideApply=true
```

The `ghcr.io/openeverest/charts` repository must be registered in Argo CD as an OCI Helm repository. See [Add providers](install_providers.md) for the provider versions that match your OpenEverest version.

## Step 4: Manage instances in Git

Store `Instance` manifests in your repository and point an Application at them:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: databases
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "2"
spec:
  project: default
  source:
    repoURL: https://github.com/<your-org>/<your-repo>.git
    targetRevision: main
    path: databases
  destination:
    server: https://kubernetes.default.svc
    namespace: databases
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    retry:
      limit: 10
      backoff:
        duration: 10s
        factor: 2
        maxDuration: 3m
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

For example, `databases/mongodb.yaml`:

```yaml
apiVersion: core.openeverest.io/v1alpha1
kind: Instance
metadata:
  name: mongodb
  namespace: databases
spec:
  providerRef:
    name: percona-server-mongodb
  components:
    engine:
      type: mongod
      replicas: 3
      resources:
        requests:
          cpu: 500m
          memory: 1G
        limits:
          cpu: "1"
          memory: 2G
      storage:
        size: 10Gi
```

With `selfHeal`, Git is the source of truth. If someone scales the instance in the UI or with `kubectl`, Argo CD reverts the change. Make changes in Git.

## Day-2 operations

- **RBAC and SSO.** The chart renders the `everest-rbac` ConfigMap, and the `everest-settings` ConfigMap when OIDC is configured, so Argo CD owns them. Set the policy with the `server.rbac.enabled` and `server.rbac.policy` values and SSO with the `server.oidc` values. Argo CD reverts changes made with `kubectl edit`, `everestctl` or the UI. See [RBAC](../administer/rbac.md) and [SSO](../security/sso_idp_integration.md).
- **Passwords.** `everestctl accounts set-password` works with the ignore rules above.
- **Upgrades.** Change `targetRevision` in Git. Upgrade providers to versions that support the new OpenEverest version. See [Upgrade with Helm](../upgrade/upgrade_with_helm.md).

:::note[Coming next: fewer ignore rules]
In an upcoming release, the OpenEverest controller creates the JWT key, the admin account, the RBAC policy and the settings ConfigMap itself, and the chart stops rendering them. With that release:

- you no longer need the `everest-jwt` and `everest-accounts` ignore rules;
- you can change RBAC and SSO settings in the cluster without Argo CD reverting them.

When you upgrade to that release, Argo CD sees these four objects disappear from the chart and **prunes them**. The controller then creates new ones: a new admin password, a new JWT key that logs everyone out, and the default RBAC policy. To keep them, before you upgrade, mark them so Argo CD doesn't prune them:

```sh
for r in secret/everest-jwt secret/everest-accounts configmap/everest-rbac configmap/everest-settings; do
  kubectl -n everest-system annotate "$r" argocd.argoproj.io/sync-options=Prune=false --overwrite
done
```

After the upgrade syncs, remove the Argo CD annotations so the Application stops tracking them and shows **Synced**:

```sh
for r in secret/everest-jwt secret/everest-accounts configmap/everest-rbac configmap/everest-settings; do
  kubectl -n everest-system annotate "$r" argocd.argoproj.io/sync-options- argocd.argoproj.io/tracking-id-
done
```

The release notes for that version will say when this applies.
:::
