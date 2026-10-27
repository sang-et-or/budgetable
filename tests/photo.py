# Ajouter au placard en photo : code-barres → Open Food Facts (simulé), photo du placard → reconnaissance (simulée).
import sys, re, json, os
from playwright.sync_api import sync_playwright

def aller(page, k):
    """Ouvre un onglet : bouton de la navigation s'il est visible, sinon via « Plus » (téléphone)."""
    b = page.locator(f"nav.nav button[data-k={k}]")
    if b.is_visible(): b.click()
    else: page.locator(".nav-plus").click(); page.locator(f".fenetre-plus [data-k={k}]").click()

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
ICI = os.path.dirname(os.path.abspath(__file__))
IMG = open(os.path.join(ICI, "codebarre-pates.png"), "rb").read()
PRODUIT = {"status": 1, "product": {"product_name_fr": "Spaghetti n°5", "brands": "Barilla", "quantity": "1 kg", "product_quantity": "1000", "product_quantity_unit": "g", "categories_tags": ["en:plant-based-foods", "en:cereals-and-their-products", "en:pastas", "en:spaghetti"]}}
VISION = {"mode": "ok"}
erreurs, appels = [], []
def off(route):
    appels.append(route.request.url)
    route.fulfill(status=200, content_type="application/json", body=json.dumps(PRODUIT), headers={"Access-Control-Allow-Origin": "*"})
def vision(route):
    appels.append(route.request.url)
    if VISION["mode"] == "ok":
        body = {"produits": [{"id": "oeufs", "quantite": 6, "confiance": 0.9}, {"id": "lait", "quantite": 500, "confiance": 0.8}, {"id": "feta", "quantite": 200, "confiance": 0.2}], "autres": ["cornichons"]}
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body), headers={"Access-Control-Allow-Origin": "*"})
    else:
        route.fulfill(status=503, content_type="application/json", body=json.dumps({"erreur": "non_configure"}), headers={"Access-Control-Allow-Origin": "*"})
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://world.openfoodfacts.org/**", off)
    page.route("https://budgetable-recettes.onrender.com/vision", vision)
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    aller(page, 'placard')
    stock = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.stock")
    # 1. photo d'un produit : le code-barres est lu dans l'image, le produit trouvé, ajouté
    page.locator("input[data-a=photo-produit]").set_input_files(os.path.join(ICI, "codebarre-pates.png"))
    try: page.wait_for_selector(".resultat-photo", timeout=15000)
    except Exception: print("ETAT", page.locator(".photo-stock").inner_text(), erreurs); raise
    assert any("/api/v2/product/8076809513753.json" in a for a in appels), appels
    r = page.locator(".resultat-photo").inner_text()
    assert "Spaghetti" in r and "Barilla" in r and "Pâtes : + 1 kg au placard" in r, r
    assert stock().get("pates") == 1000
    assert "Ajouté par photo" in page.locator(".bilan-rangement").inner_text()
    page.screenshot(path=f"{OUT}/ph1-produit.png", full_page=False)
    # 2. photo du placard : reconnaissance, produits peu sûrs écartés
    page.locator("input[data-a=photo-placard]").set_input_files(os.path.join(ICI, "codebarre-pates.png"))
    page.wait_for_selector(".resultat-photo", timeout=15000)
    page.wait_for_function("document.querySelector('.resultat-photo') && document.querySelector('.resultat-photo').innerText.includes('Œufs')")
    st = stock()
    assert st.get("oeufs") == 6 and st.get("lait") == 500 and "feta" not in st, st
    assert "cornichons" in page.locator(".resultat-photo").inner_text()
    # annuler l'ajout
    page.get_by_role("button", name="Annuler cet ajout").click()
    st = stock(); assert "oeufs" not in st and st.get("pates") == 1000, st
    # 3. reconnaissance pas activée : on lit au moins les codes-barres
    VISION["mode"] = "off"
    page.locator("input[data-a=photo-placard]").set_input_files(os.path.join(ICI, "codebarre-pates.png"))
    page.wait_for_function("document.querySelector('.resultat-photo') && document.querySelector('.resultat-photo').innerText.includes('pas encore activée')", timeout=15000)
    assert stock().get("pates") == 2000
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("PHOTO OK")
    nav.close()
