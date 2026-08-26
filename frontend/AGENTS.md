<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Responsive (obligatoire)

Tout changement UI dans ce dossier doit être vérifié en **mobile (~375px)**,
**tablette (~768px)** et **desktop (≥1024px)** avant de clôturer la tâche.

Voir `.cursor/rules/frontend-responsive.mdc` et `CONTRIBUTING.md`.

# ESLint (obligatoire)

Après un changement dans ce dossier, `npm run lint` doit passer (c’est ce
que la CI exécute). Voir `.cursor/rules/frontend-eslint.mdc`.
