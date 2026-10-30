# Recherche d'aliments dans le carnet : liste intégrée (rhum…), ingrédients au poids, produits du commerce (simulés).
import sys, re, json
from playwright.sync_api import sync_playwright

def aller(page, k):
    """Ouvre un onglet : bouton de la navigation s'il est visible, sinon via « Plus » (téléphone)."""
    b = page.locator(f"nav.nav button[data-k={k}]")
    if b.is_visible(): b.click()
    else: page.locator(".nav-plus").click(); page.locator(f".fenetre-plus [data-k={k}]").click()

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs, appels = [], []
RECH = {"products": [{"code": "3245412345678", "product_name_fr": "Rhum ambré", "brands": "Marque A", "nutriments": {"energy-kcal_100g": 231}}, {"code": "123", "product_name": "Baba au rhum", "brands": "", "nutriments": {"energy-kcal_100g": 195}}]}
PROD = {"status": 1, "product": {"product_name_fr": "Rhum ambré", "brands": "Marque A", "quantity": "70 cl", "product_quantity": "700", "serving_quantity": "4", "serving_size": "4 cl", "nutriments": {"energy-kcal_100g": 231, "proteins_100g": 0, "sugars_100g": 0, "saturated-fat_100g": 0, "salt_100g": 0}}}
def off(route):
    u = route.request.url; appels.append(u)
    body = RECH if "search.pl" in u else PROD
    route.fulfill(status=200, content_type="application/json", body=json.dumps(body), headers={"Access-Control-Allow-Origin": "*"})
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://world.openfoodfacts.org/**", off)
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    aller(page, 'apports')
    page.locator("#carnet-cherche").press_sequentially("rhum", delay=40)
    z = page.locator("#carnet-resultats")
    assert "Rhum" in z.inner_text() and "1 verre (4 cl)" in z.inner_text(), z.inner_text()
    page.wait_for_function("document.querySelector('#carnet-resultats').innerText.includes('Produits du commerce')", timeout=8000)
    assert "Rhum ambré" in z.inner_text() and any("search.pl" in a and "rhum" in a for a in appels)
    page.screenshot(path=f"{OUT}/cr1.png")
    # produit du commerce → quantité → ajout
    z.get_by_role("button", name=re.compile(r"^\+ Rhum ambré")).click()
    page.wait_for_selector(".produit-scanne")
    assert "Pour 4 g" in page.locator(".produit-scanne").inner_text() or "1 portion (4 cl)" in page.locator(".produit-scanne").inner_text()
    clic("Ajouter au carnet")
    assert "Rhum ambré" in page.locator(".liste-carnet").inner_text()
    # ingrédient au poids
    page.fill("#carnet-cherche", "")
    page.locator("#carnet-cherche").press_sequentially("riz", delay=40)
    z.get_by_role("button", name=re.compile(r"^\+ Riz long")).click()
    page.fill("#scan-g", "75")
    assert "Pour 75 g : 263 kcal" in page.locator(".produit-scanne").inner_text(), page.locator(".produit-scanne").inner_text()
    clic("Ajouter au carnet")
    assert "Riz long" in page.locator(".liste-carnet").inner_text()
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("CARNET RECHERCHE OK")
    nav.close()
