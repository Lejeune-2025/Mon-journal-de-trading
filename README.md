# Trading Journal

Journal de trading professionnel — 100 % frontend, sans base de données.  
Données stockées localement (localStorage + IndexedDB) par profil utilisateur.

## Fonctionnalités

- Multi-profils utilisateurs isolés
- Enregistrement des trades (plan, émotions, captures)
- Statistiques hebdomadaires et courbe d'équité
- Export CSV, JSON, Word
- PWA installable (mobile & desktop)

---

## Utilisation locale (PC)

```bash
# Option 1 — double-clic
start.bat

# Option 2 — terminal
npx serve . -p 3000
```

Ouvrir : **http://localhost:3000**

> Ne pas ouvrir `index.html` directement (`file://`) — la PWA et le manifest ne fonctionnent qu'en HTTP/HTTPS.

### Accès depuis le téléphone (même Wi‑Fi)

1. Lancer `start.bat` sur le PC
2. Noter l'adresse **Network** affichée (ex. `http://192.168.1.15:3000`)
3. Ouvrir cette URL sur le téléphone (Chrome / Safari)

---

## Déploiement GitHub

### 1. Initialiser le dépôt

```bash
cd journal-trading
git init
git add .
git commit -m "Initial commit — Trading Journal"
```

### 2. Créer le repo sur GitHub

1. Aller sur [github.com/new](https://github.com/new)
2. Nom du repo : `journal-trading` (ou autre)
3. **Ne pas** cocher « Add README » (déjà inclus ici)

### 3. Pousser le code

```bash
git remote add origin https://github.com/VOTRE-USERNAME/journal-trading.git
git branch -M main
git push -u origin main
```

---

## Déploiement Vercel

### Méthode rapide (recommandée)

1. Créer un compte sur [vercel.com](https://vercel.com)
2. **Add New → Project**
3. Importer le repo GitHub `journal-trading`
4. Paramètres de build :

| Paramètre | Valeur |
|-----------|--------|
| Framework Preset | **Other** |
| Build Command | *(laisser vide)* |
| Output Directory | `.` |

5. Cliquer **Deploy**

Vercel déploie automatiquement à chaque `git push` sur `main`.

### URL de production

Après déploiement : `https://journal-trading-xxx.vercel.app`

- HTTPS activé → PWA et installation mobile fonctionnent
- Ouvrir l'URL sur téléphone → **Sync → Installer l'application**

### Statistiques du site (Vercel Web Analytics)

Le projet inclut **Vercel Web Analytics** (`vercel-analytics.js`) : visites, pages vues, pays, appareils, etc.  
Les stats ne s’activent **pas** en local (`localhost`) — uniquement sur l’URL HTTPS Vercel.

#### Activer les analytics (une fois)

1. Déployer le projet sur Vercel (voir ci-dessus).
2. Ouvrir le [tableau de bord Vercel](https://vercel.com/dashboard) → votre projet **journal-trading**.
3. Onglet **Analytics** → **Enable Web Analytics** (confirmer si un plan / essai est proposé).
4. Redéployer si demandé : `git push` ou **Deployments → Redeploy**.
5. Visiter le site en production, naviguer entre quelques sections, attendre **quelques minutes**.
6. Revenir dans **Analytics** pour voir les données (visiteurs, vues, événements `section_view`).

> **Erreur 404 `/_vercel/insights/script.js` ?**  
> Normal si Analytics n’est pas activé sur Vercel, ou en local (`localhost`). Le site fonctionne quand même.  
> Après activation dans le dashboard, l’erreur disparaît au prochain déploiement.

#### Ce qui est mesuré

| Métrique | Détail |
|----------|--------|
| Visites / pages vues | Chargement du site sur Vercel |
| Sections de l’app | Événement `section_view` (dashboard, trades, new-trade, sync…) |
| Local / fichier | **Non tracké** (volontaire) |

#### Stats de trading (dans l’app)

Les KPIs, courbe d’équité et analyse hebdo restent **dans le navigateur** (Tableau de bord / Analyse hebdo) — ce ne sont pas les analytics Vercel.

> Les trades sont stockés localement par appareil, pas sur Vercel.  
> PC → téléphone : **Sync → Exporter (.json) → Importer**.

---

## Structure du projet

```
journal-trading/
├── index.html          # Interface
├── app.js              # Logique principale
├── export-word.js      # Export Word
├── styles.css          # Styles
├── sw.js               # Service Worker (PWA)
├── manifest.webmanifest
├── icons/icon.svg
├── vercel-analytics.js # Vercel Web Analytics (production HTTPS)
├── vercel.json         # Config Vercel
├── start.bat           # Serveur local Windows
└── package.json
```

---

## Synchronisation des données

Chaque appareil a ses propres données. Pour les partager :

1. **Exporter** : Sync → *Exporter mes données (.json)*
2. Transférer le fichier (Drive, WhatsApp, e-mail…)
3. **Importer** : Sync → *Importer des données* (sur l'autre appareil)

---

## Licence

Usage personnel. Projet open source — libre d'utilisation et de modification.
