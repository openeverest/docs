# OpenEverest: Frequently asked questions (FAQ)

This page outlines the most frequently asked questions (FAQs) about OpenEverest.

## What is a Provider?

A `Provider` is a resource that represents an installed database provider (for example, Percona Server for MongoDB). Each provider bundles a database operator and declares:

- The database engine it manages (MySQL, MongoDB, or PostgreSQL).
- The engine versions it supports.

Users create databases as `Instance` resources, which reference a provider and one of its supported engine versions.

## Does OpenEverest provide logs for API calls?

Yes, the OpenEverest backend has logs. It runs as an `everest-server` deployment within the `everest-system` namespace.

- Accessing these logs helps us verify whether an API call was initiated for a specific user operation.

- Identify any errors that may have occurred during that process.

:::note

OpenEverest logs are essential for troubleshooting issues when an operation is **completed**, but the corresponding Everest operator resource **fails to be created**.

:::

Run the following command to retrieve the logs from the pods associated with the deployment:

```sh
kubectl logs -f deploy/everest-server -n everest-system
```

## How to troubleshoot issues between the UI and the OpenEverest API? 

You can view the logs by running the following command:

```sh
kubectl logs -f deploy/everest-server -n everest-system
```

## How to identify which component is failing?

All communication with OpenEverest resources begins with the API.

The API (`everest-server`) creates and updates OpenEverest resources. Providers reconcile `Instance` resources and hand them to their Operator; `everest-controller` handles backups, restores, monitoring bindings and plugins.

## Recommended troubleshooting flow

When debugging, start with the API (`everest-server`), continue with the provider of the instance, and then examine the provider's Operator. For backups, restores and monitoring, also check `everest-controller`.

## Does OpenEverest install a monitoring system?

No. OpenEverest installs no monitoring system, agents or metrics stack — not PMM, not Prometheus and not VictoriaMetrics. It connects instances to the monitoring system you already run:

1. You install a **monitoring extension** for your monitoring system. It provides a `MonitoringClass`, for example `pmm` or `prometheus`.
2. You create a `MonitoringDestination` that points at your server.
3. You list the destination in the instance's `spec.monitoring.destinations`.

Whether an instance can send to a given monitoring system depends on its provider. See [Monitoring](../use/monitoring.md).
