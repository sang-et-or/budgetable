# Cuisine 3D : la scène se charge, un toucher sur le frigo l'ouvre, la vue à plat reste disponible.
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
    page = nav.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button", has_text="Courses").click()
    clic("✓ Courses faites : tout mettre au placard")
    canvas = page.locator("#scene-cuisine canvas")
    canvas.wait_for(timeout=10000)
    page.wait_for_timeout(800)
    assert page.evaluate("!!window.THREE && THREE.REVISION") == "160"
    # toucher le frigo (à gauche, à mi-hauteur)
    canvas.scroll_into_view_if_needed(); page.wait_for_timeout(200)
    bb = canvas.bounding_box()
    page.mouse.click(bb["x"] + bb["width"] * 0.1, bb["y"] + bb["height"] * 0.62)
    page.wait_for_timeout(300)
    assert page.locator(".zones-3d [data-z=frigo]").get_attribute("aria-pressed") == "true"
    assert page.locator("#scene-cuisine canvas").count() == 1, "la scène est gardée d'un rendu à l'autre"
    assert "Le frigo" in page.locator(".panneau-3d").inner_text()
    # choisir un produit dans le panneau, puis passer par les boutons
    page.locator(".panneau-3d .produit").first.click()
    assert page.locator(".panneau-3d .produit-detail").count() == 1
    page.locator(".zones-3d [data-z=placard]").click()
    assert "Le placard" in page.locator(".panneau-3d").inner_text()
    page.wait_for_timeout(1500)
    page.locator("#scene-cuisine").screenshot(path=f"{OUT}/c3d-placard.png")
    # vue à plat puis retour
    clic("Voir la cuisine à plat")
    assert page.locator(".cuisine .meuble-placard").count() == 1 and page.locator("#scene-cuisine").count() == 0
    clic("Voir la cuisine en 3D")
    assert page.locator("#scene-cuisine canvas").count() == 1
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("CUISINE 3D OK")
    nav.close()
