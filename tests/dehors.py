# Semaine : « Mangé dehors » (le plat ne compte pas) et plus de doublons dans la semaine
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
E = "JSON.parse(localStorage.getItem('budgetable.v1'))"
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 760, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    total = lambda: page.evaluate(f"Engine.listeCourses({E}.plan, {E}.profil).consomme")
    t0 = total()
    lundi = page.locator("main .jour").first
    lundi.locator("[data-a=dehors][data-s=diner]").click()
    s = page.evaluate(E)
    assert s["deduits"]["0-diner"] == "dehors" and s["plan"]["jours"][0]["diner"]["dehors"]
    t1 = total(); print("courses", t0, "→", t1); assert t1 < t0
    assert "Mangé dehors" in lundi.inner_text()
    lundi.screenshot(path=f"{OUT}/d1.png")
    lundi.get_by_role("button", name="annuler").first.click()
    assert total() == t0 and not page.evaluate(E)["plan"]["jours"][0]["diner"].get("dehors")
    # noter ce qui a été mangé dehors → carnet
    lundi.locator("[data-a=dehors][data-s=dejeuner]").first.click() if lundi.locator("[data-a=dehors][data-s=dejeuner]").count() else lundi.locator("[data-a=dehors][data-s=diner]").click()
    page.get_by_role("button", name="Noter ce que j’ai mangé").first.click()
    assert "Sandwich" in page.locator("main").inner_text()
    # une semaine avec un doublon est réparée au chargement
    page.evaluate(f"(() => {{ const a = {E}; a.plan.jours[5].diner = {{ ...a.plan.jours[4].diner }}; delete a.plan.jours[5].diner.choisi; localStorage.setItem('budgetable.v1', JSON.stringify(a)); }})()")
    page.reload(); page.wait_for_timeout(500)
    s = page.evaluate(E)
    sigs = [page.evaluate(f"Engine.REC['{m['recette']}'].sig || '{m['recette']}'") for jp in s["plan"]["jours"] for m in [jp.get("dejeuner"), jp.get("diner")] if m]
    assert len(set(sigs)) == len(sigs), sigs
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("DEHORS OK")
    nav.close()
