<?php

/**
 * Routeur utilisé par le serveur PHP intégré (php -S) à l'intérieur du
 * conteneur Docker. Sert les fichiers statiques présents dans public/
 * directement, et délègue tout le reste au front-controller Symfony.
 */

$path = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$staticFile = __DIR__.'/../public'.$path;

if ('/' !== $path && is_file($staticFile)) {
    return false;
}

$_SERVER['SCRIPT_NAME'] = '/index.php';

require __DIR__.'/../public/index.php';
