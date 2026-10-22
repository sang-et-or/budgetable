# Écran « Mes drives près de chez moi », avec les vraies réponses enregistrées (BAN + OpenStreetMap).
import sys, json, os
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
ICI = os.path.dirname(os.path.abspath(__file__))
osm = open(os.path.join(ICI, "osm-harnes.json")).read()
ban = json.dumps({"features": [{"geometry": {"coordinates": [2.903981, 50.452605]}, "properties": {"label": "Harnes", "postcode": "62440"}}]})
erreurs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.on("pageerror", lambda e: erreurs.append(str(e)))
    pg.route("https://api-adresse.data.gouv.fr/**", lambda r: r.fulfill(status=200, content_type="application/json", body=ban, headers={"Access-Control-Allow-Origin": "*"}))
    pg.route("https://overpass-api.de/**", lambda r: r.fulfill(status=200, content_type="application/json", body=osm, headers={"Access-Control-Allow-Origin": "*"}))
    pg.goto("http://localhost:8766/index.html"); pg.evaluate("localStorage.clear()"); pg.reload()
    pg.get_by_role("button", name="Préparer ma semaine").click()
    for _ in range(20):
        bt = pg.get_by_role("button", name="Voir mon profil")
        if bt.count(): bt.click(); break
        pg.get_by_role("button", name="Continuer").click()
    pg.get_by_role("button", name="Passer et créer ma semaine").click()
    pg.locator("nav button", has_text="Courses").click()
    pg.locator("#mes-drives summary").click()
    pg.fill("#d-cp", "62440")
    pg.get_by_role("button", name="Trouver les drives").click()
    pg.wait_for_selector(".magasin")
    n = pg.locator(".magasin").count(); print("Drives affichés :", n); assert n >= 20
    pg.locator(".magasin input").nth(0).check()
    pg.locator(".magasin input").nth(1).check()
    assert "2 drives choisis" in pg.inner_text("body")
    pg.screenshot(path=f"{OUT}/f-drives.png")
    pg.locator("nav button", has_text="Courses").click()
    chips = pg.locator("[data-a=enseigne]").all_inner_texts()
    print("Enseignes dans Courses :", chips[:3]); assert any("Harnes" in c for c in chips[:2]) and any("km" in c for c in chips[:2])
    pg.reload(); pg.locator("nav button", has_text="Courses").click()
    if not pg.locator("#mes-drives").get_attribute("open") is not None: pg.locator("#mes-drives summary").click()
    assert pg.locator(".magasin").count() == n, "recherche non gardée après rechargement"
    b.close()
print("Erreurs JS :", erreurs or "aucune"); print("DRIVES OK" if not erreurs else "ERREURS")
