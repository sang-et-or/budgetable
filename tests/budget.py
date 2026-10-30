# Budget : montant libre (semaine ou mois) et calculateur à partir des revenus et charges.
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
    clic("🍽️ Tester gratuitement sans compte")
    budget = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.budget")
    for _ in range(25):
        if page.get_by_role("button", name="Taper un montant ou calculer mon budget").count(): break
        clic("Continuer")
    # dans le questionnaire : montant libre par mois
    clic("Taper un montant ou calculer mon budget")
    f = page.locator(".fenetre-budget")
    f.get_by_role("radio", name="par mois").click()
    page.fill("#budget-libre", "400")
    clic("Enregistrer ce budget")
    assert budget() == 92, budget()      # 400 € par mois ≈ 92 € par semaine
    assert "92" in page.locator("#budget-val").inner_text()
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    # depuis la semaine : calculateur
    clic("Modifier ou calculer")
    f = page.locator(".fenetre-budget")
    assert "Indiquez vos revenus" in f.inner_text()
    f.locator("[data-k=revenu1]").fill("1800")
    f.locator("[data-k=revenu2]").fill("1400,50")
    f.locator("[data-k='c:logement']").fill("850")
    f.locator("[data-k='c:energie']").fill("150")
    f.locator("[data-k='c:transport']").fill("250")
    f.locator("[data-k=epargne]").fill("100") if f.locator("[data-k=epargne]").is_visible() else None
    r = f.locator("#calc-resultat").inner_text()
    assert "Reste à vivre" in r and "1 950,50" in r.replace(" ", " ").replace("\xa0", " "), r
    f.locator("[data-a=calc-niveau][data-k=serre]").click()
    bouton = f.get_by_role("button", name=re.compile("^Utiliser"))
    montant = int(re.search(r"(\d+)", bouton.inner_text().replace(" ", "").replace("\xa0", "")).group(1))
    assert montant == round(1950.5 * 0.22 / (52 / 12)), montant
    page.screenshot(path=f"{OUT}/b1-calcul.png", full_page=False)
    bouton.click()
    assert budget() == montant
    # charges supérieures aux revenus : orientation vers les aides
    clic("Modifier ou calculer")
    page.locator(".fenetre-budget [data-k='c:logement']").fill("4000")
    assert "CCAS" in page.locator("#calc-resultat").inner_text()
    clic("Fermer")
    # les montants restent sur l'appareil
    page.reload()
    clic("Modifier ou calculer")
    assert page.locator(".fenetre-budget [data-k=revenu1]").input_value() == "1800"
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("BUDGET OK")
    nav.close()
