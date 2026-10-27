# Carnet du jour : ajout d'aliments, compteurs avec smileys, dépassement de limite.
import sys, re
from playwright.sync_api import sync_playwright

def aller(page, k):
    """Ouvre un onglet : bouton de la navigation s'il est visible, sinon via « Plus » (téléphone)."""
    b = page.locator(f"nav.nav button[data-k={k}]")
    if b.is_visible(): b.click()
    else: page.locator(".nav-plus").click(); page.locator(f".fenetre-plus [data-k={k}]").click()

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    aller(page, 'apports')
    c = page.locator(".carnet")
    assert "Aujourd’hui" in c.inner_text() and "Rien de noté" in c.inner_text()
    assert c.locator(".compteur").count() == 7
    # petit-déjeuner
    c.get_by_role("button", name=re.compile(r"^\+ Croissant")).click()
    c.get_by_role("radio", name="Boissons").click()
    c.get_by_role("button", name=re.compile(r"^\+ Café au lait")).click()
    t = c.inner_text()
    assert "Croissant" in t and "Café au lait" in t
    kcal = int(re.search(r"Énergie\s*([\d\s ]+)\s*/", t).group(1).replace(" ", "").replace(" ", ""))
    assert kcal == 345, kcal
    # recherche et dépassement des sucres avec des sodas
    page.fill("#carnet-cherche", "soda")
    for _ in range(3): page.locator("#carnet-resultats").get_by_role("button", name=re.compile(r"^\+ Soda\b")).first.click()
    sucres = page.locator(".compteur", has_text="Sucres")
    assert "c-rouge" in sucres.get_attribute("class") or "c-neutre" in sucres.get_attribute("class"), sucres.get_attribute("class")
    # +1 soda pour être sûr du dépassement
    page.locator(".liste-carnet li", has_text="Soda").get_by_role("button", name="Une portion de plus").click()
    sucres = page.locator(".compteur", has_text="Sucres")
    assert "c-rouge" in sucres.get_attribute("class") and "dépassé de" in sucres.inner_text()
    assert "😟" in page.locator(".humeur-jour").inner_text() and "sucres" in page.locator(".humeur-jour").inner_text()
    page.locator(".carnet").screenshot(path=f"{OUT}/ca1.png")
    # retirer, autre aliment, jour précédent
    page.locator(".liste-carnet li", has_text="Soda").get_by_role("button", name=re.compile("Retirer")).click()
    page.locator(".carnet details summary").click()
    page.fill("#carnet-perso-nom", "Crêpe au sucre"); page.fill("#carnet-perso-kcal", "220")
    clic("Ajouter")
    assert "Crêpe au sucre" in page.locator(".carnet").inner_text()
    page.get_by_role("button", name="Jour précédent").click()
    assert "Rien de noté" in page.locator(".carnet").inner_text()
    page.reload(); aller(page, 'apports')
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).ajouts.length") == 3
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("CARNET OK")
    nav.close()
