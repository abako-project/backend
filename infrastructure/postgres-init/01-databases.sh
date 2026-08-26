#!/bin/bash
#
# Crea una base de datos y un usuario por servicio.
#
# Postgres solo ejecuta este script la primera vez que se inicializa el
# volumen (directorio de datos vacío). En un volumen ya existente no corre:
# si hay que añadir un servicio nuevo, se crea su base a mano o se recrea
# el volumen.
#
set -euo pipefail

: "${ADAPTER_DB_USER:?falta ADAPTER_DB_USER}"
: "${ADAPTER_DB_PASSWORD:?falta ADAPTER_DB_PASSWORD}"
: "${ADAPTER_DB_NAME:?falta ADAPTER_DB_NAME}"
: "${BRAMP_DB_USER:?falta BRAMP_DB_USER}"
: "${BRAMP_DB_PASSWORD:?falta BRAMP_DB_PASSWORD}"
: "${BRAMP_DB_NAME:?falta BRAMP_DB_NAME}"

create_service_db() {
  local user="$1" password="$2" dbname="$3"

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    CREATE USER "$user" WITH PASSWORD '$password';
    CREATE DATABASE "$dbname" OWNER "$user";
EOSQL

  # uuid-ossp lo necesita la migración de adapter-api (uuid_generate_v4).
  # Crear extensiones exige superusuario, así que se hace aquí y no desde la
  # app: el usuario del servicio no tiene por qué tener ese privilegio.
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$dbname" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    GRANT ALL ON SCHEMA public TO "$user";
EOSQL

  echo "  base '$dbname' lista para el usuario '$user'"
}

echo "Creando una base por servicio..."
create_service_db "$ADAPTER_DB_USER" "$ADAPTER_DB_PASSWORD" "$ADAPTER_DB_NAME"
create_service_db "$BRAMP_DB_USER" "$BRAMP_DB_PASSWORD" "$BRAMP_DB_NAME"
echo "Listo."
