# Monitoring

The `monitoring.openeverest.io` API group holds the resources that connect instances to monitoring systems. For a task-oriented guide, see [Monitoring](../use/monitoring.md).

:::info[Work in progress]

These resources were added after OpenEverest 2.0.0 Developer Preview 4. Fields may change before General Availability.

:::

Short names: `mclass`, `mdest`, `mbind`.

## MonitoringClass

A cluster-scoped monitoring technology. A [monitoring extension](../extend/monitoring-extensions.md) installs the class and runs the controller that claims it; you rarely create one yourself.

```yaml
apiVersion: monitoring.openeverest.io/v1alpha1
kind: MonitoringClass
metadata:
  name: pmm
spec:
  displayName: Percona Monitoring and Management
  providerManaged:
    integration: pmm
    agentImage: percona/pmm-client:3.8.0
    agentVersion: 3.8.0
  destinationParametersSchema:
    openAPIV3Schema:
      type: object
      required: [url]
      properties:
        url:
          type: string
  authModes:
    - name: ServiceAccountToken
      credentials:
        required: [token]
```

| Field | Description |
| --- | --- |
| `displayName`, `description` | Shown in the UI. |
| `providerManaged` | Set when providers fulfil the class with their Operator's native integration. `integration` is matched against the providers' `spec.monitoring.integrations`; `agentImage` and `agentVersion` are the agent the providers run. |
| `extensionManaged` | Set when the extension fulfils the class from the endpoints providers publish. `requires.metrics` says the class needs metrics endpoints. |
| `destinationParametersSchema` | Schema of `MonitoringDestination.spec.parameters`. |
| `instanceParametersSchema` | Schema of the per-instance `parameters` in `Instance.spec.monitoring.destinations`. |
| `authModes` | Authentication modes a destination can use, and the keys its credentials Secret must contain. `WorkloadIdentity` and `Anonymous` are reserved modes that take no Secret. |
| `uiSchema` | Hints for the forms in the UI. |

**Status:**

- The `Accepted` condition is set by the extension's controller when it claims the class. It stays `Unknown` (`Pending`) until then.
- `providers` has one entry per installed provider: the `mode` its instances get (`ProviderManaged` or `ExtensionManaged`), the `disruption` that enabling the class causes (`None` or `RollingRestart`), or a `reason` and `message` when the provider is incompatible.

## MonitoringDestination

A monitoring server in a namespace. Instances in the same namespace can send to it.

```yaml
apiVersion: monitoring.openeverest.io/v1alpha1
kind: MonitoringDestination
metadata:
  name: pmm-prod
  namespace: demo
spec:
  classRef:
    name: pmm
  parameters:
    url: https://pmm.example.com
  authentication:
    mode: ServiceAccountToken
    credentialsSecretRef:
      name: pmm-token
  tls:
    ca:
      secretKeyRef:
        name: pmm-ca
        key: ca.crt
```

| Field | Description |
| --- | --- |
| `classRef.name` | **Required.** The `MonitoringClass`. Immutable. |
| `parameters` | Settings defined by the class, such as the server URL. |
| `authentication.mode` | One of the class's `authModes`. Defaults to `Anonymous`, which only some classes accept. |
| `authentication.credentialsSecretRef.name` | Secret in the same namespace with the credentials. Required for every mode except `WorkloadIdentity` and `Anonymous`. |
| `tls.ca.secretKeyRef` | Secret key holding the PEM CA bundle that the server certificate is verified against. |
| `tls.insecureSkipVerify` | Don't verify the server certificate. Can't be combined with `tls.ca`. |

**Status:**

- `Accepted` — set by OpenEverest: the class exists, the parameters match its schema, the mode is supported and the credentials are found. Reasons include `ClassNotFound`, `InvalidParameters`, `AuthModeUnsupported`, `CredentialsNotFound` and `InvalidCABundle`.
- `Ready` — set by the extension: the server is reachable and accepts the credentials. Reasons: `Ready`, `Pending`, `Unreachable`, `Unauthorized`, `UnsupportedServerVersion`, `InvalidParameters`.
- `serverVersion` — the version the server reported.

## MonitoringBinding

Created by OpenEverest for every entry in an instance's `spec.monitoring.destinations`, named `<instance>-<entry>-<hash>`. Don't create or edit bindings yourself.

| Field | Description |
| --- | --- |
| `spec.instanceRef`, `spec.destinationRef`, `spec.classRef` | The instance, destination and class the binding links. |
| `spec.executionMode` | `ProviderManaged` or `ExtensionManaged`, resolved once when the binding is accepted. |
| `spec.parameters` | The per-instance parameters of the entry. |

**Status:**

- `Accepted` — set by OpenEverest: the destination and class exist and the instance's provider can send to the class. Reasons include `DestinationNotFound`, `ClassNotFound`, `ClassNotAccepted`, `ProviderNotFound`, `IntegrationUnsupported`, `IntegrationInUse`, `Incompatible`, `InvalidParameters` and `AuthModeUnsupported`.
- `Configured` — set by whoever fulfils the binding (the provider or the extension). Reasons: `Configured`, `AgentTLSNotVerified`, `Pending`, `MaintenancePending`, `Retained`, `NotAccepted`, `RenderFailed`, `ApplyFailed`, `AgentNotReady`, `EndpointNotServing`, `ServerTooOld`, `NotSelected`.

## Instance and Provider fields

| Field | Description |
| --- | --- |
| `Instance.spec.monitoring.destinations[]` | Up to 8 entries, each with a `name`, a `destinationRef.name` in the instance's namespace and optional `parameters`. Each destination can be listed once. |
| `Instance.status.monitoring.destinations[]` | Per entry: the resolved `mode` and the `configured` status, `reason` and `message` from the binding. |
| `Instance.status.monitoring.sources` | The metrics endpoints and credentials the instance publishes for extension-managed classes. |
| `Instance` condition `MonitoringConfigured` | `True` when every destination is configured. |
| `Provider.spec.monitoring.integrations` | Operator-native integrations the provider can render, keyed by name (for example `pmm`), with the supported `agentVersions` and `authModes`. |
| `Provider.spec.monitoring.componentTypes` | What each component type exposes: its engine `kind` (for example `postgresql`) and whether `metrics` are `Native`, through an `Exporter`, or `None`. |
