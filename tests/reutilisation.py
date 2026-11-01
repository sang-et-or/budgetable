# Fiche recette : à côté de chaque ingrédient, combien de fois il resservira dans la semaine (repas suivants)
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
    # attendu, calculé depuis le plan : pour le premier repas, nombre de repas suivants qui utilisent chaque ingrédient
    f = page.locator("[data-a=fiche]").first
    j, s = int(f.get_attribute("data-j")), f.get_attribute("data-s")
    # la semaine commence le jour de sa création (planDu) : ordre des jours, 0 = lundi
    import datetime
    d = datetime.date.fromisoformat(page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).planDu")).weekday()
    ordre = [(d + k) % 7 for k in range(7)]
    attendu = page.evaluate("""([j, s, ordre]) => { const st = JSON.parse(localStorage.getItem('budgetable.v1')); const plan = st.plan; const pos = (x) => ordre.indexOf(x);
      const m0 = plan.jours[j][s]; const ids = Engine.REC[m0.recette].ing.map(([id]) => id); const n = {};
      plan.jours.forEach((jp, x) => ['dejeuner', 'diner'].forEach((sl) => { const m = jp[sl]; if (!m || !Engine.REC[m.recette]) return;
        if (!(pos(x) > pos(j) || (x === j && sl === 'diner' && s === 'dejeuner'))) return;
        new Set(Engine.consommationRepas(m).map(([id]) => id)).forEach((id) => { if (ids.includes(id)) n[id] = (n[id] || 0) + 1; }); }));
      return Object.entries(n).map(([id, k]) => [Engine.ING[id].nom, k]); }""", [j, s, ordre])
    f.click(); page.wait_for_selector(".fiche")
    lignes = page.locator(".liste-ing-fiche li").all_inner_texts()
    assert lignes, "ingrédients affichés"
    for nom, k in attendu:
        l = next(x for x in lignes if x.startswith(nom + " :"))
        assert f"encore {k} repas" in l, (nom, k, l)
    sans = [x for x in lignes if "↻" not in x]
    assert len(sans) == len(lignes) - len(attendu), (attendu, lignes)
    if attendu: assert "réutilisé plus tard dans la semaine" in page.locator(".fiche").inner_text()
    page.locator(".liste-ing-fiche").scroll_into_view_if_needed(); page.locator(".liste-ing-fiche").locator("xpath=..").screenshot(path=f"{OUT}/reutilisation.png")
    nav.close()
assert not erreurs, erreurs
print("OK réutilisation des ingrédients", len(attendu), "sur", len(lignes))
