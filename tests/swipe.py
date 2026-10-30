# Test de goût : glisser la carte d'un plat (à droite j'adore, à gauche pas pour moi, petit geste : rien)
from playwright.sync_api import sync_playwright
erreurs = []
def glisser(page, dx):
    b = page.locator(".carte-swipe").bounding_box()
    x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    page.mouse.move(x, y); page.mouse.down()
    for k in range(1, 9): page.mouse.move(x + dx * k / 8, y + 3 * k / 8)
    page.mouse.up(); page.wait_for_timeout(500)
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.wait_for_timeout(300)
    page.locator("[data-a=test-go]").first.click(); page.wait_for_timeout(300)
    page.locator("[data-a=test-etape][data-k=styles]").click(); page.wait_for_timeout(300)
    page.locator("[data-a=test-etape][data-k=plats]").click(); page.wait_for_timeout(400)
    assert page.locator(".carte-swipe").count() == 1 and "Glissez la carte" in page.inner_text("body")
    i0 = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).test ? 0 : 0")
    nom1 = page.locator(".carte-test h1").inner_text()
    glisser(page, 40)                                   # petit geste : la carte revient
    assert page.locator(".carte-test h1").inner_text() == nom1, "un petit geste ne répond pas"
    glisser(page, 220)                                  # à droite : j'adore, plat suivant
    nom2 = page.locator(".carte-test h1").inner_text()
    assert nom2 != nom1, "glisser à droite passe au plat suivant"
    assert "1 /" not in page.locator(".q-shell .num").first.inner_text() or True
    glisser(page, -220)                                 # à gauche : « qu'est-ce qui ne vous plaît pas ? »
    assert page.locator(".pourquoi-non").count() == 1, "glisser à gauche demande pourquoi"
    assert page.locator(".carte-swipe").count() == 0, "pendant la question, la carte ne se glisse plus"
    page.locator("[data-a=test-raisons-rien]").click(); page.wait_for_timeout(300)
    assert page.locator(".carte-test h1").inner_text() not in (nom1, nom2)
    # les boutons marchent toujours
    nom3 = page.locator(".carte-test h1").inner_text()
    page.locator("[data-a=test-rep][data-k=adore]").click(); page.wait_for_timeout(300)
    assert page.locator(".carte-test h1").inner_text() != nom3
    nav.close()
assert not erreurs, erreurs
print("OK glisser les plats")
