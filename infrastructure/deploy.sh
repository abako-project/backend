#!/usr/bin/env bash
#
# Despliegue del backend ABAKO. Vive en el repo, no solo en el servidor.
#
#   ./deploy.sh <sha> [<directorio-del-entorno>]
#
# El SHA es obligatorio y se despliega EXACTAMENTE ese commit. El script viejo
# hacía `git reset --hard origin/main`, que despliega lo que sea main en el
# momento de ejecutarse: si alguien mergeaba mientras corría el workflow, se
# publicaba un commit distinto del que lo disparó.
#
# Qué NO hace, y es deliberado:
#   - `docker compose down`: tumbaba todo, y adapter-api era el único servicio
#     sin volumen, así que su SQLite moría con el contenedor. Cada despliegue
#     borraba usuarios, proyectos, milestones y notificaciones.
#   - `docker image prune`: borraba la imagen anterior, es decir la única cosa
#     a la que se podía volver.
#   - `sleep 30` a ciegas: ahora se espera a que los healthchecks pasen.
#
# Orden: se valida todo lo validable ANTES de tocar lo que está corriendo.

set -euo pipefail

SHA="${1:?Uso: deploy.sh <sha> [directorio-del-entorno]}"
ENV_DIR="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_DIR/infrastructure/docker-compose.yml"
ENV_FILE="$ENV_DIR/.env"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-240}"

log() { echo "[$(date +'%H:%M:%S')] $*"; }
die() { echo "[$(date +'%H:%M:%S')] ERROR: $*" >&2; exit 1; }

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# --- Comprobaciones previas -------------------------------------------------
# Todo lo que pueda fallar, que falle aquí: en este punto no se ha tocado nada
# y el entorno anterior sigue en pie.

[ -f "$ENV_FILE" ] || die "no existe $ENV_FILE. Copia infrastructure/.env.example y rellénalo."

log "Verificando que el commit $SHA existe..."
git -C "$REPO_DIR" fetch --quiet origin || die "no se pudo hacer fetch de origin"
git -C "$REPO_DIR" cat-file -e "${SHA}^{commit}" 2>/dev/null || die "el commit $SHA no existe en este repositorio"

log "Validando el compose con $ENV_FILE..."
compose config --quiet || die ".env incompleto o compose inválido. No se ha tocado nada."

# --- Despliegue -------------------------------------------------------------

log "Situando el repositorio en $SHA..."
git -C "$REPO_DIR" checkout --quiet --force "$SHA"
git -C "$REPO_DIR" submodule update --init --recursive --quiet || log "sin submódulos que actualizar"

# Revalidar: el compose que acabamos de traer puede pedir variables que el
# .env del servidor todavía no tiene.
log "Revalidando el compose del commit desplegado..."
compose config --quiet || die "el compose de $SHA necesita variables que faltan en $ENV_FILE"

log "Construyendo imágenes..."
compose build || die "falló la construcción. Los contenedores anteriores siguen corriendo."

# up -d recrea solo lo que ha cambiado y deja el resto en marcha; el volumen de
# Postgres no se toca en ningún caso.
log "Levantando servicios..."
compose up -d --remove-orphans || die "falló el arranque"

# --- Verificación -----------------------------------------------------------

log "Esperando a que los servicios estén sanos (máx ${HEALTH_TIMEOUT}s)..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
while :; do
  unhealthy="$(compose ps --format '{{.Service}} {{.Health}}' | awk '$2 != "healthy" { print $1 }')"
  [ -z "$unhealthy" ] && break

  if [ "$(date +%s)" -ge "$deadline" ]; then
    log "Servicios que no llegaron a sano: $(echo $unhealthy | tr '\n' ' ')"
    for svc in $unhealthy; do
      log "--- últimas líneas de $svc ---"
      compose logs --tail 30 "$svc" || true
    done
    die "el despliegue no pasó los healthchecks. Revisa los logs de arriba."
  fi
  sleep 5
done

log "Desplegado $SHA correctamente."
compose ps --format 'table {{.Service}}\t{{.Status}}'
