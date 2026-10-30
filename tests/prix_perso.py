# Liste de courses : changer le prix d'un produit (gardé, utilisé partout), puis revenir au prix estimé
import re
from playwright.sync_api import sync_playwright
erreurs = []
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
    clic("Voir mon profil"); page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(400)
    page.locator("nav button[data-k=courses]:visible").click(); page.wait_for_timeout(300)
    bouton = page.locator("main .prix-modif").first
    id_ = bouton.get_attribute("data-id")
    avant = bouton.inner_text()
    bouton.click(); page.wait_for_timeout(150)
    champ = page.locator(f"#prix-{id_}")
    assert champ.count() == 1, "le champ de prix s'ouvre"
    champ.fill("abc"); page.locator(".edition-prix button[type=submit]").click(); page.wait_for_timeout(150)
    assert page.locator(".edition-prix").count() == 1, "un prix invalide est refusé"
    champ.fill("9,99"); page.locator(".edition-prix button[type=submit]").click(); page.wait_for_timeout(300)
    assert page.locator(".edition-prix").count() == 0
    perso = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).prixPerso")
    assert perso.get(id_) == 9.99, perso
    apres = page.locator(f"main .prix-modif[data-id='{id_}']").inner_text()
    assert "9,99" in apres or apres != avant, (avant, apres)
    assert page.locator(f"main .prix-modif[data-id='{id_}'] .prix-perso").count() == 1
    page.reload(); page.wait_for_timeout(500)
    page.locator("nav button[data-k=courses]:visible").click(); page.wait_for_timeout(300)
    assert page.locator(f"main .prix-modif[data-id='{id_}']").inner_text() == apres, "le prix est gardé après rechargement"
    page.locator(f"main .prix-modif[data-id='{id_}']").click(); page.wait_for_timeout(150)
    page.locator("[data-a=prix-reset]").click(); page.wait_for_timeout(300)
    assert id_ not in page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).prixPerso")
    assert page.locator(f"main .prix-modif[data-id='{id_}']").inner_text().replace(" ✎", "") == avant.replace(" ✎", ""), "retour au prix estimé"
    print("prix :", avant, "→", apres)
    nav.close()
assert not erreurs, erreurs
print("OK prix modifiables")
