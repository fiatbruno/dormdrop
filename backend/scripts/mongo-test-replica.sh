#!/usr/bin/env bash
set -euo pipefail

# A disposable, single-node replica set for local and CI integration tests.
container=dormdrop-test-mongo
port=${DORMDROP_TEST_MONGO_PORT:-27017}

case "${1:-}" in
  start)
    docker run --detach --name "$container" --publish "127.0.0.1:${port}:27017" \
      mongo:7 --replSet rs0 --bind_ip_all >/dev/null
    for attempt in {1..60}; do
      if docker exec "$container" mongosh --quiet --eval 'db.adminCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1; then
        break
      fi
      if [ "$attempt" -eq 60 ]; then echo 'MongoDB did not start' >&2; exit 1; fi
      sleep 1
    done
    # Clients run on the host and must be able to reach the advertised address.
    docker exec "$container" mongosh --quiet --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:${port}'}]})" >/dev/null
    for attempt in {1..60}; do
      if docker exec "$container" mongosh --quiet --eval 'db.hello().isWritablePrimary' 2>/dev/null | grep -q true; then
        exit 0
      fi
      if [ "$attempt" -eq 60 ]; then echo 'MongoDB did not elect a primary' >&2; exit 1; fi
      sleep 1
    done
    ;;
  stop)
    docker rm --force "$container" >/dev/null 2>&1 || true
    ;;
  *) echo "Usage: bash $0 {start|stop}" >&2; exit 2 ;;
esac
