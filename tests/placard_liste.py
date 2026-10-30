# Le placard fait foi pour la liste de courses : retirer du placard remet dans la liste, « J'en ai déjà » range au placard
import sys, re
from playwright.sync_api import sync_playwright

def aller(page, k):
    """Ouvre un onglet : bouton de la navigation s'il est visible, sinon via « Plus » (téléphone)."""
    b = page.locator(f"nav.nav button[data-k={k}]")
    if b.is_visible(): b.click()
    else: page.locator(".nav-plus").click(); page.locator(f".fenetre-plus [data-k={k}]").click()

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1100, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.locator("[data-a=affiner]").first.click()   # provisions : dans les questions facultatives
    for _ in range(25):
        if page.get_by_text("Qu’avez-vous déjà en réserve ?").count(): break
        clic("Continuer")
    for _ in range(5):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    L = lambda: page.evaluate("""() => { const E = window.Engine, d = JSON.parse(localStorage.getItem('budgetable.v1')); const l = E.listeCourses(d.plan, d.profil);
      return Object.fromEntries(l.articles.map((a) => [a.id, { reserve: !!(a.enStock || a.couvertParPlacard), q: a.quantite, achat: a.conditionnements }])); }""")
    st = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.stock || {}")
    l0 = L()
    base = [i for i in ("huile_olive", "cumin", "paprika", "curry", "bouillon", "moutarde") if i in l0]
    assert base and all(l0[i]["reserve"] for i in base), (base, l0)
    x = base[0]
    # 1. retirer du placard → à acheter
    aller(page, 'placard'); page.wait_for_timeout(1500)   # laisser finir les enregistrements différés
    page.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('budgetable.v1')); delete d.profil.stock['{x}']; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }}"""); page.reload()
    assert not L()[x]["reserve"], "retiré du placard mais toujours « à la maison »"
    # 2. dans la liste : « J'en ai déjà » range au placard
    page.locator("nav button[data-k=courses]").click()
    page.locator(f".ticket [data-a=stock][data-id={x}]").first.click()
    assert st().get(x, 0) > 0 and L()[x]["reserve"]
    assert "Déjà dans votre placard" in page.inner_text(".ticket") or "déjà dans votre placard" in page.inner_text(".ticket")
    # 3. « Je n'en ai plus » : retiré du placard, remis dans la liste
    page.locator(f".reserve-courses summary").click()
    page.locator(f"[data-a=stock][data-id={x}]").first.click()
    assert x not in st() and not L()[x]["reserve"]
    # 4. un produit de la liste rangé avec « J'en ai déjà », puis consommé en partie au placard → la liste remet le manque
    y = next(i for i, v in L().items() if not v["reserve"] and i not in base and page.evaluate(f"!window.Engine.ING['{i}'].perso"))
    page.locator(f".ticket [data-a=stock][data-id={y}]").first.click()
    assert L()[y]["reserve"]
    page.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('budgetable.v1')); d.profil.stock['{y}'] = d.profil.stock['{y}'] * 0.3; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }}"""); page.reload()
    assert not L()[y]["reserve"] and L()[y]["achat"] >= 1
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("PLACARD LISTE OK")
    nav.close()
