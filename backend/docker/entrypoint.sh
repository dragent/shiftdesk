#!/bin/sh
set -e

# Génère les clés JWT si elles n'existent pas encore dans le conteneur
# (utile car config/jwt/*.pem est gitignoré).
if [ ! -f config/jwt/private.pem ]; then
    echo "Génération des clés JWT..."
    php bin/console lexik:jwt:generate-keypair --no-interaction
fi

# Attend que MySQL soit prêt puis applique les migrations.
echo "Application des migrations Doctrine..."
php bin/console doctrine:migrations:migrate --no-interaction || true

echo "Initialisation des données de démonstration (idempotent)..."
php bin/console app:seed-demo || true

exec "$@"
