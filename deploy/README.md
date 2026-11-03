# Docker deployment on port 8880

Pushes to `main` start the existing CI workflow. When that push's CI completes
successfully, this workflow builds that exact commit, publishes an AMD64 image
to GHCR and replaces the app on the server. It checks that the tested commit is
still the head of `main` before building and before deploying. The deployment restarts the app and
interrupts live streams and running strategies: use a maintenance window.
CI builds the frontend but does not auto-commit `frontend/dist`; the Dockerfile
builds the frontend into the image.

## One-time setup

1. On the Linux server install Docker and Docker Compose v2. The SSH user must
   be able to run Docker. Reserve TCP 8880 and configure the firewall.
2. Create `~/openalgo-deploy/openalgo.env` from this repository's `.sample.env`.
   Keep this file on the server, never commit it. Generate separate random
   64-hex-character values for `APP_KEY` and `API_KEY_PEPPER` (for example,
   `openssl rand -hex 32` twice). Keep these values stable across deployments.
   Set at least:

   ```dotenv
   FLASK_HOST_IP='0.0.0.0'
   FLASK_PORT='5000'
   FLASK_DEBUG='False'
   WEBSOCKET_HOST='0.0.0.0'
   WEBSOCKET_PORT='8765'
   HOST_SERVER='http://SERVER_ADDRESS:8880'
   WEBSOCKET_URL='ws://SERVER_ADDRESS:8880/ws'
   ```

   Replace SERVER_ADDRESS with the address clients use. Set `REDIRECT_URL`
   for the chosen broker as required. For the Binance integration, once its
   code is committed, set `VALID_BROKERS='binance'` and
   `OPENALGO_MARKET_DATA_BROKER='binance'`. If an upstream proxy is needed,
   configure it for the container and verify it accepts connections from the
   Docker network; the host's `127.0.0.1` is not the container's loopback.
   `host.docker.internal` resolves to the Docker host on Linux in this compose
   configuration. Do not expose a host proxy publicly.

   The container runs as UID 1000 and needs read/write access to the env file;
   protect it from other users. Named volumes persist the databases, logs,
   strategies, keys and temporary data. Back up data and configuration before
   the first deployment and upgrades.
3. In this GitHub repository configure Actions secrets `SERVER_HOST`,
   `SERVER_USER`, and `SSH_PRIVATE_KEY`. SSH host key verification is disabled:
   an attacker able to intercept the connection can impersonate the server.
   This repository's secrets are separate from
   Coin-Radar's. SSH uses port 22. The server needs outbound access to GHCR.
4. Commit and push the deployment files and all intended application changes,
   including untracked broker files, to `main`. Inspect the CI and **Deploy
   Docker** workflows and the service after deployment. The server and secrets
   must be configured before that push.

The server uses an isolated Compose project in `~/openalgo-deploy`. The image
is pulled before replacement; a failed health check attempts to restore the
previous image, but does not reverse database migrations. The proxy health
check covers HTTP only; verify live WebSocket quotes separately. This setup
serves plain HTTP on 8880. For internet use, put it behind an HTTPS/WSS reverse
proxy, update the public URLs accordingly, and restrict direct access to 8880.
Only the app and proxy ports are connected internally; ZeroMQ is not published.
