# Key concepts

This page explains the terms used throughout OpenEverest. They are the same in the UI, the API and the Kubernetes custom resources.

## Provider

A provider adds one technology to OpenEverest — for example PostgreSQL, MongoDB, Valkey or ClickHouse. You install it with Helm next to the core, and it registers a cluster-wide `Provider` resource that describes:

- the **versions** it can deploy, and the default one;
- the **topologies** it offers;
- the **components** each topology is made of;
- the **UI schema** that OpenEverest uses to generate the creation and edit forms.

List the installed providers with:

```sh
kubectl get providers
```

See [Providers](../extend/providers.md) and [Add providers](../install/install_providers.md).

## Instance

An instance is one running deployment of a technology: a PostgreSQL cluster, a MongoDB replica set, a Valkey cache. Every instance, whatever the technology, is an `Instance` custom resource in a namespace, and you manage all of them the same way — from the **Instances** page, the API or `kubectl`.

```yaml
apiVersion: core.openeverest.io/v1alpha1
kind: Instance
metadata:
  name: orders-db
  namespace: demo
spec:
  providerRef:
    name: provider-percona-postgresql
  version: 18.4-1
  topology:
    type: cluster
  components:
    engine:
      replicas: 2
      storage:
        size: 25Gi
    proxy:
      type: pgbouncer
      replicas: 2
```

The provider fills in everything you leave out with its defaults. See [Instance](../crd/instance.md) for the full reference.

### Topology

A topology is a deployment architecture offered by a provider. The MongoDB provider, for example, offers a replica set and a sharded cluster; the Valkey provider offers a sharded cluster. You choose the topology when you create the instance.

### Component

A component is one part of an instance, such as the database `engine`, a `proxy` or connection pooler, a `configServer` or a backup agent. Each component has its own replicas, resources, storage and pod scheduling rules. Which components exist depends on the provider and topology.

### Version

The `version` of an instance selects a set of component versions that the provider has tested together. If you omit it, the provider's default version is used.

## Namespace

Instances, backup storages and presets are created in ordinary Kubernetes namespaces. OpenEverest can use every namespace in the cluster except its own system namespaces, and [RBAC](../administer/rbac.md) decides which namespaces each user can see and change. See [Namespaces](../administer/manage_namespaces.md).

## Cluster

API paths and RBAC rules include a Kubernetes cluster name, in preparation for managing several clusters from one OpenEverest. Today OpenEverest manages the cluster it runs in, which is always called `main`.

## Backups

| Term | Meaning |
| --- | --- |
| **Backup storage** | An S3-compatible bucket where backups are written. A `BackupStorage` lives in a namespace and can be used by every instance in that namespace. |
| **Backup class** | Describes *how* backups are taken for one or more providers, for example with pgBackRest. Providers install their backup classes; you normally do not create them. |
| **Backup** | One backup of an instance, taken on demand or by a schedule. |
| **Schedule** | A cron schedule on an instance that creates backups to a given storage, with optional retention by count or by time. |
| **Point-in-time recovery (PITR)** | Continuous upload of transaction logs, so you can restore to any moment instead of only to a backup. Available when the provider supports it. |
| **Restore** | Applying a backup, or a point in time, to an instance. You can restore into the same instance or create a new instance from a backup. |

See [About backups](../backups_and_restore/AboutBackups.md).

## Instance preset

A preset is a reusable starting configuration for the creation form — for example *small*, *production* or *analytics*. Presets are namespaced (`InstancePreset`) or cluster-wide (`ClusterInstancePreset`), and providers can ship their own. See [Instance presets](../administer/instance_presets.md).

## Monitoring

OpenEverest installs no monitoring system. A **monitoring extension** adds a **monitoring class** — a technology such as PMM or Prometheus. A **monitoring destination** is one server of that class, defined in a namespace with its address and credentials. An instance lists the destinations it sends to, and OpenEverest records each link as a **monitoring binding**. See [Monitoring](../use/monitoring.md).

## Generic plugin

A generic plugin extends OpenEverest with features that are not tied to one technology — new pages, sidebar entries, instance tabs and backend APIs. See [Generic plugins](../extend/generic-plugins.md).

## Plugin Hub

The Plugin Hub is the catalog of providers and plugins, shown inside OpenEverest. It tells you what is available, what is installed, and how to install the rest. See [Plugin Hub](../extend/hub.md).
