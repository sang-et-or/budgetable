# Test du commis de cuisine IA (IA simulée) : python3 tests/commis.py [dossier_captures]
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
SIMU = """window.claude = { use: async (nom) => nom === 'sample' ? { json: async (msgs, opts) => {
  window.__envois = (window.__envois || []).concat([msgs]);
  await new Promise(r => setTimeout(r, 300));
  return { reponse: 'Pas de crème ? Mettez 2 cuillères de lait et une noisette de beurre.' };
} } : null };"""
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844})
    page.add_init_script(SIMU)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto("http://localhost:8765/index.html")
    page.evaluate("localStorage.clear()"); page.reload()
    page.get_by_role("button", name="Préparer ma semaine").first.click()
    cliquer = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        if page.get_by_role("button", name="Arachide").count(): cliquer("Arachide")
        cliquer("Continuer")
    cliquer("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator(".titre-repas").first.click()
    commis = page.locator(".commis")
    assert "Une question" in commis.inner_text(), commis.inner_text()
    commis.get_by_role("button", name="Il me manque un ingrédient").click()
    page.wait_for_function("document.querySelector('.commis') && document.querySelector('.commis').innerText.includes('Pas de crème')")
    page.fill("#chef-texte", "Et pour le dessert ?"); page.press("#chef-texte", "Enter")
    page.wait_for_function("document.querySelectorAll('.commis .bulle-chat').length >= 4")
    envois = page.evaluate("window.__envois")
    consigne = envois[0][0]["content"]
    assert "commis de cuisine" in consigne and "Ingrédients :" in consigne and "Étapes :" in consigne
    assert "allergie Arachide" in consigne, consigne[:600]
    assert len(envois[1]) == 4, "historique non transmis"
    commis.scroll_into_view_if_needed()
    page.screenshot(path=f"{OUT}/7-commis.png")
    print("Consigne (début) :", consigne[:240].replace("\n", " | "))
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("COMMIS OK")
    nav.close()
