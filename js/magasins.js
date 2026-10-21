/* Budgétable — « Mes drives près de chez moi » (V0.4)
 *
 * Sources ouvertes, réutilisation commerciale autorisée avec mention de la source :
 *  - Base Adresse Nationale (api-adresse.data.gouv.fr) : commune ou code postal → coordonnées ;
 *  - OpenStreetMap via Overpass (ODbL, © contributeurs OpenStreetMap) : magasins autour.
 * Aucune donnée de prix n'est récupérée ici : seulement l'emplacement des magasins.
 */
(function (root) {
  // À la mise en production : héberger son propre serveur Overpass ou garder les résultats en cache.
  const SERVEURS_OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  const SOURCES = 'Magasins : © contributeurs OpenStreetMap (ODbL). Adresses : Base Adresse Nationale.';

  // enseigne OpenStreetMap → site drive connu de Budgétable (même identifiants que l'extension)
  const ENSEIGNES = [
    { re: /leclerc/i, id: 'leclerc', nom: 'E.Leclerc' },
    { re: /chronodrive/i, id: 'chronodrive', nom: 'Chronodrive' },
    { re: /intermarch/i, id: 'intermarche', nom: 'Intermarché' },
    { re: /auchan/i, id: 'auchan', nom: 'Auchan' },
    { re: /carrefour/i, id: 'carrefour', nom: 'Carrefour' },
    { re: /(super|hyper)\s?u\b|u express|système u|systeme u/i, id: 'coursesu', nom: 'Magasins U' },
    { re: /\bcora\b/i, id: 'cora', nom: 'Cora' },
    { re: /\bmatch\b/i, id: 'match', nom: 'Match' }
  ];
  // petits formats et stations : en général sans drive
  const SANS_DRIVE = /\b(city|express|contact|proxi|station|carburant)\b/i;

  function requeteOverpass(lat, lon, rayonKm) {
    const r = Math.round(Math.min(Math.max(rayonKm, 1), 30) * 1000);
    const marques = 'Leclerc|Carrefour|Auchan|Intermarch|Super U|Hyper U|U Express|Chronodrive|Cora|Match';
    return `[out:json][timeout:25];(nwr(around:${r},${lat},${lon})["shop"~"supermarket|convenience|outpost"]["brand"~"${marques}",i];nwr(around:${r},${lat},${lon})["shop"]["name"~"drive",i];);out center tags;`;
  }

  function distanceKm(a, b) {
    const R = 6371, rad = (d) => (d * Math.PI) / 180;
    const dla = rad(b.lat - a.lat), dlo = rad(b.lon - a.lon);
    const h = Math.sin(dla / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /**
   * Transforme la réponse OpenStreetMap en liste de drives :
   * [{ id, nom, enseigne, enseigneNom, ville, distanceKm, drive: 'confirmé' | 'probable', lat, lon }]
   * - « confirmé » : le magasin est marqué drive dans OpenStreetMap (point drive, service drive) ;
   * - « probable » : grande ou moyenne surface d'une enseigne qui propose le drive ;
   * - écartés : stations-service, petits formats (City, Express, Contact…), magasins sans enseigne connue.
   */
  function drivesProches(osm, centre) {
    const brut = [];
    for (const e of (osm && osm.elements) || []) {
      const t = e.tags || {};
      const lat = e.lat ?? (e.center && e.center.lat), lon = e.lon ?? (e.center && e.center.lon);
      if (lat == null || lon == null) continue;
      const texte = `${t.brand || ''} ${t.name || ''}`;
      const ens = ENSEIGNES.find((x) => x.re.test(texte));
      if (!ens) continue;
      const nomDrive = /drive/i.test(texte);
      const marque = t.drive_through === 'only' || t.drive_through === 'yes' || t['service:drive'] === 'yes' || t.shop === 'outpost' || nomDrive;
      if (/gas|fuel/.test(t.shop || '') || (!marque && SANS_DRIVE.test(texte))) continue;
      if (!marque && t.shop !== 'supermarket') continue;
      brut.push({
        id: `${e.type}/${e.id}`, carte: `https://www.openstreetmap.org/${e.type}/${e.id}`, nom: t.name || ens.nom, enseigne: ens.id, enseigneNom: ens.nom,
        ville: t['addr:city'] || '', lat, lon, drive: marque ? 'confirmé' : 'probable',
        distanceKm: Math.round(distanceKm(centre, { lat, lon }) * 10) / 10
      });
    }
    // un hypermarché et son drive à côté = un seul choix (on garde le drive confirmé)
    brut.sort((a, b) => (a.drive === 'confirmé' ? 0 : 1) - (b.drive === 'confirmé' ? 0 : 1) || a.distanceKm - b.distanceKm);
    const garde = [];
    for (const m of brut) {
      if (garde.some((g) => g.enseigne === m.enseigne && distanceKm(g, m) < 0.5)) continue;
      garde.push(m);
    }
    return garde.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  /** Coût d'un aller-retour en voiture. */
  function coutTrajet(distanceKm, consoL100, prixCarburant) {
    return Math.round(distanceKm * 2 * (consoL100 / 100) * prixCarburant * 100) / 100;
  }

  /** Cherche les drives autour d'une commune ou d'un code postal (dans le navigateur de l'utilisateur). */
  async function chercherDrives(lieu, rayonKm, fetchFn) {
    const f = fetchFn || fetch;
    const geo = await f(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(lieu)}&type=municipality&limit=1`).then((r) => r.json());
    const lieuTrouve = geo.features && geo.features[0];
    if (!lieuTrouve) throw new Error('Commune ou code postal introuvable.');
    const [lon, lat] = lieuTrouve.geometry.coordinates;
    const centre = { lat, lon, nom: lieuTrouve.properties.label, codePostal: lieuTrouve.properties.postcode };
    // serveurs publics Overpass : le premier est souvent surchargé, on essaie les suivants
    let osm = null;
    for (const url of SERVEURS_OVERPASS) {
      try {
        const r = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(requeteOverpass(lat, lon, rayonKm)) });
        if (r.ok) { osm = await r.json(); break; }
      } catch (e) { /* serveur suivant */ }
    }
    if (!osm) throw new Error('Le service OpenStreetMap ne répond pas, réessayez dans un instant.');
    return { centre, magasins: drivesProches(osm, centre), date: new Date().toISOString().slice(0, 10), sources: SOURCES };
  }

  const api = { SOURCES, ENSEIGNES, requeteOverpass, drivesProches, coutTrajet, chercherDrives, distanceKm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Magasins = api;
})(typeof window !== 'undefined' ? window : globalThis);
