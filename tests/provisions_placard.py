# Les provisions cochées au questionnaire arrivent dans le placard (nouveaux et anciens comptes)
import sys, re, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 760, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_text("Qu’avez-vous déjà en réserve ?").count(): break
        clic("Continuer")
    assert "rangés dans votre placard" in page.inner_text("body")
    page.locator("button[data-champ=provisions]", has_text="Pâtes").first.click()
    page.locator("button[data-champ=provisions]", has_text="Riz").first.click()
    for _ in range(5):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.wait_for_timeout(500)
    st = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.stock")
    print("placard :", st)
    assert any(k.startswith("pates") for k in st) and any(k.startswith("riz") for k in st) and "huile_olive" in st, st
    page.locator("nav button[data-k=placard]").click(); page.wait_for_timeout(300)
    page.screenshot(path=f"{OUT}/placard-provisions.png")
    # ancien compte : provisions sans placard → rangées au chargement
    d = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    d["profil"]["stock"] = {}; d["profil"].pop("provisionsRangees", None)
    page.evaluate("d => localStorage.setItem('budgetable.v1', JSON.stringify(d))", d); page.reload(); page.wait_for_timeout(500)
    st2 = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.stock")
    assert any(k.startswith("pates") for k in st2), st2
    # un produit supprimé du placard ne revient pas tout seul
    d = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    d["profil"]["stock"] = {}
    page.evaluate("d => localStorage.setItem('budgetable.v1', JSON.stringify(d))", d); page.reload(); page.wait_for_timeout(500)
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.stock") in ({}, None)
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("PROVISIONS PLACARD OK")
    nav.close()
