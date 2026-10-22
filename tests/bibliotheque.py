# Test de « Mes recettes » (liens d'autres sites, ingrédients à cocher) et du changement de plat par recherche / saisie.
# Usage : python3 -m http.server 8765 -d dist &  puis  python3 tests/bibliotheque.py [dossier_captures] [url]
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8765/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()

    # 1. bibliothèque : ajouter une recette Marmiton
    page.locator("nav button", has_text="Recettes").click()
    assert "Votre bibliothèque est vide" in page.inner_text("main")
    clic("Ajouter ma première recette")
    assert "Écrivez le nom du plat" in page.inner_text("#liens-recherche")
    page.fill("#ed-nom", "Lasagnes de mamie")
    liens = page.locator("#liens-recherche a")
    assert liens.count() == 3 and liens.first.get_attribute("href") == "https://www.google.com/search?q=recette%20Lasagnes%20de%20mamie"
    assert all(liens.nth(i).get_attribute("target") == "_blank" for i in range(3))
    assert "marmiton.org/recettes/recherche.aspx?aqt=Lasagnes" in liens.nth(1).get_attribute("href")
    page.fill("#ed-lien", "https://www.marmiton.org/recettes/recette_lasagnes-a-la-bolognaise_18215.aspx")
    clic("Trouver les ingrédients")
    ed = page.locator(".fenetre-edition")
    txt = ed.inner_text()
    for ing in ["Pâtes", "Bœuf haché", "Tomates concassées", "Emmental râpé"]:
        assert ing in txt, ing
    assert ed.locator("input[data-a=ed-ing]:checked").count() >= 7
    # idées à toucher, AU-DESSUS de la liste des ingrédients de la recette
    y_idees = ed.locator(".propositions").bounding_box()["y"]; y_liste = ed.locator(".dans-recette").bounding_box()["y"]
    assert y_idees < y_liste, "les idées doivent être au-dessus"
    assert ed.locator(".puce-ajout").count() >= 5
    avant = ed.locator(".dans-recette input:checked").count()
    ed.get_by_role("button", name="+ Ail", exact=True).click()                # un clic suffit
    assert ed.locator(".dans-recette input:checked").count() == avant + 1
    assert "Ail" in ed.locator(".dans-recette").inner_text()
    ed.locator(".dans-recette label", has_text="Carottes").locator("input").click()       # pas de carottes chez mamie
    assert ed.get_by_role("button", name="+ Carottes").count() == 1, "un ingrédient retiré doit remonter dans les idées"
    ed.locator(".dans-recette label", has_text="Ail").locator("input").click()
    page.fill("#ajout-ing", "basilic")
    page.locator("#propositions-ing").get_by_role("button", name="+ « basilic » tel quel").click()
    page.fill("#ajout-ing", "champ")
    page.locator("#propositions-ing").get_by_role("button", name="+ Champignons de Paris").click()
    page.screenshot(path=f"{OUT}/b1-saisie.png", full_page=False)
    clic("Enregistrer dans Mes recettes")
    main = page.inner_text("main")
    assert "Lasagnes de mamie" in main and "marmiton.org" in main, main[:500]
    page.screenshot(path=f"{OUT}/b2-bibliotheque.png", full_page=False)

    # 2. mettre au menu du lundi soir
    clic("Mettre au menu")
    page.locator("[data-a=au-menu-placer][data-j='0'][data-s='diner']").click()
    page.locator("nav button", has_text="Semaine").click()
    assert "Lasagnes de mamie" in page.locator(".jour").first.inner_text()

    # 3. fiche : lien vers la recette d'origine, ingrédients sans les carottes, avec basilic
    page.locator(".jour").first.get_by_role("button", name=re.compile("Lasagnes de mamie")).click()
    fiche = page.locator(".fiche").last
    assert fiche.get_by_role("link", name=re.compile("Voir la recette sur marmiton.org")).count() == 1
    ft = fiche.inner_text()
    assert "Basilic" in ft and "Carottes" not in ft and "Champignons" in ft, ft[:600]
    clic("Fermer")

    # 4. changer un plat : recherche dans les 12 000 plats
    page.locator("[data-a=choix][data-j='1'][data-s='diner']").click()
    page.fill("#recherche-plat", "poulet coco")
    res = page.locator("#resultats-plat .resultat")
    assert res.count() >= 1, page.inner_text("#resultats-plat")
    nom = res.first.locator("strong").inner_text()
    page.screenshot(path=f"{OUT}/b3-recherche.png", full_page=False)
    res.first.click()
    assert nom in page.locator(".jour").nth(1).inner_text()

    # 5. plat inconnu : créé à la main, placé au mardi midi
    page.locator("[data-a=choix][data-j='1'][data-s='dejeuner']").click()
    page.fill("#recherche-plat", "wok de crevettes")
    page.get_by_role("button", name=re.compile("Créer « wok de crevettes »")).click()
    ed = page.locator(".fenetre-edition")
    assert ed.locator("#ed-nom").input_value() == "wok de crevettes"
    assert "Crevettes" in ed.inner_text() and "Filets de poulet" not in ed.inner_text(), ed.inner_text()[:500]
    page.get_by_role("button", name=re.compile("Enregistrer et mettre au déjeuner du mardi")).click()
    assert "wok de crevettes" in page.locator(".jour").nth(1).inner_text().lower()

    # 6. liste de courses : ingrédients hors catalogue sans prix
    page.locator("nav button", has_text="Courses").click()
    ct = page.inner_text("main")
    assert "Crevettes" in ct and "Basilic" in ct and "prix ?" in ct, ct[:300]

    # 7. changer à volonté : plus de limite
    page.locator("nav button", has_text="Semaine").click()
    for k in range(6):
        page.locator("[data-a=choix][data-j='3'][data-s='diner']").click()
        clic("Encore d’autres idées")
        page.locator(".choix-carte").nth(1).get_by_role("button", name="Je choisis ce plat").click()
    assert "Formule Découverte" not in page.inner_text("main") or "remplacement" not in page.inner_text("main").lower()

    # 8. la bibliothèque survit au rechargement
    page.reload()
    page.locator("nav button", has_text="Recettes").click()
    assert page.locator(".carte-recette").count() == 2
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("BIBLIOTHEQUE OK")
    nav.close()
