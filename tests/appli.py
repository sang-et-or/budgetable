# Appli installable : manifeste, icônes, hors ligne, raccourcis, aide d'installation (iPhone)
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page(); page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    cdp = ctx.new_cdp_session(page)
    assert cdp.send("Page.getInstallabilityErrors")["installabilityErrors"] == []
    for f in ["icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "captures/telephone-semaine.png"]:
        assert page.request.get("http://localhost:8766/" + f).ok, f
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.wait_for_function("navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(() => true)")
    page.reload(); page.wait_for_timeout(1500)
    # hors ligne : l'appli s'ouvre quand même avec la semaine
    ctx.set_offline(True)
    page.reload(); page.wait_for_timeout(1500)
    assert page.locator("main .jour").count() >= 1, page.inner_text("body")[:300]
    ctx.set_offline(False)
    # raccourci « Courses »
    page.goto("http://localhost:8766/index.html?onglet=courses&source=raccourci"); page.wait_for_timeout(500)
    assert "Pour la semaine" in page.inner_text("main") and "onglet" not in page.url
    # profil : section application et aide (pas d'invitation du navigateur ici → aide)
    page.locator("nav button[data-k=profil]").click()
    page.get_by_role("button", name="📲 Installer l’appli").first.click()
    assert "Installer Budgétable" in page.locator(".fenetre-install").inner_text()
    page.keyboard.press("Escape")
    # iPhone : bandeau d'installation et étapes Safari
    ip = nav.new_context(viewport={"width": 390, "height": 844}, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
    p2 = ip.new_page(); p2.on("pageerror", lambda e: erreurs.append(str(e)))
    p2.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    p2.goto("http://localhost:8766/index.html")
    p2.get_by_role("button", name="📲 Installer l’appli").first.click()
    t = p2.locator(".fenetre-install").inner_text()
    assert "Sur l’écran d’accueil" in t and "iphone" in t.lower(), t
    p2.locator(".fenetre-install").screenshot(path=f"{OUT}/install-ios.png")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("APPLI OK")
    nav.close()
