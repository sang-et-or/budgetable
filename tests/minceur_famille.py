# Programme minceur avec enfants : même plat, assiette de l'adulte adaptée, enfants en assiette complète, courses ajustées
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
    page.evaluate("""() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); d.profil.foyer = { adultes: 2, enfants: ['6-10', '11-14'] }; d.profil.dejeuners = { mode: 'maison', adultesMaison: 2, enfantsMaison: 'oui' }; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }""")
    page.reload()
    aller(page, 'minceur')
    choix = lambda cle, k: page.locator(f"[data-a=prog-choix][data-cle={cle}][data-k='{k}']").click()
    champ = lambda k, v: page.locator(f"[data-a=prog-champ][data-k={k}]").fill(v)
    choix("sexe", "f"); champ("age", "40"); champ("taille", "165"); champ("poids", "80"); champ("objectif", "70")
    choix("activite", "1.4"); choix("personnes", "1"); choix("rythme", "douce"); choix("tca", "non"); choix("grossesse", "non")
    assert "assiette complète" in page.inner_text("main")
    page.locator("[data-a=prog-consent]").click(); page.locator("[data-a=prog-lancer]").click()
    main = page.inner_text("main")
    assert "Enfants : assiette complète" in main and "Vous : ½" in main, main[:800]
    assert "les enfants gardent" in page.inner_text(".message-coach").lower()
    page.locator(".jours-minceur").screenshot(path=f"{OUT}/minceur-famille.png")
    # courses : moins de féculents et plus de légumes qu'avec la même semaine sans programme, pain pour les enfants si besoin
    r = page.evaluate("""() => {
      const E = window.Engine, d = JSON.parse(localStorage.getItem('budgetable.v1'));
      const avec = E.listeCourses(d.plan, d.profil), sans = E.listeCourses(d.plan, { ...d.profil, programme: null });
      const q = (l, f) => l.articles.filter((a) => f(E.ING[a.id])).reduce((t, a) => t + (E.ING[a.id].unite === 'g' ? a.quantite : 0), 0);
      const sansFec = d.plan.jours.flatMap((jp) => [jp.dejeuner, jp.diner]).filter((m) => m && E.REC[m.recette] && !E.assietteMinceur(E.REC[m.recette]).feculent).length;
      const pain = (l) => (l.articles.find((a) => a.id === 'pain') || { quantite: 0 }).quantite;
      return { fecAvec: q(avec, (i) => i.groupe === 'F'), fecSans: q(sans, (i) => i.groupe === 'F'), legAvec: q(avec, (i) => i.groupe === 'L'), legSans: q(sans, (i) => i.groupe === 'L'), sansFec, painAvec: pain(avec), painSans: pain(sans) };
    }""")
    print(r)
    assert r["fecAvec"] < r["fecSans"] and r["legAvec"] > r["legSans"]
    if r["sansFec"]: assert r["painAvec"] > r["painSans"]
    # fiche d'un repas : bloc « Votre assiette minceur »
    page.locator("nav button[data-k=semaine]").click()
    page.locator("main .titre-repas").first.click()
    t = page.inner_text(".fiche")
    assert "Votre assiette minceur" in t and "assiette complète" in t, t[:600]
    page.locator(".assiette-minceur").screenshot(path=f"{OUT}/assiette-minceur.png")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("MINCEUR FAMILLE OK")
    nav.close()
