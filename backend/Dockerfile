FROM php:8.4-cli-alpine

RUN apk add --no-cache icu-dev libzip-dev openssl $PHPIZE_DEPS \
    && docker-php-ext-install pdo_mysql intl opcache \
    && apk del $PHPIZE_DEPS

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --optimize-autoloader

COPY . .
RUN composer dump-autoload --optimize \
    && mkdir -p var/cache var/log config/jwt \
    && chmod -R 777 var config/jwt \
    && chmod +x docker/entrypoint.sh

ENV APP_ENV=prod

EXPOSE 8000

ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public", "docker/router.php"]
