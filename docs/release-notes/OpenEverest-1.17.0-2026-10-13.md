# What's new in OpenEverest 1.17.0

➡️ **New to OpenEverest?** Get started with our [Quickstart Guide](../quick-install.md).

> ⚠️ **Important Upgrade Notice**: Built-in account passwords must now be at least 8 characters ([#2936](https://github.com/openeverest/openeverest/pull/2936)). There are no other breaking changes; the standard v1 upgrade path applies.

---

## 🌟 Release highlights

### New operator versions

OpenEverest 1.17.0 adds support for PostgreSQL operator v3.1.0 ([#3235](https://github.com/openeverest/openeverest/pull/3235)) and Percona Server for MongoDB operator v1.23.1 ([#2972](https://github.com/openeverest/openeverest/pull/2972)), the latest operator releases for both engines.

### SSO login fixed and extended

SSO logins no longer stall on redirect — the issue tracked in [#2306](https://github.com/openeverest/openeverest/issues/2306) is fixed ([#2525](https://github.com/openeverest/openeverest/pull/2525)) — and OpenEverest can now accept opaque tokens from identity providers ([#3128](https://github.com/openeverest/openeverest/pull/3128)).

### A more reliable `everestctl upgrade`

`everestctl upgrade` now upgrades the `everest-crds` release instead of refusing it ([#3238](https://github.com/openeverest/openeverest/pull/3238)), so upgrades complete cleanly. The CLI also honors `--helm.reuse-values` during upgrades ([#2826](https://github.com/openeverest/openeverest/pull/2826)), respects `--skip-wizard` in `everestctl namespaces update` ([#2811](https://github.com/openeverest/openeverest/pull/2811)), reports the correct operator constraint string on upgrade errors ([#2843](https://github.com/openeverest/openeverest/pull/2843)), and rejects invalid subcommands with a clear error ([#3132](https://github.com/openeverest/openeverest/pull/3132)).

### Security and stability hardening

This release hardens the API server and its authentication paths. RBAC is now enforced before backup-storage endpoint validation, closing an SSRF vector ([#2937](https://github.com/openeverest/openeverest/pull/2937)); OIDC well-known and JWKS responses are size-bounded ([#3296](https://github.com/openeverest/openeverest/pull/3296)), with an HTTP timeout on the well-known config fetch ([#2725](https://github.com/openeverest/openeverest/pull/2725)); and HTTP listeners set read and idle timeouts ([#2949](https://github.com/openeverest/openeverest/pull/2949)). Several panics and races are fixed — invalid JWT private key PEM ([#2851](https://github.com/openeverest/openeverest/pull/2851)), the rate-limiter data race ([#2881](https://github.com/openeverest/openeverest/pull/2881)), and an account read-modify-write race ([#2836](https://github.com/openeverest/openeverest/pull/2836)) — and the server now shuts down gracefully on SIGTERM ([#2820](https://github.com/openeverest/openeverest/pull/2820)) and recovers handler panics into a generic HTTP 500 ([#3201](https://github.com/openeverest/openeverest/pull/3201)).

---

## 📝 Changes

### Added

- [#3235](https://github.com/openeverest/openeverest/pull/3235): Support for PostgreSQL operator (PGO) v3.1.0.
- [#2972](https://github.com/openeverest/openeverest/pull/2972): Support for Percona Server for MongoDB operator v1.23.1.
- [#3128](https://github.com/openeverest/openeverest/pull/3128): SSO login now accepts opaque tokens from identity providers.

### Changed & Improved

- [#2456](https://github.com/openeverest/openeverest/pull/2456), [#2748](https://github.com/openeverest/openeverest/pull/2748): Backup-storage endpoint validation now runs over a dedicated HTTP client using the official AWS SDK for Go v2.
- [#2932](https://github.com/openeverest/openeverest/pull/2932): The Helm chart picks up the multi-arch `helmtools` image, so arm64 clusters pull the correct architecture.
- [#2936](https://github.com/openeverest/openeverest/pull/2936): Built-in account passwords must now be at least 8 characters.
- [#2655](https://github.com/openeverest/openeverest/pull/2655): UI: casbin.js upgraded to v1.2.0; the bundled axios override is removed.
- [#3159](https://github.com/openeverest/openeverest/pull/3159): RBAC policy refresh no longer duplicates its ConfigMap read.
- Documentation clean-up — typo and link fixes, clearer v1/v2 branch documentation ([#2622](https://github.com/openeverest/openeverest/pull/2622), [#2625](https://github.com/openeverest/openeverest/pull/2625), [#2624](https://github.com/openeverest/openeverest/pull/2624), [#2778](https://github.com/openeverest/openeverest/pull/2778), [#2458](https://github.com/openeverest/openeverest/pull/2458), [#2460](https://github.com/openeverest/openeverest/pull/2460), [#2796](https://github.com/openeverest/openeverest/pull/2796), [#2838](https://github.com/openeverest/openeverest/pull/2838), [#2984](https://github.com/openeverest/openeverest/pull/2984), [#2986](https://github.com/openeverest/openeverest/pull/2986)).

### Fixed

- [#2937](https://github.com/openeverest/openeverest/pull/2937): RBAC is enforced before endpoint validation, preventing SSRF through backup-storage URLs.
- [#3296](https://github.com/openeverest/openeverest/pull/3296): OIDC JWKS and well-known responses are size-bounded, preventing OOM from oversized responses.
- [#2725](https://github.com/openeverest/openeverest/pull/2725): The OIDC well-known config fetch now has an HTTP timeout.
- [#2949](https://github.com/openeverest/openeverest/pull/2949): Plain and TLS HTTP listeners set `ReadTimeout` and `IdleTimeout`.
- [#2851](https://github.com/openeverest/openeverest/pull/2851): An invalid JWT private key PEM no longer causes a nil-pointer panic.
- [#2881](https://github.com/openeverest/openeverest/pull/2881): The rate limiter no longer races between `Allow` and `IncreaseTimeout`.
- [#2836](https://github.com/openeverest/openeverest/pull/2836): Account management: the read-modify-write race condition is resolved.
- [#2820](https://github.com/openeverest/openeverest/pull/2820): The server handles SIGTERM and shuts down gracefully ([#2809](https://github.com/openeverest/openeverest/issues/2809)).
- [#3201](https://github.com/openeverest/openeverest/pull/3201): Handler panics are recovered into a generic HTTP 500.
- [#2854](https://github.com/openeverest/openeverest/pull/2854): Version-service response reading is bounded, preventing an OOM crash.
- [#2822](https://github.com/openeverest/openeverest/pull/2822): RBAC ConfigMap adapter calls to the Kubernetes API have a configurable timeout ([#2799](https://github.com/openeverest/openeverest/issues/2799)).
- [#2830](https://github.com/openeverest/openeverest/pull/2830): RBAC informer start errors are preserved.
- [#2791](https://github.com/openeverest/openeverest/pull/2791): An invalid RBAC policy refresh no longer panics.
- [#3186](https://github.com/openeverest/openeverest/pull/3186): Hyphen is a literal character in the `validateTerms` charset.
- [#2525](https://github.com/openeverest/openeverest/pull/2525): SSO login completes its redirect correctly ([#2306](https://github.com/openeverest/openeverest/issues/2306)).
- [#3238](https://github.com/openeverest/openeverest/pull/3238): `everestctl upgrade` upgrades the `everest-crds` release instead of refusing.
- [#2826](https://github.com/openeverest/openeverest/pull/2826): `--helm.reuse-values` is bound to `ReuseValues` in `everestctl upgrade`.
- [#2811](https://github.com/openeverest/openeverest/pull/2811): `everestctl namespaces update` respects `--skip-wizard`.
- [#3132](https://github.com/openeverest/openeverest/pull/3132): Invalid subcommands of parent commands now error out.
- [#2843](https://github.com/openeverest/openeverest/pull/2843): Upgrade errors display the correct operator constraint string.
- [#2252](https://github.com/openeverest/openeverest/pull/2252), [#2444](https://github.com/openeverest/openeverest/pull/2444), [#2861](https://github.com/openeverest/openeverest/pull/2861): Typo fixes in CLI error messages and the supported-version list.
- [#2834](https://github.com/openeverest/openeverest/pull/2834): The PITR restorable date is truncated to whole seconds.
- [#2719](https://github.com/openeverest/openeverest/pull/2719): Init-container resources are counted in `GetConsumedCPUAndMemory`.
- [#3047](https://github.com/openeverest/openeverest/pull/3047): The memory parser handles the Kubernetes milli-byte suffix.
- [#2413](https://github.com/openeverest/openeverest/pull/2413): `oldVersion` is validated as semver before slicing in the version-upgrade check.
- [#2943](https://github.com/openeverest/openeverest/pull/2943): Dropped errors are wrapped in the monitoring instance handler.
- [#2828](https://github.com/openeverest/openeverest/pull/2828): The Everest API client uses a fresh backoff per operation.
- [#2406](https://github.com/openeverest/openeverest/pull/2406): Leftover debug output removed from DB-engine upgrade validation.
- [#2663](https://github.com/openeverest/openeverest/pull/2663): The install-time RenderTemplates error is fixed.
- [#2571](https://github.com/openeverest/openeverest/pull/2571): The login page keeps its spacing between intro text and community links.
- [#2800](https://github.com/openeverest/openeverest/pull/2800): The incorrect `IncreaseTimeout` call is removed from `DeleteSession`.

---

## 🚀 Upgrade to OpenEverest 1.17.0

### Using everestctl

```sh
everestctl upgrade
```

### Using Helm directly

Start with an update of Custom Resource Definitions (CRDs):
```sh
helm repo update
helm upgrade --install everest-crds \
    openeverest/everest-crds \
    --namespace everest-system \
    --take-ownership
```

Update OpenEverest itself:

```sh
helm upgrade everest openeverest/everest -n everest-system
```

---

## Thanks to our community contributors

25 people (maintainers excluded) contributed to this release — thank you:

@abhisheksainimitawa, @alexsmolya, @alishair7071, @alloutflo, @amh1k, @Anuragkumar-687, @ashnaaseth2325-oss, @Atishyy27, @ayushgupta-h, @Bhupesh-081, @false200, @HamidKhan1001, @Harkirat1309, @Harsh63870, @jadhavgaurav, @Jay2006sawant, @KrishnaParihar1, @lekaf974, @Pranav-IIITM, @RishiSingh13, @riddhij-7, @sahilforkshere, @singhshresth26, @VijetaPriya47

**First-time contributors:** @abhisheksainimitawa, @alexsmolya, @alloutflo, @amh1k, @Anuragkumar-687, @Atishyy27, @ayushgupta-h, @Bhupesh-081, @false200, @HamidKhan1001, @Harkirat1309, @Harsh63870, @jadhavgaurav, @Jay2006sawant, @KrishnaParihar1, @lekaf974, @riddhij-7, @RishiSingh13, @sahilforkshere, @singhshresth26 — welcome! 🎉

---

**Full Changelog**: https://github.com/openeverest/openeverest/compare/v1.16.2...v1.17.0
