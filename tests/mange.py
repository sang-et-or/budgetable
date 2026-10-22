# « C'est mangé » sur un repas : placard déduit (et annulable), puis avis rapide qui apprend les goûts.
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 760, "height": 900}, is_mobile=True, has_touch=True)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    etat = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    # placard rempli avec tout ce qu'il faut
    page.locator("nav button", has_text="Courses").click()
    clic("✓ Courses faites : tout mettre au placard"); clic("C’est bon")
    page.locator("nav button", has_text="Semaine").click()
    stock0 = etat()["profil"]["stock"]
    jour = page.locator(".jour").first
    jour.get_by_role("button", name="✓ C’est mangé").first.click()
    st = etat()["profil"]["stock"]
    assert any(st.get(k, 0) < v for k, v in stock0.items()), "placard non déduit"
    assert etat()["deduits"].get("0-dejeuner") == "cuisine"
    assert "Mangé" in jour.inner_text() and "Vous avez aimé ?" in jour.inner_text()
    # annuler puis refaire
    jour.get_by_role("button", name="annuler").click()
    assert etat()["profil"]["stock"] == stock0
    jour.get_by_role("button", name="✓ C’est mangé").first.click()
    # avis : adoré → note 5, goûts appris, classique
    rid = etat()["plan"]["jours"][0]["dejeuner"]["recette"]
    g0 = etat()["profil"]["gouts"]
    jour.locator(".avis-rapide [data-n='5']").click()
    e = etat()
    assert e["notes"][rid] == 5 and rid in e["classiques"] and e["profil"]["gouts"] != g0
    jour.screenshot(path=f"{OUT}/mg1.png")
    # pas aimé → note 1, plus proposé
    jour.locator(".avis-rapide [data-n='1']").click()
    e = etat(); assert e["notes"][rid] == 1 and rid not in e["classiques"]
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("MANGE OK")
    nav.close()
