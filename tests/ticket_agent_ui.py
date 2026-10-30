# Ticket lu par l'agent du serveur (simulé) : photo, PDF et texte collé ; id du catalogue, nom décodé, remises, vérification
import sys, re, json, base64
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
REP = {"enseigne": "CARREFOUR", "date": "2026-10-24", "total": 12.1, "remisesGlobales": 1, "essais": 2, "verifie": True, "texte": "COQUIL 500G 0,95\n...",
       "lignes": [
         {"libelle": "COQUIL 500G", "nom": "Coquillettes 500 g", "id": "pates", "categorie": "alimentaire", "qte": 1, "prix": 0.95, "remise": 0, "doute": False},
         {"libelle": "LT 1/2 ECR UHT 6X1L", "nom": "Lait demi-écrémé 6 x 1 L", "id": "lait", "categorie": "boisson", "qte": 1, "prix": 5.4, "remise": 0.5, "doute": False},
         {"libelle": "EMMENT RAP 200G", "nom": "Emmental râpé 200 g", "id": None, "categorie": "alimentaire", "qte": 1, "prix": 2.5, "remise": 0, "doute": True},
         {"libelle": "ARIEL PODS X20", "nom": "Lessive en capsules", "id": "lait", "categorie": "maison", "qte": 1, "prix": 4.25, "remise": 0, "doute": False}]}
recus = []
def ticket(route):
    req = route.request
    if req.method == "POST": recus.append(json.loads(req.post_data))
    route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(REP))
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1100, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/ia/etat", lambda r: r.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body='{"disponible":true,"vision":true,"ticket":true,"pdf":true}'))
    page.route("https://budgetable-recettes.onrender.com/ticket", ticket)
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort() if "/ticket" not in r.request.url and "/ia/etat" not in r.request.url else r.fallback())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button[data-k=courses]").click()
    f = page.locator(".fenetre-ticket")
    def ouvrir():
        page.locator(".bloc-tickets [data-a=ticket-ouvrir]").click()
    def verifier(src):
        f.locator(".ligne-ticket").first.wait_for(timeout=10000)
        assert f.locator(".ligne-ticket").count() == 4, src
        prod = f.locator(".produit-ticket").all_inner_texts(); print(src, prod)
        assert "Pâtes" in prod[0] and "Lait" in prod[1], prod
        assert "Emmental" in prod[2], "rattaché par le nom décodé"
        assert "Choisir" in prod[3] and f.locator(".ligne-ticket").nth(3).get_attribute("class").find("ignoree") >= 0, "lessive ignorée, jamais du lait"
        txt = f.inner_text()
        assert "Coquillettes 500 g" in txt and "remise 0,50" in txt and "à vérifier" in txt
        assert "vérifié par l’assistant" in txt and "remises de 1,00" in txt, txt[-900:]
    # 1. photo
    ouvrir()
    png = "/tmp/claude-0/t.png"
    page.evaluate("""() => { const c=document.createElement('canvas'); c.width=300; c.height=600; const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,300,600); g.fillStyle='#000'; g.fillText('COQUIL 500G 0,95',10,20); return c.toDataURL('image/png'); }""")
    import struct, zlib
    def png_blanc(w, h):
        raw = b"".join(b"\x00" + b"\xff" * w * 3 for _ in range(h))
        ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
        return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
    open(png, "wb").write(png_blanc(200, 500))
    f.locator("input[data-a=ticket-photo]").set_input_files(png)
    verifier("photo")
    assert recus[-1]["image"].startswith("data:image/jpeg;base64,")
    assert f.locator("[data-a=ticket-enseigne][data-k=carrefour][aria-pressed=true]").count() == 1
    f.screenshot(path=f"{OUT}/ticket-agent.png")
    page.locator(".fenetre-ticket [data-a=ticket-fermer]").click()
    # 2. PDF du drive
    ouvrir()
    pdf = "/tmp/claude-0/c.pdf"; open(pdf, "wb").write(b"%PDF-1.4\n%fake\n")
    f.locator("input[data-a=ticket-fichier]").set_input_files(pdf)
    verifier("pdf")
    assert recus[-1]["pdf"].startswith("data:application/pdf;base64,") and "image" not in recus[-1]
    assert f.locator("[data-a=ticket-type][data-k=drive][aria-checked=true]").count() == 1
    page.locator(".fenetre-ticket [data-a=ticket-fermer]").click()
    # 3. texte collé
    ouvrir()
    f.locator("[data-a=ticket-coller]").click(); page.fill("#ticket-texte", "CARREFOUR\nCOQUIL 500G 0,95\nTOTAL 12,10")
    f.locator("[data-a=ticket-analyser]").click()
    verifier("texte")
    assert recus[-1]["texte"].startswith("CARREFOUR")
    # 4. sans assistant : la lecture sur l'appareil reprend la main
    page.unroute("https://budgetable-recettes.onrender.com/ia/etat")
    page.route("https://budgetable-recettes.onrender.com/ia/etat", lambda r: r.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body='{"disponible":false,"vision":false}'))
    page.locator(".fenetre-ticket [data-a=ticket-fermer]").click(); ouvrir()
    f.locator("[data-a=ticket-coller]").click(); page.fill("#ticket-texte", "LIDL\nCOQUILLETTES 500G 0,59\nTOTAL 0,59")
    f.locator("[data-a=ticket-analyser]").click()
    f.locator(".ligne-ticket").first.wait_for(timeout=5000)
    assert f.locator(".ligne-ticket").count() == 1 and len(recus) == 3
    nav.close()
assert not erreurs, erreurs
print("OK agent ticket : photo, PDF, texte, repli local")
