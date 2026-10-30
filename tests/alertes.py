# Alertes promos : produits surveillés, bandeau, badge, marquer comme vu
import sys, re, json, time
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
now = int(time.time())
OFFRES = {"offres": [
  {"id": "lidl-1", "enseigne": "Lidl", "nom": "L'ÉTAL DU BOUCHER 4 crépinettes de porc", "prix": 2.99, "prixAvant": 3.99, "remise": "-25 %", "lidlPlus": False, "cond": "500 g", "prixKg": "1 kg = 5,98", "debut": (now - 86400) * 1000, "fin": (now + 5 * 86400) * 1000, "quand": "22.10. - 28.10. | En supermarché", "lien": "https://www.lidl.fr/p/x/p1", "image": None, "rayon": "Viande et volaille · Porc"},
  {"id": "lidl-2", "enseigne": "Lidl", "nom": "Oignons jaunes", "prix": 0.99, "prixAvant": 1.49, "remise": "-33 %", "lidlPlus": False, "cond": "1 kg", "prixKg": "", "debut": None, "fin": (now + 3 * 86400) * 1000, "quand": "", "lien": "https://www.lidl.fr/p/y/p2", "image": None, "rayon": "Fruits et légumes"},
  {"id": "lidl-3", "enseigne": "Lidl", "nom": "MILBONA Emmental râpé", "prix": 1.49, "prixAvant": None, "remise": "-50% sur le 2e", "lidlPlus": True, "cond": "200 g", "prixKg": "", "debut": None, "fin": None, "quand": "", "lien": "https://www.lidl.fr/p/z/p3", "image": None, "rayon": "Produits laitiers · Fromages"}
,
  {"id": "aldi-1", "enseigne": "Aldi", "nom": "Filets de poulet", "prix": 4.99, "prixAvant": 6.49, "remise": "-23 %", "lidlPlus": False, "cond": "600 g", "prixKg": "", "debut": None, "fin": (now + 2 * 86400) * 1000, "quand": "", "lien": "https://www.aldi.fr/p", "image": None, "rayon": "Viande et volaille · Volaille"},
  {"id": "lidl-4", "enseigne": "Lidl", "nom": "FAVORINA Boules crème", "prix": 7.49, "prixAvant": None, "remise": "OFFRE FLASH", "lidlPlus": False, "cond": "1 kg", "prixKg": "", "debut": None, "fin": None, "quand": "", "lien": "https://www.lidl.fr/p/w", "image": None, "rayon": "Surgelés · Glaces"}
], "prospectus": [{"enseigne": "Aldi", "titre": "Prospectus de la semaine · du mar. 20/10 au lun. 26/10", "lien": "https://catalogues.aldi.fr/kw432026/", "integrable": True, "pages": 47}, {"enseigne": "Lidl", "titre": "Les promos de la semaine · du 22/10 au 28/10", "lien": "https://www.lidl.fr/l/catalogue-de-la-semaine/x/ar/0", "integrable": False}], "sources": [{"enseigne": "Lidl", "pages": 12}], "maj": now * 1000}
with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    def route(r):
        if "/promos" in r.request.url: r.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(OFFRES))
        else: r.abort()
    page.route("https://budgetable-recettes.onrender.com/**", route)
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button", has_text="Courses").click()
    page.locator(".bandeau-promos").click(); page.wait_for_timeout(600)
    sec = page.locator("#mes-alertes")
    sec.locator("#alerte-mot").fill("poulet"); sec.get_by_role("button", name="Surveiller").click()
    sec = page.locator("#mes-alertes")
    t = sec.inner_text(); assert "Filets de poulet" in t and "poulet" in t, t[:400]
    sec.locator("#alerte-mot").fill("café"); sec.locator("button[type=submit]").click()
    assert "rien cette semaine" in page.locator("#mes-alertes").inner_text()
    page.locator("#mes-alertes").screenshot(path=f"{OUT}/al1.png")
    # bandeau sur la semaine
    page.locator("nav button[data-k=semaine]").click()
    b = page.locator(".bandeau-alertes"); assert b.count() == 1 and "poulet" in b.inner_text()
    b.click(); page.wait_for_timeout(200)
    page.get_by_role("button", name="✓ Marquer comme vues").click()
    page.locator("nav button[data-k=semaine]").click()
    assert page.locator(".bandeau-alertes").count() == 0
    # supprimer une alerte ; les alertes restent après rechargement
    page.reload(); page.wait_for_timeout(500)
    assert len(page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).alertesPromos")) == 2
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("ALERTES OK")
    nav.close()
