# Photo d'un ticket penché : dans la page, la photo est redressée avant la lecture (Tesseract simulé, qui note ce qu'il reçoit)
import sys, re, json
from playwright.sync_api import sync_playwright
TEXTE = "LIDL\nPATES 0,95 A\nTOMATES PELEES 400G 8,79 A\nRIZ 2,29 A\nTOTAL A PAYER 4,03\nCB 4,03"
# mots avec leur position (une ligne tous les 60 px) ; « RIZ » lu avec peu de confiance
LIGNES = [["LIDL"], ["PATES", "0,95", "A"], ["TOMATES", "PELEES", "400G", "8,79", "A"], ["RIZ", "2,29", "A"], ["TOTAL", "A", "PAYER", "4,03"], ["CB", "4,03"]]
BLOCS = [{"paragraphs": [{"lines": [{"words": [{"text": w, "confidence": 40 if w == "RIZ" else 93, "bbox": {"x0": 40 + 130 * j, "x1": 150 + 130 * j, "y0": 200 + 60 * i, "y1": 236 + 60 * i}} for j, w in enumerate(l)]} for i, l in enumerate(LIGNES)]}]}]
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1100, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.route("**/tesseract.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body="window.__vu=[];window.Tesseract={createWorker:async()=>({setParameters:async()=>{},terminate:async()=>{},recognize:async(c)=>{window.__vu.push([c.width,c.height]);return {data:{blocks:c.width>800?" + json.dumps(BLOCS) + ":[],text:" + json.dumps(TEXTE) + "}}}})};"))
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button[data-k=courses]").click()
    page.locator(".bloc-tickets [data-a=ticket-ouvrir]").click()
    f = page.locator(".fenetre-ticket")
    assert page.evaluate("typeof window.TicketImage.pretraiter") == "function"
    f.locator("input[data-a=ticket-photo]").set_input_files("tests/fixtures/ticket-penche.jpg")
    f.locator(".ligne-ticket").first.wait_for(timeout=20000)
    vu = page.evaluate("window.__vu"); print("images lues :", vu)
    assert vu[0][0] != 544 and vu[0][1] > 1500, "le ticket redressé et agrandi est lu, pas la photo brute"
    prix = f.locator("input[data-a=ticket-prix]").evaluate_all("l => l.map(x => x.value)"); print("prix :", prix)
    assert prix == ["0,95", "0,79", "2,29"], "8,79 corrigé en 0,79 grâce au total"
    assert "correspond au total" in f.inner_text()
    assert f.locator(".extrait-ticket").count() == 3, "un extrait de photo par article"
    assert f.locator(".ligne-ticket.a-verifier").count() == 2, "8,79 corrigé et RIZ peu sûr : à vérifier"
    f.screenshot(path="/tmp/claude-0/verif.png")
    f.locator("[data-a=ticket-seul-verif]").click()
    assert f.locator(".ligne-ticket").count() == 2
    f.locator("[data-a=ticket-ligne-ok]").first.click()
    assert f.locator(".ligne-ticket.a-verifier").count() == 1
    nav.close()
assert not erreurs, erreurs
print("PRETRAITEMENT OK")
