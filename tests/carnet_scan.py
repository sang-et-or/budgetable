# Carnet du jour : ajouter un aliment par son code-barres (photo ou chiffres), Open Food Facts simulé.
import sys, re, json, os
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
ICI = os.path.dirname(os.path.abspath(__file__))
PRODUIT = {"status": 1, "product": {"product_name_fr": "Pâte à tartiner noisettes", "brands": "Marque test", "quantity": "400 g", "product_quantity": "400", "serving_size": "15 g", "serving_quantity": "15", "nutriscore_grade": "e",
  "nutriments": {"energy-kcal_100g": 539, "proteins_100g": 6.3, "fiber_100g": 3.4, "sugars_100g": 56.3, "saturated-fat_100g": 10.6, "salt_100g": 0.107}}}
erreurs, appels = [], []
def off(route):
    appels.append(route.request.url)
    route.fulfill(status=200, content_type="application/json", body=json.dumps(PRODUIT), headers={"Access-Control-Allow-Origin": "*"})
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://world.openfoodfacts.org/**", off)
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button", has_text="Apports").click()
    # photo du code-barres
    page.locator("input[data-a=carnet-scan]").set_input_files(os.path.join(ICI, "codebarre-pates.png"))
    page.wait_for_selector(".produit-scanne", timeout=15000)
    assert any("8076809513753" in a for a in appels), appels
    ps = page.locator(".produit-scanne")
    assert "Pâte à tartiner noisettes" in ps.inner_text() and "539 kcal pour 100 g" in ps.inner_text()
    assert "Pour 15 g : 81 kcal" in ps.inner_text(), ps.inner_text()      # portion du fabricant
    page.fill("#scan-g", "30")
    assert "Pour 30 g : 162 kcal" in ps.inner_text()
    page.screenshot(path=f"{OUT}/cs1.png")
    clic("Ajouter au carnet")
    c = page.locator(".carnet")
    assert "Pâte à tartiner noisettes (Marque test)" in c.inner_text() and "162 kcal" in c.inner_text()
    # par les chiffres
    page.fill("#carnet-code", "3017620422003")
    page.locator("[data-a=carnet-code]").click()
    page.wait_for_selector(".produit-scanne", timeout=15000)
    page.locator(".produit-scanne").get_by_role("button", name="100 g").click()
    clic("Ajouter au carnet")
    t = c.inner_text()
    kcal = int(re.search(r"Énergie\s*([\d\s ]+)\s*/", t).group(1).replace(" ", "").replace(" ", ""))
    assert kcal == 162 + 539, kcal
    assert "73 / 100" in page.locator(".compteur", has_text="Sucres").inner_text()
    page.reload(); page.locator("nav button", has_text="Apports").click()
    assert "Pâte à tartiner noisettes" in page.locator(".carnet").inner_text()
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("CARNET SCAN OK")
    nav.close()
