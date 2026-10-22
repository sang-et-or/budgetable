# Test des courses guidées sur le drive (sans extension), sur téléphone.
# Usage : python3 -m http.server 8765 -d dist &  puis  python3 tests/courses.py [dossier_captures] [url]
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
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
    page.get_by_role("button", name="Courses").first.click()
    assert page.get_by_text("Choisissez votre drive ci-dessus pour commencer.").count() == 1
    page.locator("[data-a=enseigne][data-k=carrefour]").click()
    clic("Commencer mes courses")
    fen = page.locator(".fenetre-courses")
    lien = fen.locator("a.btn-chercher")
    href = lien.get_attribute("href")
    assert href.startswith("https://www.carrefour.fr/s?q="), href
    assert lien.get_attribute("target") == "_blank"
    page.screenshot(path=f"{OUT}/c1-article.png")
    premier = page.inner_text("#courses-titre")
    page.fill("[data-a=courses-prix]", "1,89")
    clic("2. ✓ C’est dans mon panier")
    assert page.inner_text("#courses-titre") != premier, "pas passé à l'article suivant"
    clic("Pas trouvé")
    clic("2. ✓ C’est dans mon panier")
    assert "3 / " in page.inner_text(".fenetre-courses .eyebrow"), page.inner_text(".fenetre-courses .eyebrow")
    clic("Fermer")
    reprendre = page.get_by_role("button", name=re.compile("Reprendre mes courses"))
    assert reprendre.count() == 1, "pas de reprise"
    page.reload()
    page.get_by_role("button", name=re.compile("Reprendre mes courses")).click()   # l'état survit au rechargement (retour depuis l'appli du drive)
    for _ in range(80):
        if page.get_by_text("Presque fini !").count() or page.get_by_text("Tout est dans votre panier !").count(): break
        clic("2. ✓ C’est dans mon panier")
    fin = page.inner_text(".fenetre-courses")
    assert "Presque fini" in fin and "Prix notés" in fin and "Pas trouvés chez Carrefour" in fin, fin[:400]
    page.screenshot(path=f"{OUT}/c2-fin.png")
    page.get_by_role("button", name="Réessayer").first.click()
    assert page.locator("a.btn-chercher").count() == 1
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("COURSES OK")
    nav.close()
