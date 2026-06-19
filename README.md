# Balade Laboutarié

Application web pour cartographier les lieux de promenade (sentiers, pistes, forêts, prairies) autour d'un point de départ (par défaut Laboutarié, Tarn), dans un rayon de 10, 20 ou 30 minutes de voiture.

## Fonctionnalités
- Isochrones de temps de trajet (10/20/30 min) via OpenRouteService.
- Extraction de toutes les zones praticables (fôrets, prairies, sentiers, chemins) via Overpass API.
- Filtrage des données directement sur le client avec Turf.js.
- Interface mobile-first (React, Tailwind, Leaflet).
- Proxy backend pour protéger les clés API et gérer le cache.

## Installation Locale

1. Clonez ce dépôt.
2. Copiez `.env.example` vers `.env` et ajoutez votre clé OpenRouteService :
   ```bash
   cp .env.example .env
   # Éditez .env avec votre ORS_KEY
   ```
3. Installez les dépendances :
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```
4. Démarrez en développement :
   ```bash
   npm run dev
   ```
   L'application sera accessible sur `http://localhost:5173`.

## Déploiement sur CasaOS / Portainer

Cette application est packagée pour un déploiement facile via Docker.

1. **Préparation :** Assurez-vous que votre code est poussé sur votre dépôt GitHub.
2. **Dans Portainer :**
   - Allez dans **Stacks** > **Add stack**.
   - Nommez la stack `balade-laboutarie`.
   - Choisissez **Repository** et collez l'URL de votre dépôt GitHub.
   - Indiquez le chemin vers le fichier Compose : `docker-compose.yml`.
   - **Important :** Dans la section **Environment variables**, ajoutez une variable :
     - Name: `ORS_KEY`
     - Value: `votre_clé_api_openrouteservice`
   - Cliquez sur **Deploy the stack**.
3. **Accès :** L'application sera disponible sur le port **9876** de votre serveur CasaOS (ex: `http://adresse_ip_casaos:9876`).

## Modifier la clé ORS sans rebuild
Si vous devez changer la clé API plus tard :
1. Allez dans Portainer > Stacks > `balade-laboutarie` > onglet **Editor**.
2. Modifiez la valeur de la variable d'environnement ou dans la section Environment en bas.
3. Cliquez sur **Update the stack**. Le conteneur redémarrera automatiquement avec la nouvelle clé.

## Sources de données
- OpenStreetMap via Overpass API
- OpenRouteService (Isochrones)
- Nominatim (Géocodage)
- IGN Géoplateforme (Orthophotos)
- OpenTopoMap
