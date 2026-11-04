# Namespaces

Instances, backup storages, monitoring destinations and instance presets are created in Kubernetes namespaces. Namespaces are the main boundary for organizing instances and for controlling access to them.

## Which namespaces OpenEverest uses

OpenEverest can use every namespace in the cluster except system namespaces: `kube-system`, `kube-public`, `kube-node-lease`, its own system namespace (`everest-system`) and the system namespaces of managed Kubernetes services such as GKE.

There is nothing to install in a namespace before you use it. Providers run in `everest-system` and manage instances in any namespace.

To add a namespace, create it with `kubectl`:

```sh
kubectl create namespace team-a
```

It appears in OpenEverest right away — in **Settings** > **Namespaces** and in the **Namespace** list of the creation form.

To remove a namespace, delete its instances first, then delete the namespace with `kubectl`. Deleting a namespace deletes everything in it, including the data of its instances.

:::note

In OpenEverest 1.x, namespaces had to be added with `everestctl namespaces add`, which installed the database operators into each namespace. OpenEverest 2 does not need this: don't use `everestctl namespaces` with OpenEverest 2.

:::

## Settings > Namespaces

**Settings** > **Namespaces** lists the namespaces you have access to. Click a namespace to see its details.

## Control access to namespaces

When [RBAC](rbac.md) is enabled, each user sees only the namespaces they have `read` access to on the `namespaces` resource, and can work only with the objects in those namespaces they are granted. For example, to give a team its own namespace:

```text
p, role:team-a, namespaces, read, main/team-a
p, role:team-a, instances, *, main/team-a/*
g, team-a-developers, role:team-a
```

## Organize namespaces

Common ways to use namespaces:

- **One namespace per team**, so teams manage their own instances and can't see each other's.
- **One namespace per environment**, such as `dev`, `staging` and `prod`, each with its own backup storages, monitoring destinations and [presets](instance_presets.md).
- **Quotas and limits.** Standard Kubernetes [ResourceQuotas](https://kubernetes.io/docs/concepts/policy/resource-quotas/) and [LimitRanges](https://kubernetes.io/docs/concepts/policy/limit-ranges/) apply to instances, so you can cap the CPU, memory and storage a team can use.
