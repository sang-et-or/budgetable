# Ce soir : « J'ai ces aliments » propose des recettes avec les aliments choisis.
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
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button", has_text="Ce soir").click()
    clic("Choisir mes aliments")
    b = page.locator(".jai-ca")
    # vérifie qu'aucune recette proposée ne demande autre chose que les aliments choisis (+ basiques)
    verif = """(() => { const a = { ids: [...document.querySelectorAll('.jai-ca [data-a=jaica-retirer]')].map((e) => e.dataset.id) }; const B = ['huile_olive','ail','curry','cumin','paprika','bouillon','sauce_soja','moutarde'];
      return [...document.querySelectorAll('.jai-ca .titre-repas')].map((el) => { const r = Engine.REC[el.dataset.r];
        return r.ing.map(([id]) => id).filter((id) => Engine.ING[id] && !Engine.ING[id].perso && !a.ids.includes(id) && !B.includes(id)); }).filter((m) => m.length); })()"""
    b.get_by_role("button", name=re.compile(r"^\+ .*Pâtes")).click()
    page.locator("#jaica-cherche").press_sequentially("boeuf hach", delay=30)
    page.locator("#jaica-propositions").get_by_role("button").first.click()
    t = b.inner_text(); print(t[:900])
    assert page.evaluate(verif) == [], page.evaluate(verif)
    assert "Avez-vous aussi" in t, t
    # répondre oui à la première question : l'aliment rejoint la liste
    n0 = page.locator(".jai-ca [data-a=jaica-retirer]").count()
    b.get_by_role("button", name="Oui, j’en ai").first.click()
    assert page.locator(".jai-ca [data-a=jaica-retirer]").count() == n0 + 1
    assert page.evaluate(verif) == []
    # répondre non : la question disparaît
    q = b.locator(".questions-jaica li").first.inner_text().split("?")[0]
    b.get_by_role("button", name="Non", exact=True).first.click()
    assert "Vous n’avez pas" in b.inner_text()
    assert q not in b.locator(".questions-jaica").inner_text() if b.locator(".questions-jaica").count() else True
    assert page.evaluate(verif) == []
    b.screenshot(path=f"{OUT}/jc1.png")
    # au menu ce soir
    if b.get_by_role("button", name="Au menu ce soir").count():
        nom = b.locator(".titre-repas").first.inner_text()
        b.get_by_role("button", name="Au menu ce soir").first.click()
        print("Ce soir :", nom)
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("JAICA OK")
    nav.close()
