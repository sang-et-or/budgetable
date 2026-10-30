# Quantités des fiches mesurables en cuisine : œufs entiers, grammes et ml ronds, portions avec virgule
import re
from playwright.sync_api import sync_playwright
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.route("https://upload.wikimedia.org/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(300)
    vus = []
    # la recette des boulettes (œufs) pour 5,4 portions, comme sur la capture
    rec = page.evaluate("Object.values(window.Engine.REC).filter(r => !r.gourmand && r.ing.some(([id]) => id === 'oeufs')).map(r => r.id).slice(0, 25)")
    for rid in rec:
        page.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('budgetable.v1')); const j = d.plan.jours.findIndex(x => x && x.diner); d.plan.jours[j].diner = {{ ...d.plan.jours[j].diner, recette: '{rid}', portions: 5.4, manuel: true }}; delete d.plan.jours[j].diner.extra; delete d.plan.jours[j].diner.restes; localStorage.setItem('budgetable.v1', JSON.stringify(d)); window.__j = j; }}""")
        page.reload(); page.wait_for_timeout(250)
        j = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.findIndex(x => x && x.diner)")
        page.evaluate(f"() => {{ const b = document.createElement('button'); b.dataset.a = 'fiche'; b.dataset.j = '{j}'; b.dataset.s = 'diner'; document.body.appendChild(b); b.click(); b.remove(); }}"); page.wait_for_timeout(200)
        lignes = page.locator(".fiche h3:has-text('Ingrédients') + ul li").all_inner_texts()
        titre = page.locator(".fiche h3:has-text('Ingrédients')").inner_text()
        assert "." not in titre.split("pour")[-1], titre
        for l in lignes:
            nom, _, q = l.partition(" : ")
            vus.append(l)
            if "Œuf" in nom: assert re.fullmatch(r"\d+", q), l
            m = re.fullmatch(r"([\d,]+) (g|ml|cl|kg|L)", q)
            if m and m.group(2) in ("g", "ml"):
                v = int(m.group(1)); assert v < 10 or v % 5 == 0, l
            assert not re.search(r"\d+,\d{2,}", q), l
        page.locator(".voile [data-a=fermer]").first.click(); page.wait_for_timeout(100)
    print(titre, "|", " ; ".join(vus[:9]))
    nav.close()
assert not erreurs, erreurs
print("QUANTITES RECETTE OK")
