# API rate limiting

OpenEverest limits the number of requests its API accepts, to protect the server from overload and to slow down password guessing.

| Limit | Default | How to change |
| --- | --- | --- |
| API requests per second, for the whole server | 100 | Helm value `server.apiRequestsRateLimit` |
| Login requests (password grant) per second, per client IP address | 5 | Environment variable `LOGIN_RATE_LIMIT` |

When a limit is reached, the API responds with `429 Too Many Requests`. Repeated failed logins from the same IP address are slowed down further, with increasing delays.

## Change the limits

Large installations with many instances and users may need a higher API limit. Set it with Helm:

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --reuse-values \
  --set server.apiRequestsRateLimit=200
```

To change the login limit, add an environment variable to the server in your Helm values:

```yaml
server:
  env:
    - name: LOGIN_RATE_LIMIT
      value: "3"
```

The server restarts to apply the change. If you use `kubectl port-forward`, start it again afterwards.
