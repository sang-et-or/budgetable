# Test du panneau sur une page de drive d'essai, puis chargement réel de l'extension dans Chromium.
# Usage : python3 tests/panneau.py [dossier_captures]
import sys, os, json, hashlib, tempfile
from playwright.sync_api import sync_playwright

ICI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
LISTE = "BUDGETABLE1:" + json.dumps({"date": "2026-10-20", "articles": [
    {"id": "lentilles_corail", "nom": "Lentilles corail", "recherche": "lentilles corail", "besoin": "154 g", "conditionnements": 1, "condLabel": "paquet 500 g"},
    {"id": "riz", "nom": "Riz long", "recherche": "riz", "besoin": "380 g", "conditionnements": 1, "condLabel": "paquet 1 kg"}]})
erreurs = []

with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 1100, "height": 800})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto("file://" + os.path.join(ICI, "tests", "page-drive.html"))
    page.evaluate("""(liste) => {
        localStorage.setItem('budgetable-ext:liste', JSON.stringify(liste));
        window.__budgetableDriveTest = 'carrefour';
    }""", json.loads(LISTE[len("BUDGETABLE1:"):]))
    for f in ["drives.js", "lecture.js", "stockage.js", "panneau.js"]:
        page.add_script_tag(path=os.path.join(ICI, f))
    page.wait_for_timeout(800)
    lire = lambda: page.evaluate("document.querySelector('#budgetable-panneau').shadowRoot.textContent")
    texte = lire()
    assert "Lentilles corail" in texte and "Article 1 sur 2" in texte, texte
    prix = page.evaluate("""() => [...document.querySelector('#budgetable-panneau').shadowRoot.querySelectorAll('.prod .prix')].map(e => e.textContent)""")
    print("Prix proposés :", prix)
    assert prix[0].startswith("2,79") and prix[1].startswith("1,49") and prix[2].startswith("1,83"), "ordre au kilo : 2,79 puis 2,98 puis 3,66 €/kg"
    assert not any("2,10" in x or "2,35" in x for x in prix), "produits hors sujet affichés"
    page.screenshot(path=f"{OUT}/ext-panneau.png")
    # clic utilisateur sur « Ajouter au panier » → bouton du site cliqué
    page.evaluate("""() => document.querySelector('#budgetable-panneau').shadowRoot.querySelector('[data-a=ajouter]').click()""")
    page.wait_for_timeout(300)
    assert page.evaluate("window.__ajoutes") == ["E1"], page.evaluate("window.__ajoutes")
    releves = page.evaluate("JSON.parse(localStorage.getItem('budgetable-ext:releves'))")
    assert releves["carrefour"]["lentilles_corail"]["prix"] == 2.79, releves
    assert "ajouté au panier" in lire()
    print("Ajout au panier : OK (bouton du site cliqué, prix noté 2,79 €)")
    nav.close()

    # Chargement réel de l'extension : le manifeste doit être accepté et la fenêtre s'ouvrir
    profil = tempfile.mkdtemp()
    ctx = p.chromium.launch_persistent_context(profil, channel="chromium", headless=True,
        args=[f"--disable-extensions-except={ICI}", f"--load-extension={ICI}"])
    ext_id = "".join(chr(ord('a') + int(c, 16)) for c in hashlib.sha256(ICI.encode()).hexdigest()[:32])
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: erreurs.append(str(e)))
    pg.goto(f"chrome-extension://{ext_id}/popup.html")
    pg.fill("#colle", LISTE)
    pg.click("#enregistrer")
    pg.wait_for_timeout(300)
    msg = pg.inner_text("#msg")
    print("Fenêtre de l'extension :", msg)
    assert "2 articles" in msg
    pg.set_viewport_size({"width": 380, "height": 640})
    pg.screenshot(path=f"{OUT}/ext-popup.png", full_page=True)
    ctx.close()

print("Erreurs JS :", erreurs or "aucune")
print("EXTENSION OK" if not erreurs else "ERREURS")
