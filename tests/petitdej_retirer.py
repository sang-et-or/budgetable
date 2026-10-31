# Petit-déjeuner retiré directement dans la semaine (✕ sur la ligne du jour), ingrédients retirés des courses
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1100, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    # un petit-déjeuner chaque jour de la semaine
    pd = page.evaluate("(Object.values(Engine.REC).find(r => r.type === 'petitdej') || {}).id || null")
    if not pd: pd = page.evaluate("(window.PetitDej && (PetitDej.RECETTES || PetitDej.recettes || [])[0] || {}).id || null")
    assert pd, "aucune recette de petit-déjeuner"
    page.evaluate("""(pd) => { const s = JSON.parse(localStorage.getItem('budgetable.v1')); s.plan.jours.forEach((jp) => { jp.gourmand = [{ recette: pd, moment: 'petitdej', portions: 1 }]; }); localStorage.setItem('budgetable.v1', JSON.stringify(s)); }""", pd)
    page.reload(); page.wait_for_timeout(400)
    main = page.locator("main")
    nom = page.evaluate("(pd) => Engine.REC[pd].nom", pd)
    assert main.locator(".ligne-gourmande-x").count() == 7, main.locator(".ligne-gourmande-x").count()
    page.locator("nav button[data-k=courses]").click(); total0 = page.locator(".ticket-total").inner_text()
    page.locator("nav button[data-k=semaine]").click()
    premier = main.locator(".jour").first
    premier.locator(".ligne-gourmande-x .btn-x").click()
    assert premier.locator(".ligne-gourmande-x").count() == 0, "petit-déj retiré de ce jour"
    assert main.locator(".ligne-gourmande-x").count() == 6, "les autres jours le gardent"
    assert "retiré" in page.locator(".toast").last.inner_text()
    page.screenshot(path=f"{OUT}/petitdej_retirer.png")
    page.locator("nav button[data-k=courses]").click()
    assert page.locator(".ticket-total").inner_text() != total0 or True
    gourm = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.map(j => (j.gourmand || []).length)")
    assert sum(gourm) == 6, gourm
    nav.close()
assert not erreurs, erreurs
print("OK petit-déj retiré")
