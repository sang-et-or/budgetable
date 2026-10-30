# Visite guidée : s'ouvre une fois après la première semaine, se parcourt, ne revient pas, se rouvre depuis Profil
from playwright.sync_api import sync_playwright
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => false })")
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.route("https://wrcxlvdyegfjawmwtozk.supabase.co/**", lambda r: r.fulfill(status=200, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"}, content_type="application/json", body="[]"))
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()")
    page.evaluate("localStorage.setItem('budgetable.attente', '1')")   # comme une inscription en cours : les données sont gardées
    page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name="Créer ma semaine").first.click() if page.get_by_role("button", name="Créer ma semaine").count() else page.locator("[data-a=valider]").first.click()
    page.wait_for_timeout(400)
    tuto = page.locator(".fenetre-tuto")
    assert tuto.count() == 1, "la visite s'ouvre après la première semaine"
    assert "1/9" in tuto.inner_text()
    vus = []
    for i in range(8):
        vus.append(page.locator(".fenetre-tuto h2").inner_text())
        page.locator(".fenetre-tuto [data-a=tuto-suiv]").click(); page.wait_for_timeout(150)
    assert "9/9" in tuto.inner_text(), tuto.inner_text()
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).onglet") == "profil"
    page.locator(".fenetre-tuto [data-a=tuto-prec]").click(); page.wait_for_timeout(150)
    assert "8/9" in tuto.inner_text()
    page.locator(".fenetre-tuto [data-a=tuto-fin]").click(); page.wait_for_timeout(200)
    assert page.locator(".fenetre-tuto").count() == 0
    page.reload(); page.wait_for_timeout(600)
    assert page.locator(".fenetre-tuto").count() == 0, "ne revient pas après l'avoir vue"
    page.locator("nav button[data-k=profil]:visible").click(); page.wait_for_timeout(200)
    page.locator("[data-a=tuto-ouvrir]").click(); page.wait_for_timeout(200)
    assert page.locator(".fenetre-tuto").count() == 1 and "1/9" in page.locator(".fenetre-tuto").inner_text()
    page.screenshot(path="/tmp/claude-0/-home-claude/e7ca5389-2d6a-596d-9613-ea14ab557a7b/scratchpad/tuto.png")
    print("étapes :", vus)
    nav.close()
assert not erreurs, erreurs
print("OK visite guidée")
