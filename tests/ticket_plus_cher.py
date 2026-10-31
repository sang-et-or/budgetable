# Scan du ticket : résumé des produits payés plus cher (que l'estimation, et que la dernière fois dans ce magasin)
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
def ticket(poulet, date):
    return f"LIDL\nFILETS POULET 1KG          {poulet} A\nCOQUILLETTES 500G           0,59 A\nCB\n{date} 18:42"
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
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button[data-k=courses]").click()
    ref = page.evaluate("Engine.prixReference('poulet_filet')")
    def scanner(texte):
        page.locator(".bloc-tickets [data-a=ticket-ouvrir]").click()
        f = page.locator(".fenetre-ticket")
        f.locator("[data-a=ticket-coller]").click(); page.fill("#ticket-texte", texte)
        f.locator("[data-a=ticket-analyser]").click(); f.locator(".ligne-ticket").first.wait_for(timeout=10000)
        return f
    # 1er ticket : poulet 14,90 € le kilo, estimé ~10,90 €
    f = scanner(ticket("14,90", "20/10/2026"))
    apercu = f.locator(".plus-chers").inner_text()
    assert "Plus cher que prévu" in apercu and "Filets de poulet" in apercu and "14,90" in apercu and "estimé" in apercu, apercu
    assert "Pâtes" not in apercu and "Coquillettes" not in apercu, "les coquillettes ne sont pas plus chères"
    f.locator("[data-a=ticket-enregistrer]").click()
    fin = f.locator(".plus-chers").inner_text()
    assert "Filets de poulet" in fin and "+4" in fin, fin      # 14,90 − 10,90 = +4,00 €
    f.screenshot(path=f"{OUT}/ticket_plus_cher.png")
    f.locator("[data-a=ticket-fermer]").first.click()
    t = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).tickets[0]")
    assert t["plusChers"] and t["plusChers"][0][0].startswith("Filets de poulet"), t
    # 2e ticket, même magasin : poulet encore plus cher que la dernière fois
    f = scanner(ticket("15,90", "27/10/2026"))
    apercu = f.locator(".plus-chers").inner_text()
    assert "la dernière fois" in apercu and "14,90" in apercu, apercu
    f.locator("[data-a=ticket-enregistrer]").click()
    nav.close()
assert not erreurs, erreurs
print("OK produits plus chers", ref)
