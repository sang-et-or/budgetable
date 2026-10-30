# Ticket dématérialisé en PDF, sans assistant : texte exact lu sur l'appareil (pdf.js simulé, positions des textes comme un vrai PDF)
import sys, re, json
from playwright.sync_api import sync_playwright
# facture de drive : colonnes Désignation / Qté / Prix unitaire / Montant, sur deux pages
P1 = [("Carrefour Drive - Votre commande", 40, 60), ("Désignation", 40, 120), ("Qté", 330, 120), ("Prix unit.", 400, 120), ("Montant", 500, 120),
      ("Coquillettes 500 g", 40, 150), ("2", 330, 150), ("0,95 €", 400, 150), ("1,90 €", 500, 150),
      ("Lait demi-écrémé UHT 6x1 L", 40, 175), ("1", 330, 175), ("5,94 €", 400, 175), ("5,94 €", 500, 175),
      ("Emmental râpé 200 g", 40, 200), ("1", 330, 200), ("2,10 €", 400, 200), ("2,10 €", 500, 200)]
P2 = [("Lessive liquide 2 L", 40, 60), ("1", 330, 60), ("6,99 €", 400, 60), ("6,99 €", 500, 60),
      ("Total TTC", 40, 120), ("16,93 €", 500, 120), ("Payé par carte bancaire", 40, 150), ("16,93 €", 500, 150)]
pages = [[{"str": s, "transform": [11, 0, 0, 11, x, 842 - y], "width": len(s) * 5.5} for s, x, y in p] for p in (P1, P2)]
MOCK = "window.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async(n)=>({getViewport:()=>({width:595,height:842}),getTextContent:async()=>({items:" + json.dumps(pages) + "[n-1]})})})})};"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1100, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.route("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/**", lambda r: r.fulfill(status=200, content_type="application/javascript", body=MOCK))
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button[data-k=courses]").click()
    page.locator(".bloc-tickets [data-a=ticket-ouvrir]").click()
    f = page.locator(".fenetre-ticket")
    pdf = "/tmp/claude-0/drive.pdf"; open(pdf, "wb").write(b"%PDF-1.4\n%fake\n")
    f.locator("input[data-a=ticket-fichier]").set_input_files(pdf)
    f.locator(".ligne-ticket").first.wait_for(timeout=10000)
    lib = f.locator("input[data-a=ticket-libelle]").evaluate_all("l => l.map(x => x.value)")
    prix = f.locator("input[data-a=ticket-prix]").evaluate_all("l => l.map(x => x.value)"); print(lib, prix)
    assert prix == ["1,9", "5,94", "2,1", "6,99"], prix
    assert lib == ["Coquillettes 500g", "Lait demi-écrémé UHT 6x1 L", "Emmental râpé 200g", "Lessive liquide 2L"], lib
    assert "2 × 0,95" in f.inner_text()
    assert "correspond au total du ticket (16,93" in f.inner_text()
    assert f.locator("[data-a=ticket-enseigne][data-k=carrefour][aria-pressed=true]").count() == 1
    assert f.locator("[data-a=ticket-type][data-k=drive][aria-checked=true]").count() == 1
    nav.close()
assert not erreurs, erreurs
print("PDF SUR L'APPAREIL OK")
