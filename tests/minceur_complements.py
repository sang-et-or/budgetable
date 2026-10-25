# Programme minceur : l'entrée et le dessert comptent dans le repas et la journée ; la part du plat s'ajuste
import re, json
from playwright.sync_api import sync_playwright
erreurs = []
PROG = "{ debut: '2026-10-20', sexe: 'f', age: 35, taille: 165, poidsDepart: 75, poidsActuel: 74, objectif: 65, activite: 'moderee', rythme: 'doux', personnes: 1, ajustement: 0, pesees: [], bilans: [], semaine: 1 }"
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.route("https://upload.wikimedia.org/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(300)
    page.evaluate(f"() => {{ const d = JSON.parse(localStorage.getItem('budgetable.v1')); d.profil.consentementSante = true; d.profil.programme = {PROG}; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }}")
    page.reload(); page.wait_for_timeout(400)
    carte = page.locator("main .jour-carte, main article").filter(has=page.locator(".assiette-semaine")).first
    kcal = lambda: int(re.sub(r"\D", "", page.locator("main .kcal-pour-vous").first.inner_text().split("kcal")[0]))
    total = lambda: int(re.sub(r"\D", "", page.locator("main .total-minceur").first.inner_text().split("kcal")[0]))
    k0, t0 = kcal(), total()
    # entrée : les plus légères d'abord, avec les kcal affichées
    page.locator("main [data-a=complement-ouvrir][data-k=entree]").first.click(); page.wait_for_timeout(300)
    meta = page.locator(".fenetre-complement .liste-complements .small.muted").first.inner_text(); print("meta :", meta)
    assert "kcal la part" in meta
    page.locator(".fenetre-complement [data-a=complement-choisir]").first.click(); page.wait_for_timeout(300)
    # dessert le plus riche (pour déclencher le conseil)
    page.locator("main [data-a=complement-ouvrir][data-k=dessert]").first.click(); page.wait_for_timeout(300)
    page.locator(".fenetre-complement [data-a=complement-filtre][data-k=maison]").click(); page.wait_for_timeout(200)
    page.locator(".fenetre-complement [data-a=complement-choisir]").last.click(); page.wait_for_timeout(300)
    k1, t1 = kcal(), total()
    print("repas", k0, "→", k1, "| journée", t0, "→", t1)
    assert t1 > t0, "la journée compte l'entrée et le dessert"
    page.locator("main details.assiette-semaine summary").first.click(); page.wait_for_timeout(200)
    det = page.locator("main details.assiette-semaine").first.inner_text(); print(det[-400:].replace("\n", " | "))
    assert "Entrée :" in det and "Dessert :" in det
    assert ("part du plat est ajustée" in det) or ("choisissez-en un plus léger" in det)
    assert "le repas" in page.locator("main .kcal-pour-vous").first.inner_text()
    # « C'est mangé » : l'entrée et le dessert vont au journal
    page.locator("main [data-a=mange]").first.click(); page.wait_for_timeout(300)
    j = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).journal")
    print("journal :", j)
    assert any(x.get("c") == "entree" for x in j) and any(x.get("c") == "dessert" for x in j)
    nav.close()
assert not erreurs, erreurs
print("MINCEUR COMPLEMENTS OK")
