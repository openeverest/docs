# Welcome to OpenEverest

OpenEverest is an open-source platform for running data workloads on Kubernetes. It gives you one UI, one API and one access-control model for provisioning and operating databases, caches, vector stores, object storage, AI model serving and other stateful technologies — on any Kubernetes cluster, in the cloud or on-premises.

:::warning[Developer Preview]

These docs describe OpenEverest 2, which is a **Developer Preview**: it is not feature-complete and not intended for production. OpenEverest 1.x remains the supported release — see the [1.x documentation](https://openeverest.io/docs/current/).

:::

## How it works

OpenEverest has a small, technology-agnostic core. Everything that is specific to a technology lives in a **Provider** that you install next to the core:

- The **core** gives you the web UI, the REST API, authentication, role-based access control, backups and monitoring as common building blocks.
- Each **Provider** teaches OpenEverest how to run one technology, usually by driving a Kubernetes Operator. The [Plugin Hub](extend/hub.md) lists the available providers, and anyone can build a new one.
- **Generic plugins** add features that are not tied to one technology, such as metrics dashboards or benchmarking tools.

You pick the providers you need. Every running deployment — whatever the technology — is an **Instance** that you create, scale, back up, restore and delete in the same way.

![OpenEverest UI listing the installed providers](images/v2-empty-state.png)

Learn more in [Architecture](concepts/architecture.md) and [Key concepts](concepts/key-concepts.md).

## Get started

<span className="oe-button">[Quickstart →](quick-install.md)</span>  <span className="oe-button">[Create your first instance →](use/create_instance.md)</span>

<div className="oe-grid">

<div className="oe-card">

### Add technologies

Install providers for the technologies you need, and discover more in the Plugin Hub.

<span className="oe-button oe-button--primary">[Add providers →](install/install_providers.md)</span>

</div>

<div className="oe-card">

### Protect your data

Store backups in S3-compatible storage, schedule them, and restore to any point in time.

<span className="oe-button oe-button--primary">[Backup and restore →](backups_and_restore/AboutBackups.md)</span>

</div>

<div className="oe-card">

### Control access

Connect your identity provider and decide who can do what, down to a single instance.

<span className="oe-button oe-button--primary">[Role-based access control →](administer/rbac.md)</span>

</div>

<div className="oe-card">

### Build an extension

Bring a new technology or feature to OpenEverest without changing the core.

<span className="oe-button oe-button--primary">[Extend OpenEverest →](extend/index.md)</span>

</div>

</div>
