(function () {
  const D = window.BudgetableDrives, S = window.BudgetableStockage, C = window.BudgetableComparaison;
  const $ = (id) => document.getElementById(id);
  const euros = (n) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nomDrive = (id) => (D.DRIVES.find((d) => d.id === id) || { nom: id }).nom;

  async function afficher() {
    const liste = await S.lire('liste', null);
    const releves = await S.lire('releves', {});
    $('etat-liste').textContent = liste ? `${liste.articles.length} articles, liste du ${liste.date || '?'}.` : 'Aucune liste.';
    $('drives').innerHTML = D.DRIVES.map((d) => `<a href="https://${d.hotes[0] || ''}" target="_blank" rel="noopener">${esc(d.nom)}${d.verifie ? '' : ' (non vérifié)'}</a>`).join(' · ');
    if (!liste || !Object.keys(releves).length) { $('comparaison').textContent = 'Relevez des prix dans au moins un drive pour voir la répartition.'; return; }
    const r = C.repartir(liste, releves);
    let h = '';
    if (r.comparaison && Object.keys(releves).length > 1) {
      h += `<div class="eco">En répartissant vos ${r.comparaison.nbArticles} articles relevés partout : <strong>${euros(r.comparaison.reparti)}</strong><br>
        Tout chez ${esc(nomDrive(r.comparaison.meilleurSeul.d))} : ${euros(r.comparaison.meilleurSeul.total)}<br>
        Économie : <strong>${euros(Math.max(0, r.comparaison.economie))}</strong></div>`;
    }
    for (const [d, p] of Object.entries(r.paniers)) {
      h += `<div class="carte"><div class="total"><span>Panier ${esc(nomDrive(d))}</span><span>${euros(p.total)}</span></div>
        <ul>${p.articles.map((a) => `<li>${esc(a.nom)} : ${euros(a.cout)}</li>`).join('')}</ul></div>`;
    }
    h += `<div class="total"><span>Total tous paniers</span><span>${euros(r.totalReparti)}</span></div>`;
    if (r.sansPrix.length) h += `<p class="petit">Sans prix relevé : ${esc(r.sansPrix.join(', '))}.</p>`;
    h += `<p class="petit">Prix relevés par vous, sur les pages que vous avez consultées. Frais de retrait et trajets non comptés.</p>`;
    $('comparaison').innerHTML = h;
  }

  $('enregistrer').addEventListener('click', async () => {
    try {
      const liste = S.lireExport($('colle').value);
      await S.ecrire('liste', liste);
      await S.ecrire('courant', 0);
      $('colle').value = '';
      $('msg').className = 'msg';
      $('msg').textContent = `Liste enregistrée : ${liste.articles.length} articles.`;
      afficher();
    } catch (e) {
      $('msg').className = 'msg err';
      $('msg').textContent = e.message || 'Liste illisible.';
    }
  });
  $('effacer').addEventListener('click', async () => { await S.ecrire('releves', {}); await S.ecrire('ajoutes', {}); afficher(); });
  afficher();
})();
