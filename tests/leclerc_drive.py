# Leclerc Drive : la recherche s'ouvre dans le magasin de la personne (adresse collée une fois), et l'aide « comment remplir le panier » est affichée.
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    if page.locator("[data-a=tuto-fin]").count(): page.locator("[data-a=tuto-fin]").first.click()
    page.evaluate("() => { const e = JSON.parse(localStorage.getItem('budgetable.v1')); e.onglet = 'courses'; localStorage.setItem('budgetable.v1', JSON.stringify(e)); }"); page.reload(); page.wait_for_timeout(400)
    sec = page.locator(".panier-drive")
    assert "Comment mettre les articles dans le panier de mon drive ?" in sec.inner_text()
    assert "Connectez-vous à votre compte" in sec.inner_text()
    page.locator(".panier-drive [data-a=enseigne][data-k=leclerc]").click()
    sec = page.locator(".panier-drive")
    assert "indiquez votre magasin une fois" in sec.inner_text()
    page.fill("#leclerc-adresse", "https://www.e.leclerc/recherche?q=riz"); page.locator("[data-a=leclerc-magasin]").click()
    assert page.locator("#leclerc-adresse").count() == 1, "adresse non Leclerc Drive refusée"
    page.fill("#leclerc-adresse", "https://fd12-courses.leclercdrive.fr/magasin-046201-046201-Loison/accueil.aspx")
    page.locator("[data-a=leclerc-magasin]").click()
    assert "Votre magasin Leclerc Drive : Loison" in page.locator(".panier-drive").inner_text()
    page.screenshot(path=f"{OUT}/leclerc_courses.png", full_page=False)
    page.locator("[data-a=courses-go]").click()
    href = page.locator(".fenetre-courses .btn-chercher").get_attribute("href")
    print(href)
    assert href.startswith("https://fd12-courses.leclercdrive.fr/magasin-046201-046201-Loison/recherche.aspx?TexteRecherche="), href
    page.screenshot(path=f"{OUT}/leclerc_fenetre.png")
    etat = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    assert etat["drives"]["leclerc"]["ville"] == "Loison"
    nav.close()
assert not erreurs, erreurs
print("OK leclerc drive")
