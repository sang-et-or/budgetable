# Retours de test du 27 octobre : promotions, prix, variété, allergies, navigation, questionnaire, nutrition, détails.
# Lancer : (cd dist && python3 -m http.server 8766) puis python3 tests/retours_test.py [dossier des captures]
import sys, re, json, time
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
now = int(time.time())
J = 86400
def o(i, nom, rayon, **k):
    base = {"id": i, "enseigne": "Lidl", "nom": nom, "prix": 1.99, "prixAvant": 2.49, "remise": "-20 %", "lidlPlus": False, "cond": "", "prixKg": "", "debut": (now - J) * 1000, "fin": (now + 4 * J) * 1000, "quand": "", "lien": "https://www.lidl.fr/p/" + i, "image": None, "rayon": rayon}
    base.update(k); return base
OFFRES = {"offres": [
    o("t1", "Tarte aux pommes pur beurre", "Boulangerie · Pâtisserie"),
    o("t2", "PRÉSIDENT Beurre doux", "Produits laitiers · Beurre"),
    o("t3", "Cheetos goût fromage", "Épicerie · Apéritif"),
    o("t4", "Roulés au fromage", "Traiteur · Apéritif"),
    o("t5", "MILBONA Emmental râpé", "Produits laitiers · Fromages"),
    o("t6", "Comté râpé", "Produits laitiers · Fromages"),
    o("t7", "Salade de concombres", "Fruits et légumes · Salades"),
    o("t8", "Laitue", "Fruits et légumes · Salades"),
    o("t9", "Oignons jaunes", "Fruits et légumes", debut=None, fin=None, quand="22.10. - 28.10."),
    o("ex1", "Carottes en offre terminée", "Fruits et légumes", debut=(now - 12 * J) * 1000, fin=None, quand="En magasin le 15/10"),
    o("ex2", "Pommes de terre offre passée", "Fruits et légumes", debut=(now - 9 * J) * 1000, fin=(now - 2 * J) * 1000),
    o("av1", "Riz basmati", "Épicerie · Riz", debut=(now + 2 * J) * 1000, fin=(now + 8 * J) * 1000),
], "prospectus": [], "sources": [], "maj": now * 1000}

def route(r):
    if "/promos" in r.request.url: r.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(OFFRES))
    else: r.abort()

