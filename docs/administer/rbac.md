# Role-based access control

Role-based access control (RBAC) decides what each user can see and do in OpenEverest — in the UI and in the API. It is based on [Casbin](https://casbin.org/) policies: you grant actions on resources to users, groups or roles, and you can scope each grant to a namespace or a single object.

RBAC is **disabled** by default: every user who can log in can do everything. Enable it before you give other people access.

## Enable RBAC

RBAC is configured in the `everest-rbac` ConfigMap in the `everest-system` namespace:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: everest-rbac
  namespace: everest-system
data:
  enabled: "true"
  policy.csv: |
    g, admin, role:admin
```

Edit it with:

```sh
kubectl edit configmap everest-rbac -n everest-system
```

OpenEverest watches the ConfigMap and applies changes within seconds, without a restart.

You can also set the initial policy at installation with the Helm values `server.rbac.enabled` and `server.rbac.policy`. Helm writes the ConfigMap only on installation, and never overwrites it afterwards.

:::warning

Keep at least one user in `role:admin`. If you lock yourself out, edit the ConfigMap with `kubectl`.

:::

## Policy format

Each line of `policy.csv` is either a permission (`p`) or a role assignment (`g`):

```text
p, <subject>, <resource>, <action>, <object>
g, <user or group>, <role>
```

- **subject** — a user name, a group or a role. Built-in users are matched by user name. SSO users are matched by the `sub` claim of their token, and their groups by the `groups` claim. Role names start with `role:` by convention.
- **resource** — the type of object, see [Resources](#resources).
- **action** — see [Actions](#actions). `*` means all actions.
- **object** — which objects the permission applies to, see [Objects](#objects).

Wildcards (`*`) are allowed in the resource, the action and the object. A request is allowed if at least one policy allows it.

### Built-in role

`role:admin` has every action on every resource. Grant it with:

```text
g, admin, role:admin
```

### Resources

| Resource | Object format | What it controls |
| --- | --- | --- |
| `namespaces` | `<cluster>/<namespace>` | Which namespaces a user sees. |
| `providers` | `<cluster>/<provider>` | Installed providers. Users need `read` to create instances. |
| `instances` | `<cluster>/<namespace>/<instance>` | Instances. |
| `instance-presets` | `<cluster>/<namespace>/<preset>` | Namespaced instance presets. |
| `cluster-instance-presets` | `<cluster>/<preset>` | Cluster-wide instance presets. |
| `backup-storages` | `<cluster>/<namespace>/<storage>` | Backup storages. |
| `backup-classes` | `<cluster>/<class>` | Backup classes. Users need `read` to configure backups. |
| `backups` | `<cluster>/<namespace>/<instance>` | Backups **of an instance** — the object is the instance, not the backup. |
| `restores` | `<cluster>/<namespace>/<instance>` | Restores **into an instance** — the object is the instance. |
| `backup-imports` | `<cluster>/<namespace>/<name>` | Scanning storages for backups to import. |
| `monitoring-destinations` | `<cluster>/<namespace>/<name>` | Monitoring destinations. Users need `read` on a destination to use it in an instance. |
| `monitoring-classes` | `<cluster>/<class>` | Monitoring technologies (read-only). |
| `monitoring-bindings` | `<cluster>/<namespace>/<name>` | Links between instances and destinations (read-only). |
| `monitoring-configs` | `<cluster>/<namespace>/<name>` | Legacy monitoring endpoints in **Settings**. Being removed. |
| `plugins` | `<cluster>/<plugin>` | Registered plugins. |
| `plugin/<name>` | `*` | Using a plugin's pages and API. |
| `clusters` | `<cluster>` | Managed Kubernetes clusters. |

OpenEverest currently manages one Kubernetes cluster, which is always called `main`.

### Actions

| Action | Meaning |
| --- | --- |
| `read` | See the object. |
| `create`, `update`, `delete` | Change the object. |
| `read-connection` | Read an instance's credentials. **`read` does not include it**, so read-only users can see an instance without seeing its password. |
| `deploy` | Create an instance with any settings. Users with `create` but without `deploy` can only create instances that match an [instance preset](instance_presets.md) exactly. |
| `use` | Use a plugin (on the `plugin/<name>` resource). |
| `*` | All actions. |

### Objects

Objects are paths that start with the cluster name. Use `*` to match any value in a segment:

| Object | Matches |
| --- | --- |
| `*/*/*` | Every instance in every namespace. |
| `main/team-a/*` | Every instance in the `team-a` namespace. |
| `main/team-a/orders-db` | Only the `orders-db` instance. |
| `main/*` | Every namespace (for `namespaces`) or every provider (for `providers`). |

## Examples

### Read-only users

```text
p, role:viewer, namespaces, read, */*
p, role:viewer, providers, read, */*
p, role:viewer, backup-classes, read, */*
p, role:viewer, instances, read, */*/*
p, role:viewer, backups, read, */*/*
p, role:viewer, restores, read, */*/*
p, role:viewer, backup-storages, read, */*/*
g, alice, role:viewer
```

Alice can browse everything but can't change anything or see credentials.

### A team that owns a namespace

```text
p, role:team-a, namespaces, read, main/team-a
p, role:team-a, providers, read, */*
p, role:team-a, backup-classes, read, */*
p, role:team-a, instances, *, main/team-a/*
p, role:team-a, backups, *, main/team-a/*
p, role:team-a, restores, *, main/team-a/*
p, role:team-a, backup-storages, *, main/team-a/*
p, role:team-a, monitoring-destinations, read, main/team-a/*
p, role:team-a, monitoring-classes, read, */*
g, bob, role:team-a
g, team-a-developers, role:team-a
```

Bob and every member of the `team-a-developers` group from the identity provider can manage instances, backups and restores in the `team-a` namespace, and see nothing else.

### Self-service with presets

```text
p, role:developer, namespaces, read, main/dev
p, role:developer, providers, read, */*
p, role:developer, instance-presets, read, main/dev/*
p, role:developer, cluster-instance-presets, read, */*
p, role:developer, instances, create, main/dev/*
p, role:developer, instances, read, main/dev/*
p, role:developer, instances, read-connection, main/dev/*
p, role:developer, instances, delete, main/dev/*
```

Developers can create instances in `dev` only from presets, because they have `create` but not `deploy`.

### Access to a plugin

```text
p, role:team-a, plugin/my-plugin, use, *
```

## Validate a policy

Check a policy file for syntax errors, unknown roles, resources and actions before you apply it:

```sh
everestctl settings rbac validate --policy-file policy.csv
```

The validator does not know the `plugin/<name>` resources yet and reports them as unknown; you can ignore that error. `everestctl` is built from source for OpenEverest 2 — see [Users](manage_users.md#manage-built-in-users-with-everestctl).

To see the effective permissions of the current user, call `GET /v1/permissions` in the [API](../API.md).

## Use groups from your identity provider

See [RBAC with IdP groups](Idp_groups_integration.md).
