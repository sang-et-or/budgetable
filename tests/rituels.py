# Test des choix de plats : suggestion de rituels, 3 idées par repas, choix des enfants, classiques.
# Usage : python3 -m http.server 8765 -d dist &  puis  python3 tests/rituels.py [dossier_captures]
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 760, "height": 900})
    import datetime as _dt; _l = _dt.datetime.now().replace(hour=9, minute=30, second=0, microsecond=0); _l -= _dt.timedelta(days=_l.weekday())
    page.context.clock.install(time=_l)   # la semaine s’affiche à partir d’aujourd’hui : on se place un lundi matin
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    page.get_by_role("button", name="Ajouter").nth(1).click()   # un enfant
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    # 1. suggestion de rituels
    assert page.get_by_text("Et si on se créait des rituels ?").count() == 1, "suggestion absente"
    page.locator(".idee-rituels").screenshot(path=f"{OUT}/r1-suggestion.png")
    clic("Essayer ces rituels")
    texte = page.inner_text("main").lower()
    for t in ["soirée pâtes", "pizza maison", "petit plat mijoté"]:
        assert t in texte, t
    assert "les enfants choisissent le dîner" in texte or "au tour de" in texte
    page.locator(".jour").first.screenshot(path=f"{OUT}/r2-lundi.png")
    # 2. trois idées pour le dîner du lundi
    page.locator("[data-a=choix][data-j='0'][data-s='diner']").click()
    cartes = page.locator(".choix-carte")
    assert cartes.count() >= 3, cartes.count()
    assert page.locator(".choix-carte .raisons li").count() >= 3, "raisons absentes"
    page.screenshot(path=f"{OUT}/r3-trois-idees.png", full_page=False)
    nom = cartes.nth(1).locator("h3").inner_text()
    cartes.nth(1).get_by_role("button", name="Je choisis ce plat").click()
    assert nom in page.locator("[data-j='0'] .titre-repas").nth(1).inner_text(), "choix non appliqué"
    # 3. choix des enfants (mercredi)
    page.get_by_label  # noqa
    page.locator(".grille-rituels")  # présent dans la carte repliée
    page.get_by_text("Nos rituels et nos favoris").click()
    page.locator("input[data-a=prenom]").first.fill("Léa")
    page.get_by_text("Nos rituels et nos favoris").click()
    page.locator("[data-a=choix][data-enfants='1']").first.click()
    assert "À toi de choisir, Léa !" in page.inner_text("#choix-titre")
    page.screenshot(path=f"{OUT}/r4-enfants.png", full_page=False)
    page.locator(".choix-carte").nth(2).get_by_role("button", name="Celui-là !").click()
    assert "choisi par léa" in page.inner_text("main").lower(), "choix des enfants non noté"
    # 4. plat préféré : l'étoile (les « classiques » au cœur sont devenus les favoris en étoile le 24/10)
    etoile = page.locator("main .etoile-fav").first
    rid = etoile.get_attribute("data-r"); etoile.click()
    assert page.locator(f"main .etoile-fav[data-r='{rid}']").first.inner_text() == "★", "étoile absente du planning"
    assert rid in page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).classiques")
    page.get_by_text("Nos rituels et nos favoris").click()
    page.locator(".rituels").screenshot(path=f"{OUT}/r5-rituels.png")
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("RITUELS OK")
    nav.close()
