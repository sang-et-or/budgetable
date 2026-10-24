# Améliorer un plat : idées, ajouter / changer / retirer, ingrédient fait main avec calories en ligne, « ma version »
import sys, re, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
E = "JSON.parse(localStorage.getItem('budgetable.v1'))"
OFF = {"products": [{"code": "1", "product_name_fr": "Graines de chia", "brands": "Bio", "nutriments": {"energy-kcal_100g": 486, "proteins_100g": 17}}]}
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 760, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.route("https://world.openfoodfacts.org/**", lambda r: r.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(OFF)))
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    # ce test suppose une semaine qui commence le lundi : on la cale sur le lundi de cette semaine
    page.evaluate("() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); const x = new Date(); x.setDate(x.getDate() - (x.getDay() + 6) % 7); d.planDu = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); localStorage.setItem('budgetable.v1', JSON.stringify(d)); }"); page.reload()
    avant = page.evaluate(f"{E}.plan.jours[0].diner.recette")
    ing0 = page.evaluate(f"Engine.REC['{avant}'].ing.map(([i]) => i)")
    kcal0 = page.evaluate(f"Nutrition.de(Engine.REC['{avant}'], Engine.ING).kcal")
    page.locator("main .jour").first.locator("[data-a=fiche][data-s=diner]").click()
    f = page.locator(".fiche").last
    f.get_by_role("button", name="✏️ Améliorer ce plat").click()
    ed = f.locator(".edition-plat")
    n0 = ed.locator(".ing-edit").count(); assert n0 == len(ing0)
    if ed.locator("[data-a=plat-suggestion]").count(): ed.locator("[data-a=plat-suggestion]").first.click()
    # ajouter du parmesan
    page.locator("#plat-cherche").press_sequentially("parmes", delay=30)
    ed.get_by_role("button", name=re.compile(r"\+ Parmesan")).click()
    assert "Parmesan" in ed.inner_text()
    # changer le premier ingrédient
    ed.locator("[data-a=plat-remplacer]").first.click()
    page.locator("#plat-cherche").press_sequentially("échal", delay=30)
    ed.get_by_role("button", name=re.compile("Échalotes")).click()
    assert "Échalotes" in ed.inner_text()
    # retirer le dernier
    nb = ed.locator(".ing-edit").count()
    ed.locator("[data-a=plat-retirer]").nth(1).click()
    assert ed.locator(".ing-edit").count() == nb - 1
    # ingrédient fait main, calories trouvées en ligne
    page.locator("#plat-cherche").press_sequentially("graines de chia", delay=20)
    ed.get_by_role("button", name=re.compile("Créer « graines de chia »")).click()
    ed.get_by_role("button", name=re.compile("Chercher les calories en ligne")).click()
    page.wait_for_timeout(400)
    ed.get_by_role("button", name=re.compile("Graines de chia")).click()
    assert page.locator("#man-kcal").input_value() == "486"
    page.locator("#man-q").fill("15")
    ed.get_by_role("button", name="Ajouter au plat").click()
    assert "Graines de chia" in ed.inner_text()
    ed.screenshot(path=f"{OUT}/ap1.png")
    # chaque fois que ce plat revient
    ed.get_by_role("radio", name="Chaque fois que ce plat revient").click()
    ed.get_by_role("button", name="Enregistrer ma version").click()
    s = page.evaluate(E)
    v = s["plan"]["jours"][0]["diner"]["recette"]
    assert v.startswith("v-") and s["versionsPreferees"][avant] == v, (v, s.get("versionsPreferees"))
    ingv = page.evaluate(f"Engine.REC['{v}'].ing.map(([i]) => i)")
    assert "parmesan" in ingv and "echalote" in ingv and any(i.startswith("u-graines-de-chia") for i in ingv)
    kcal1 = page.evaluate(f"Nutrition.de(Engine.REC['{v}'], Engine.ING).kcal"); print("kcal", kcal0, "→", kcal1)
    assert "Ma version de ce plat" in page.locator(".fiche").last.inner_text()
    page.locator(".fiche").last.screenshot(path=f"{OUT}/ap2.png")
    page.locator(".fiche").last.get_by_role("button", name="Fermer", exact=True).first.click()
    assert "ma version" in page.locator("main .jour").first.inner_text().lower()
    # liste de courses : parmesan et chia (prix inconnu)
    page.locator("nav button[data-k=courses]").click()
    t = page.locator("main").inner_text(); assert "Parmesan" in t and "Graines de chia" in t, t[:500]
    # après rechargement, la version est toujours là ; un plat d'origine reprend la version préférée
    page.reload()
    page.evaluate(f"(() => {{ const a = {E}; a.plan.jours[0].diner.recette = '{avant}'; delete a.plan.jours[0].diner.original; localStorage.setItem('budgetable.v1', JSON.stringify(a)); }})()")
    page.reload(); page.wait_for_timeout(300)
    assert page.evaluate(f"{E}.plan.jours[0].diner.recette") == v
    # revenir à l'origine pour un repas
    page.locator("nav button[data-k=semaine]").click()
    page.locator("main .jour").first.locator("[data-a=fiche][data-s=diner]").click()
    page.locator(".fiche").last.get_by_role("button", name="Revenir à la recette d’origine").click()
    assert page.evaluate(f"{E}.plan.jours[0].diner.recette") == avant
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("AMELIORER PLAT OK")
    nav.close()
