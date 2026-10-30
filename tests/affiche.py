# Semaine : affiche du frigo à imprimer (A4 paysage, une seule page)
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.get_by_role("button", name=re.compile("Menu à afficher sur le frigo")).click()
    a = page.locator(".affiche")
    assert a.count() == 1
    assert a.locator(".aff-jour").count() == 7
    n = a.locator(".aff-case").count(); assert n >= 7, n
    page.locator("#affiche-titre").fill("Les menus de la famille")
    assert "Les menus de la famille" in a.inner_text()
    page.wait_for_timeout(800)
    page.screenshot(path=f"{OUT}/aff-papier.png")
    for st in ["Ardoise", "Économie d’encre"]:
        page.get_by_role("radio", name=st).click(); page.wait_for_timeout(500)
        page.locator(".affiche").screenshot(path=f"{OUT}/aff-{st[:3]}.png")
    page.get_by_role("radio", name="Papier crème").click()
    page.wait_for_timeout(800)
    page.emulate_media(media="print")
    page.pdf(path=f"{OUT}/affiche.pdf", prefer_css_page_size=True, print_background=True)
    page.emulate_media(media="screen")
    # mobile : l'affiche tient dans la largeur
    page.set_viewport_size({"width": 390, "height": 844}); page.wait_for_timeout(300)
    bw = page.evaluate("document.querySelector('.affiche').getBoundingClientRect().width")
    assert bw <= 390, bw
    page.screenshot(path=f"{OUT}/aff-mobile.png")
    page.keyboard.press("Escape")
    assert page.locator(".affiche").count() == 0
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("AFFICHE OK")
    nav.close()
