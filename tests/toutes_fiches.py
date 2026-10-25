# Toutes les fiches de la semaine s'ouvrent (semaine qui démarre n'importe quel jour, gamelles, restes, minceur, enfants)
import re, json
from playwright.sync_api import sync_playwright
erreurs = []
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
    base = page.evaluate("localStorage.getItem('budgetable.v1')")
    PROG = "{ debut: '2026-10-20', sexe: 'f', age: 35, taille: 165, poidsDepart: 75, poidsActuel: 74, objectif: 65, activite: 'moderee', rythme: 'doux', personnes: 1, ajustement: 0, pesees: [], bilans: [], semaine: 1 }"
    total = 0
    for debut in range(7):   # semaine démarrée chaque jour de la semaine
        page.evaluate("(b) => localStorage.setItem('budgetable.v1', b)", base)
        page.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('budgetable.v1'));
          const t = new Date(); const delta = ((t.getDay() + 6) % 7 - {debut} + 7) % 7; t.setDate(t.getDate() - delta); d.planDu = t.toISOString().slice(0, 10);
          d.profil.gamelles = {{ n: 2, jours: [0, 1, 2, 3, 4, 5, 6], mode: 'restes' }};
          d.profil.consentementSante = true; d.profil.foyer.enfants = [{{ age: 7 }}]; d.profil.programme = {PROG};
          d.plan.jours.forEach((jp) => {{ if (jp.diner) jp.diner.restes = {{ vers: 'dejeuner', n: 2 }}; }});
          localStorage.setItem('budgetable.v1', JSON.stringify(d)); }}""")
        page.reload(); page.wait_for_timeout(400)
        for j in range(7):
            for slot in ("dejeuner", "diner"):
                ok = page.evaluate(f"""() => {{ const b = document.createElement('button'); b.dataset.a = 'fiche'; b.dataset.j = '{j}'; b.dataset.s = '{slot}'; document.body.appendChild(b); b.click(); b.remove(); return true; }}""")
                page.wait_for_timeout(120)
                txt = page.inner_text("body")
                vide = page.evaluate(f"!JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours[{j}].{slot}")
                if not vide:
                    total += 1
                    assert "n’a pas pu" not in txt and "Oups" not in txt, (debut, j, slot, txt[txt.find('Détail'):][:300])
                f = page.locator(".voile [data-a=fermer], .voile [data-a=fermer-erreur]").first
                if f.count(): f.click(); page.wait_for_timeout(80)
    nav.close()
assert not erreurs, erreurs[:3]
print(f"TOUTES FICHES OK ({total} fiches ouvertes)")
