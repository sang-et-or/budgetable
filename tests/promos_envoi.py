# Promos du moment (données simulées du serveur) et envoi de la liste (mail, lien à cocher)
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
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button", has_text="Courses").click()
    page.locator(".bandeau-promos").click()
    page.wait_for_timeout(800)
    t = page.locator("main").inner_text(); print(t[:700])
    assert "Promos du moment" in t and "Toutes les promos en cours" in t
    assert "crépinettes" in t
    page.screenshot(path=f"{OUT}/pr1.png", full_page=True)
    # prospectus : Aldi se feuillette dans Budgétable, Lidl s'ouvre sur son site
    assert "Prospectus de la semaine" in t
    page.get_by_role("button", name="Feuilleter").click()
    assert page.locator(".fenetre-prospectus iframe").get_attribute("src") == "https://catalogues.aldi.fr/kw432026/"
    page.screenshot(path=f"{OUT}/prosp.png")
    page.keyboard.press("Escape"); assert page.locator(".fenetre-prospectus").count() == 0
    assert page.locator(".carte-prospectus a[href*='lidl.fr/l/']").count() == 1
    page.locator(".prospectus-liste").screenshot(path=f"{OUT}/prosp2.png")
    # pas de faux rapprochement : des boules glacées ne sont pas de la crème fraîche
    assert page.evaluate("(() => [...document.querySelectorAll('.promos-moi .liste-promos')].map((u) => u.previousElementSibling.innerText + ' → ' + u.innerText).filter((t) => /Crème fraîche/.test(t) && /Boules/.test(t)).length)()") == 0
    # recherche
    page.locator("#promo-cherche").press_sequentially("poulet", delay=30)
    page.wait_for_timeout(200)
    t = page.locator("main").inner_text()
    assert "Filets de poulet" in t and "crépinettes" not in t and "promo trouvée" in t, t[:600]
    page.screenshot(path=f"{OUT}/pr2.png")
    page.get_by_role("button", name="tout afficher").click()
    # magasin
    page.locator("[data-a=promo-magasin][data-k=Aldi]").click()
    t = page.locator("main").inner_text()
    assert "Filets de poulet" in t and "Oignons jaunes" not in t
    page.locator("[data-a=promo-magasin][data-k=tout]").click()
    page.select_option("#promo-tri", "magasin")
    assert page.locator(".titre-magasin").count() == 2
    page.screenshot(path=f"{OUT}/pr3.png", full_page=True)
    page.locator("[data-a=promo-filtre][data-k=viande]").click()
    assert "Oignons jaunes" not in page.locator("main section", has_text="Toutes les promos en cours").inner_text()
    # retour aux courses : étiquette promo sur les oignons
    page.locator("nav button", has_text="Courses").click()
    print("étiquettes promo :", page.locator(".article .tag-promo").count())
    # envoyer
    page.get_by_role("button", name="📤 Envoyer").click()
    f = page.locator(".fenetre-envoi")
    href = f.locator("a", has_text="Par e-mail").get_attribute("href")
    assert href.startswith("mailto:?subject=") and "LISTE%20DE%20COURSES" in href, href[:200]
    f.get_by_role("radio", name="Les deux").click()
    assert "MENU DE LA SEMAINE" in page.locator(".apercu-envoi").text_content()
    f.screenshot(path=f"{OUT}/env1.png")
    lien = page.evaluate("(() => { const a = document.querySelector('.fenetre-envoi a[href^=\"mailto\"]').getAttribute('href'); return decodeURIComponent(a).match(/(http\\S+#liste=\\S+)/)[1]; })()")
    print("lien :", lien[:90], len(lien))
    # le lien ouvre la liste à cocher sur un autre appareil
    p2 = nav.new_context(viewport={"width": 390, "height": 844}).new_page()
    p2.on("pageerror", lambda e: erreurs.append(str(e)))
    p2.goto(lien); p2.wait_for_timeout(400)
    assert "Liste partagée" in p2.inner_text("main") or "LISTE PARTAGÉE" in p2.inner_text("main")
    p2.locator("input[data-a=partage-cocher]").first.check()
    assert "1 / " in p2.inner_text("main")
    p2.screenshot(path=f"{OUT}/env2.png")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("PROMOS ENVOI OK")
    nav.close()
