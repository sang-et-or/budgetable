# Gamelle du midi notée dans le journal des calories, sans toucher au placard
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
etat = lambda page: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 1100, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(500)
    # semaine commencée lundi : les gamelles des jours passés et d'aujourd'hui peuvent être notées
    page.evaluate("() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); const x = new Date(); x.setDate(x.getDate() - (x.getDay() + 6) % 7); d.planDu = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); localStorage.setItem('budgetable.v1', JSON.stringify(d)); }"); page.reload()
    clic("Prévoir mes gamelles")
    # gamelles tous les jours, pour que celle d'aujourd'hui existe
    f = page.locator(".fenetre-gamelles")
    for j in range(7):
        c = f.locator(f"[data-a=gamelles-jour][data-j='{j}']")
        if c.get_attribute("aria-pressed") != "true": c.click()
    f.get_by_role("button", name="C’est réglé").click()
    page.wait_for_timeout(300)
    btn = page.locator("[data-a=gamelle-mangee]").first
    assert btn.count() == 1, "bouton « J’ai mangé ma gamelle » sur le jour d'aujourd'hui"
    j = int(btn.get_attribute("data-j"))
    avant = etat(page)
    btn.click(); page.wait_for_timeout(300)
    apres = etat(page)
    g = apres["plan"]["jours"][j]["gamelles"]
    entrees = [x for x in apres["journal"] if x.get("gamelle")]
    assert len(entrees) == 1 and entrees[0]["r"] == g["recette"] and entrees[0]["s"] == "dejeuner", entrees
    assert apres["profil"].get("stock") == avant["profil"].get("stock"), "le placard ne doit pas bouger"
    assert apres.get("deduits", {}) == avant.get("deduits", {})
    assert "Gamelle notée" in page.inner_text("main")
    page.screenshot(path=f"{OUT}/gamelle-journal.png")
    # visible dans le journal, avec ses calories
    page.locator("nav.nav button[data-k=journal]").click(); page.wait_for_timeout(300)
    t = page.inner_text("main")
    assert "🥡" in t and "gamelle" in t.lower(), t[:600]
    # annuler
    page.locator("nav.nav button[data-k=semaine]").click(); page.wait_for_timeout(200)
    page.locator("[data-a=gamelle-annuler]").first.click(); page.wait_for_timeout(200)
    assert not [x for x in etat(page)["journal"] if x.get("gamelle")]
    assert etat(page)["profil"].get("stock") == avant["profil"].get("stock")
    nav.close()
assert not erreurs, erreurs
print("OK gamelle dans le journal")
