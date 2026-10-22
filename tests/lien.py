# Lien de recette collé → ingrédients de la vraie recette cochés automatiquement (lecteur simulé).
import sys, re, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
LIEN = "https://www.marmiton.org/recettes/recette_quiche-lorraine_30283.aspx"
RECETTE = {"nom": "Quiche lorraine", "site": "marmiton.org", "portions": 6, "temps": 65, "image": None,
           "ingredients": ["1 pâte brisée", "200 g de lardons", "3 œufs", "20 cl de crème fraîche", "20 cl de lait", "50 g de gruyère râpé", "Sel", "Poivre", "1 pincée de muscade"]}
erreurs, appels = [], []
def lecteur(route):
    u = route.request.url; appels.append(u)
    if "echec" in u:
        route.fulfill(status=422, content_type="application/json", body=json.dumps({"erreur": "Pas de fiche recette lisible sur cette page"}), headers={"Access-Control-Allow-Origin": "*"})
    else:
        route.fulfill(status=200, content_type="application/json", body=json.dumps(RECETTE), headers={"Access-Control-Allow-Origin": "*"})
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lecteur)
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button", has_text="Recettes").click()
    clic("Ajouter ma première recette")

    # 1. on colle juste le lien : nom, temps et ingrédients se remplissent seuls
    page.locator("#ed-lien").fill(LIEN)
    page.wait_for_selector(".lecture-ok", timeout=8000)
    ed = page.locator(".fenetre-edition")
    assert page.locator("#ed-nom").input_value() == "Quiche lorraine"
    assert "marmiton.org" in appels[0] and "url=https%3A%2F%2Fwww.marmiton.org" in appels[0]
    dans = ed.locator(".dans-recette").inner_text()
    for x in ["Lardons", "Œufs", "Crème fraîche", "Lait demi-écrémé", "Emmental râpé", "Pâte à tarte"]:
        assert x.lower() in dans.lower(), (x, dans)
    assert "Muscade" not in dans and "Sel" not in dans.split("\n")[0]
    # recette pour 6 personnes (lue sur le site) : quantités de la recette
    assert page.locator("#ed-personnes").inner_text() == "6"
    lard = lambda: ed.locator("li.ing-qte", has_text="Lardons").locator("input[data-a=ed-qte]")
    assert lard().input_value() == "200", lard().input_value()
    # une personne de plus : les quantités suivent
    ed.get_by_role("button", name="Une personne de plus").click()
    assert page.locator("#ed-personnes").inner_text() == "7"
    assert lard().input_value() == "235", lard().input_value()
    ed.get_by_role("button", name="Une personne de moins").click(); ed.get_by_role("button", name="Une personne de moins").click()
    assert lard().input_value() == "165", lard().input_value()   # 200/6*5
    # quantité corrigée à la main (virgule acceptée)
    lard().fill("250,5")
    ed.get_by_role("button", name="Une personne de plus").click()
    assert lard().input_value() == "300", lard().input_value()   # 250,5/5*6 = 300,6 → 300
    etat = ed.locator(".lecture-ok").inner_text()
    assert "repris de marmiton.org" in etat and "pour 6" in etat and "sel" in etat.lower(), etat
    assert ed.locator("[data-k=temps]").input_value() == "65"
    page.screenshot(path=f"{OUT}/l1-lien.png", full_page=False)
    clic("Enregistrer dans Mes recettes")
    assert "Quiche lorraine" in page.inner_text("main")
    # quantité gardée par personne : 300/6 = 50 g ; le nombre de personnes est mémorisé
    biblio = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).bibliotheque[0]")
    q = dict((i, v) for i, v in biblio["ing"])
    assert abs(q["lardons"] - 50.1) < 0.2 and biblio["personnes"] == 6, biblio
    page.get_by_role("button", name=re.compile("Modifier")).first.click()
    assert page.locator("#ed-personnes").inner_text() == "6" and lard().input_value() == "300"
    clic("Fermer")

    # 2. page sans fiche recette : repli sur le nom tiré du lien
    clic("+ Ajouter une recette") if page.get_by_role("button", name="+ Ajouter une recette", exact=True).count() else page.get_by_role("button", name=re.compile("Ajouter une recette")).first.click()
    page.locator("#ed-lien").fill("https://exemple.fr/echec/gratin-dauphinois.html")
    page.wait_for_selector(".lecture-echec", timeout=8000)
    assert page.locator("#ed-nom").input_value() == "Gratin dauphinois"
    dans = page.locator(".fenetre-edition .dans-recette").inner_text()
    assert "Pommes de terre" in dans, dans
    page.screenshot(path=f"{OUT}/l2-echec.png", full_page=False)
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("LIEN OK")
    nav.close()
