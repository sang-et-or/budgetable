# Placard : état des produits prévus dans les recettes de la semaine (nombre de repas, prévu, cuisiné, reste, placard)
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
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
    # le produit le plus utilisé, calculé à partir du plan
    attendu = page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('budgetable.v1')); const n = {};
      s.plan.jours.forEach((jp) => ['dejeuner', 'diner'].forEach((sl) => { const m = jp[sl]; if (!m || m.dehors || m.deRestes || !Engine.REC[m.recette]) return;
        Engine.consommationRepas(m).forEach(([id]) => { n[id] = (n[id] || 0) + 1; }); }));
      const [id, f] = Object.entries(n).sort((a, b) => b[1] - a[1])[0]; return { nom: Engine.ING[id].nom, f }; }""")
    page.locator(".nav-plus").click(); page.locator(".fenetre-plus [data-k=placard]").click()
    page.locator(".etat-produits summary").click()
    premier = page.locator(".liste-etat li").first.inner_text()
    assert page.locator(".liste-etat li").count() >= 5
    assert str(attendu["f"]) + " repas" in premier.lower(), (attendu, premier)   # le plus utilisé en premier (à égalité : ordre alphabétique)
    assert "Prévu" in premier and "Cuisiné" in premier and "Reste" in premier and "Au placard" in premier
    # on cuisine un repas : sa part passe en « Cuisiné »
    page.locator("nav button[data-k=semaine]:visible").click()
    page.locator("[data-a=mange]").first.click(); page.wait_for_timeout(200)
    page.locator(".nav-plus").click(); page.locator(".fenetre-plus [data-k=placard]").click()
    if not page.locator(".etat-produits[open]").count(): page.locator(".etat-produits summary").click()
    txt = page.locator(".liste-etat").inner_text()
    assert "✓" in txt, "le repas cuisiné est marqué"
    page.locator(".etat-produits").screenshot(path=f"{OUT}/etat_produits.png")
    nav.close()
assert not erreurs, erreurs
print("OK état des produits")