def nouvelle_page(nav, largeur, hauteur=900):
    page = nav.new_page(viewport={"width": largeur, "height": hauteur})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", route)
    page.route("https://wrcxlvdyegfjawmwtozk.supabase.co/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    return page

def questionnaire(page, allergies=()):
    """Parcours réaliste du premier menu. → nombre d'écrans de questions."""
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    ecrans = 0
    for _ in range(30):
        ecrans += 1
        titre = page.locator("#q-titre").inner_text()
        if "allergies" in titre:
            for a in allergies: clic(a)
        if page.locator("#consent-sante").count() and allergies: page.locator("#consent-sante").check()
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.wait_for_timeout(200)
    return ecrans

with sync_playwright() as p:
    nav = p.chromium.launch()

    # ---------- 5. questionnaire raccourci, puis « Affiner » ----------
    page = nouvelle_page(nav, 1200)
    t0 = time.time()
    ecrans = questionnaire(page)
    assert ecrans == 7, f"7 écrans essentiels attendus, {ecrans} vus"
    txt = page.inner_text("body")
    assert "questions facultatives" in txt
    # nombre de recettes : formaté, au pluriel, identique à l'accueil
    m = re.search(r"([\d   ]+) recettes compatibles", txt)
    assert m, "« … recettes compatibles » au pluriel"
    n_profil = int(re.sub(r"\D", "", m.group(1)))
    assert n_profil > 10000 and re.search(r"\d[   ]\d{3} recettes compatibles", txt), m.group(0)
    page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(600)
    print(f"premier menu : {ecrans} écrans de questions, {time.time() - t0:.1f} s en automatique")

    # ---------- 2 et 5. page de la semaine : le budget et les repas d'abord, les réglages ensuite ----------
    main = page.locator("main")
    html = main.inner_html()
    assert html.index("resume-budget") < html.index('class="jours"') < html.index("reglages-semaine"), "ordre : budget en bref, repas, réglages"
    t = main.inner_text()
    assert "démo" not in t and "Valeurs fixées à la main" not in t, "plus de « prix démo »"
    assert "Courses à payer" in t and "Mangé cette semaine" in t and "paquets entiers" in t
    assert "Prix utilisés" in t and "non vérifiés en magasin" in t
    assert "Affinez vos menus" in t
    # ---------- 6. nutrition : la portée du chiffre est écrite à côté ----------
    bil = page.locator(".bilan-nutri").first.inner_text()
    assert "déjeuner + dîner" in bil and "ce n’est pas le total de votre journée" in bil, bil[:300]
    page.screenshot(path=f"{OUT}/rt-semaine-bureau.png", full_page=False)

    # ---------- 3. ajuster au budget : menus variés, pas deux plats proches le même jour ----------
    page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('budgetable.v1')); s.profil.budget = 35; localStorage.setItem('budgetable.v1', JSON.stringify(s)); }""")
    page.reload(); page.wait_for_timeout(500)
    avant = page.evaluate("() => Engine.listeCourses(JSON.parse(localStorage.getItem('budgetable.v1')).plan, JSON.parse(localStorage.getItem('budgetable.v1')).profil).total")
    page.locator("#reglage-budget [data-a=ajuster][data-k=varie]").click(); page.wait_for_timeout(1500)
    res = page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('budgetable.v1')); const E = Engine;
      return { total: E.listeCourses(s.plan, s.profil).total, proches: E.joursMonotones(s.plan).length }; }""")
    print("ajuster (menus variés) :", avant, "→", res)
    assert res["total"] < avant and res["proches"] == 0
    assert "en prix estimés" in page.locator(".toast").last.inner_text()

    # ---------- 1. promotions ----------
    page.locator("nav button[data-k=courses]").click(); page.wait_for_timeout(200)
    page.locator(".bandeau-promos").first.click(); page.wait_for_timeout(900)
    t = page.locator("main").inner_text()
    assert "offre terminée" not in t.lower() or "ne sont plus affichées" in t
    assert "Carottes en offre terminée" not in t and "Pommes de terre offre passée" not in t, "offres terminées masquées"
    assert "2 offres terminées ne sont plus affichées" in t, t[-400:]
    assert "Promos à venir" in t
    moi = page.locator(".promos-moi").inner_text()
    print(moi[:900])
    for faux in ("Tarte aux pommes", "Cheetos", "Roulés au fromage", "Salade de concombres"):
        assert faux not in moi, f"« {faux} » ne doit pas être proposé pour la liste"
    # au moins un vrai produit de la liste, et la distinction exact / alternative
    pls = page.evaluate("() => Engine.listeCourses(JSON.parse(localStorage.getItem('budgetable.v1')).plan, JSON.parse(localStorage.getItem('budgetable.v1')).profil).articles.map(a => a.id)")
    if "emmental" in pls:
        assert "MILBONA Emmental râpé" in moi and "Comté râpé" in moi and "Alternative à vérifier" in moi
    if "oignon" in pls: assert "Oignons jaunes" in moi and "du " in moi
    assert "Pas de promotion adaptée" in moi
    # dans la liste de toutes les promos : dates affichées
    assert re.search(r"du \d\d/\d\d au \d\d/\d\d", t)
    page.screenshot(path=f"{OUT}/rt-promos.png", full_page=True)
    # étiquette dans la liste de courses : seulement les correspondances exactes
    page.locator("nav button[data-k=courses]").click(); page.wait_for_timeout(300)
    tags = page.locator(".article .tag-promo").all_inner_texts()
    print("étiquettes promo dans la liste :", tags)
    # ---------- 2. prix : origine sur chaque article, tickets ----------
    titre = page.locator(".article .prix-modif").first.get_attribute("title")
    assert "Estimation Budgétable" in titre and "non vérifié" in titre, titre
    assert "Estimations comparées" not in page.inner_text("main")   # pas encore de ticket
    page.close()

    # ---------- 4. allergies : FAQ prudente, avertissements « à vérifier » ----------
    page = nouvelle_page(nav, 1200)
    faq = page.locator(".faq").text_content()
    assert "jamais" not in faq.split("Et mes allergies ?")[1][:400] and "vérifiez toujours" in faq
    assert "rien n’est enregistré" in faq
    questionnaire(page, allergies=("Gluten",))
    page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(600)
    verif = page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('budgetable.v1')); const E = Engine; const out = { interdits: 0, aVerifier: 0 };
      for (const jp of s.plan.jours) for (const sl of ['dejeuner', 'diner']) { const m = jp[sl]; if (!m) continue; const r = E.REC[m.recette];
        if (r.ing.some(([id]) => E.ING[id].tags.includes('gluten'))) out.interdits++;
        if (E.aVerifier(r, s.profil).length) out.aVerifier++; }
      out.curry = E.aVerifier(E.REC.curry_poulet, s.profil).map(x => x.id); return out; }""")
    print("allergie gluten :", verif)
    assert verif["interdits"] == 0 and verif["curry"] == ["curry"]
    page.close()

    # ---------- 5 et 7. téléphone : navigation courte, « Plus », pas de défilement horizontal ----------
    page = nouvelle_page(nav, 390, 844)
    questionnaire(page); page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(600)
    visibles = page.locator("nav.nav button:visible").all_inner_texts()
    print("barre du bas :", visibles)
    assert len(visibles) == 4 and "Ma semaine" in visibles[0]
    page.locator(".nav-plus").click(); page.wait_for_timeout(200)
    plus = page.locator(".fenetre-plus").inner_text()
    for x in ("Ce soir", "Recettes", "Promos", "Placard", "Apports", "Minceur", "Sport", "Journal", "Gourmand", "Petit-déj"):
        assert x in plus, x
    page.locator(".fenetre-plus [data-k=promos]").click(); page.wait_for_timeout(600)
    assert page.locator(".fenetre-plus").count() == 0 and "Promos du moment" in page.inner_text("main")
    assert "Promos" in page.locator(".nav-plus").inner_text()
    for onglet in ("semaine", "courses", "profil"):
        page.locator(f"nav button[data-k={onglet}]").click(); page.wait_for_timeout(300)
        large = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
        assert large[0] <= large[1] + 1, f"{onglet} : défilement horizontal {large}"
        page.screenshot(path=f"{OUT}/rt-mobile-{onglet}.png", full_page=False)
    page.locator("nav button[data-k=semaine]").click(); page.wait_for_timeout(200)
    assert page.locator(".resume-budget").count() == 1
    page.close()
    nav.close()
assert not erreurs, erreurs
print("OK retours de test")
