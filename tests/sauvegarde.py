# Sauvegarde dans un fichier puis restauration après une réinstallation (données effacées)
import re, json
from playwright.sync_api import sync_playwright
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); ctx = nav.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True); page = ctx.new_page()
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    page.evaluate("navigator.canShare = undefined")
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(400)
    avant = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    plats_avant = json.dumps(avant["plan"]["jours"])
    # la sauvegarde est proposée dans « Ma semaine en un coup d'œil »
    page.locator("[data-a=outil-mobile][data-k=sauvegarde]").click()
    assert "Pas encore de sauvegarde" in page.locator(".outils-m").inner_text()
    with page.expect_download() as dl:
        page.locator("[data-a=sauvegarde-faire]").first.click()
    chemin = "/tmp/claude-0/sauvegarde.json"; dl.value.save_as(chemin)
    contenu = json.load(open(chemin)); assert contenu["type"] == "sauvegarde" and contenu["donnees"]["plan"]
    assert "aujourd’hui" in page.locator(".outils-m").inner_text()
    # réinstallation : tout est effacé
    page.evaluate("localStorage.clear()"); page.reload(); page.wait_for_timeout(300)
    assert page.get_by_role("button", name="🍽️ Tester gratuitement sans compte", exact=True).count()
    page.locator("input[data-a=sauvegarde-fichier]").first.set_input_files(chemin)
    page.wait_for_timeout(600)
    apres = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    assert json.dumps(apres["plan"]["jours"]) == plats_avant, "la semaine est revenue à l'identique"
    assert page.locator("nav button[data-k=semaine]:visible").count(), "l'appli s'ouvre sur la semaine"
    page.screenshot(path="/tmp/claude-0/restaure.png")
    # restaurer par-dessus une semaine existante : confirmation demandée dans le profil
    page.locator("nav button[data-k=profil]:visible").click(); page.wait_for_timeout(300)
    page.locator(".bloc-sauvegarde input[data-a=sauvegarde-fichier]").set_input_files(chemin); page.wait_for_timeout(400)
    assert "Remplacer les données" in page.locator(".bloc-sauvegarde").inner_text()
    page.locator("[data-a=sauvegarde-restaurer-ok]").click(); page.wait_for_timeout(300)
    # un fichier quelconque est refusé
    open("/tmp/claude-0/faux.json", "w").write('{"a":1}')
    page.locator("nav button[data-k=profil]:visible").click(); page.wait_for_timeout(300)
    page.locator(".bloc-sauvegarde input[data-a=sauvegarde-fichier]").set_input_files("/tmp/claude-0/faux.json"); page.wait_for_timeout(300)
    assert "Remplacer les données" not in page.locator(".bloc-sauvegarde").inner_text()
    nav.close()
assert not erreurs, erreurs
print("SAUVEGARDE OK")
