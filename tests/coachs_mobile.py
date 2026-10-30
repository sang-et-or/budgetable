import re
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    err=[]; page.on("pageerror", lambda e: err.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    assert page.locator(".bandeau-coachs .coach-puce").count() == 3
    page.evaluate("window.scrollTo(0,0)"); page.screenshot(path="/tmp/claude-0/-home-claude/e7ca5389-2d6a-596d-9613-ea14ab557a7b/scratchpad/coachs-mobile.png")
    page.locator(".coach-puce[data-a=onglet][data-k=sport]").click(); assert "Coach sportif" in page.inner_text("main")
    page.locator("nav button[data-k=semaine]").click(); page.wait_for_timeout(300)
    print(page.inner_text("main")[:300]); page.screenshot(path="/tmp/claude-0/-home-claude/e7ca5389-2d6a-596d-9613-ea14ab557a7b/scratchpad/retour.png")
    page.locator(".coach-puce[data-a=onglet][data-k=minceur]").click(); assert "Programme minceur" in page.inner_text("main")
    page.locator("nav button[data-k=semaine]").click()
    page.locator(".coach-puce[data-a=coach-voir]").click(); assert page.locator(".fenetre-coach").count() == 1
    print("ok", err)
    nav.close()
