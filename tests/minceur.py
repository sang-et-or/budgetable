# Programme minceur : garde-fous, bilan, semaine selon les goûts, point hebdo, coach, arrêt
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
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    # goûts : on adore les pois chiches
    page.evaluate("""() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); d.profil.gouts = { ing: { pois_chiches: 2.5, fromage_blanc: 2 }, cuisine: {}, modele: {}, plat: {} }; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }""")
    page.reload()
    aller(page, 'minceur')
    assert "Programme minceur" in page.inner_text("main")
    choix = lambda cle, k: page.locator(f"[data-a=prog-choix][data-cle={cle}][data-k='{k}']").click()
    champ = lambda k, v: page.locator(f"[data-a=prog-champ][data-k={k}]").fill(v)
    choix("sexe", "f"); champ("age", "42"); champ("taille", "165"); champ("poids", "82"); champ("objectif", "70")
    choix("activite", "1.4"); choix("rythme", "normale")
    # garde-fou : trouble alimentaire → pas de programme
    choix("tca", "oui"); choix("grossesse", "non")
    assert "Prenons soin de vous" in page.inner_text("#prog-resultat") and page.locator("[data-a=prog-lancer]").count() == 0
    choix("tca", "non")
    champ("objectif", "45"); assert "trop bas" in page.inner_text("#prog-resultat")
    champ("objectif", "70")
    res = page.inner_text("#prog-resultat"); print(res.replace("\n", " ")[:200])
    assert "kcal" in res and page.locator("[data-a=prog-lancer]").is_disabled()
    page.locator("[data-a=prog-consent]").check()
    page.locator("[data-a=prog-lancer]").click()
    main = page.inner_text("main")
    assert "Mon programme minceur" in main and "Ma semaine, portion par portion" in main, main[:400]
    assert "pois chiches" in main.lower(), "le coach ne cite pas les goûts"
    d = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    pr = d["profil"]["programme"]; print("cible", pr["cible"], "coach", d["profil"]["coach"])
    pds = [g for jp in d["plan"]["jours"] for g in (jp.get("gourmand") or []) if g["moment"] == "petitdej"]
    assert len(pds) == 7 and pr["cible"] >= 1200
    page.screenshot(path=f"{OUT}/minceur.png", full_page=True)
    # point de la semaine : perte trop rapide + faim → repère remonté
    page.locator("[data-a=prog-pesee]").fill("80,5")
    page.locator("[data-a=prog-ressenti][data-k=faim]").click()
    page.locator("[data-a=prog-point]").click()
    txt = page.inner_text(".point-semaine"); assert "rapide" in txt and "faim" in txt, txt
    pr2 = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.programme")
    assert pr2["ajustement"] > 0 and pr2["semaine"] == 2 and pr2["pesees"][-1]["kg"] == 80.5
    page.get_by_role("button", name="Préparer ma semaine suivante").click()
    assert "Semaine 2" in page.inner_text("main")
    # coach (sans IA : réponses locales)
    page.locator("[data-a=coach-m-q]", has_text="Je vais au restaurant").click()
    assert "restaurant" in page.inner_text(".chat").lower() or "fête" in page.inner_text(".chat")
    page.fill("#coach-m-texte", "j'ai souvent faim l'après-midi"); page.keyboard.press("Enter")
    assert "collation" in page.inner_text(".chat").lower()
    # mobile : accès depuis Apports
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("nav button[data-k=semaine]").click()
    page.screenshot(path=f"{OUT}/minceur-mobile.png")
    # arrêt : données effacées
    page.set_viewport_size({"width": 1100, "height": 1000})
    aller(page, 'minceur')
    clic("Arrêter le programme"); clic("Confirmer : arrêter et effacer")
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.programme") is None
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("MINCEUR OK")
    nav.close()
