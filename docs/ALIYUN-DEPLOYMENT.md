# Aliyun deployment

The hosted instance is https://foundry.lynxai.work. Dokploy uses Raw Compose from
`compose.production.yaml`; it pulls prebuilt images and never clones or builds
on the server. Autodeploy stays disabled.

Build and push from this checkout, using the publishing machine's existing
Docker login. Target AMD64 even on Apple Silicon. Use a new release tag for each
application release, then update the image in `compose.production.yaml` and
Dokploy before deploying manually.

```sh
docker buildx build --platform linux/amd64 --file Dockerfile \
  --tag crpi-f7dryxdvv5k8r58p.cn-heyuan.personal.cr.aliyuncs.com/lynx-ai/helix-foundry:20261028-c08d5a1 \
  --provenance=false --sbom=false --push .
```

The HelixDB image is a registry mirror of the existing v0.0.12 pin in
`compose.yaml`, built with `--platform linux/amd64` from that pinned `FROM` and
pushed to `lynx-ai/helixdb:v0.0.12-amd64`. Keep the database version unchanged
when releasing the application. The publishing machine uses its existing Docker credential store. Dokploy
authenticates through Settings → Registry → Aliyun · Lynx AI, using the registry
hostname without a scheme and the Dokploy server as its target. Compose has no
per-service username/password fields. Credentials stay outside source control
and outside the Compose file.

Dokploy holds `ENCRYPTION_KEY`, `INTERNAL_KEY` and `ADMIN_TOKEN` in its environment.
Keep the original encryption and internal keys when importing local data. The
Compose file requires all three values and exposes only the app on loopback
port 6087. Caddy proxies the domain to that port. PostgreSQL and Redis are not
part of this application's storage architecture.

The two external named volumes in the production Compose file contain the
imported data. They must exist before deployment. Do not replace them, delete
them or restore over a running instance. Take a consistent snapshot by stopping
only this Foundry's containers before copying both data volumes together.

After deployment, check `/api/health`, visitor read-only access, admin token
verification, and workspace dataset/object/graph counts against the source.
Select a previous application image tag to roll back application code; do not
roll back HelixDB or data volumes as part of that operation.
