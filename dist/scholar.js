(() => {
  'use strict';
  // Research section, drawn from data/research.json: a snapshot of the Google Scholar profile.
  // Scholar has no API and can't be called from the browser, so there are no live requests;
  // refresh the snapshot with update-scholar.py and redeploy.
  // Hand-written details for known papers, matched by title. A paper that isn't listed here
  // still appears, with its Scholar title and venue and a plain placeholder figure.
  const CURATED = [
    {
      match: 'procedural scene programs for open universe',
      title: 'Procedural Scene Programs for Open-Universe Scene Generation: LLM-Free Error Correction via Program Search',
      venue: 'ACM SIGGRAPH Asia 2025', role: 'Second author', order: 1,
      link: 'https://dl.acm.org/doi/10.1145/3757377.3763930', code: 'https://github.com/mxgmn/ImperativeScene',
      image: 'images/papers/procedural-scene-programs.jpg',
      alt: 'A generated low-poly forest clearing with trees, rocks and logs',
      summary: 'Instead of having an LLM write constraints for a solver, we let it place objects one by one in code, then repair collisions with an LLM-free search over the program. In perceptual studies, people preferred these layouts 82% and 94% of the time over two leading declarative methods.'
    },
    {
      match: 'imperative vs declarative programming paradigms',
      title: 'Imperative vs. Declarative Programming Paradigms for Open-Universe Scene Generation',
      venue: 'arXiv · 2025', role: 'Second author', order: 2,
      link: 'https://arxiv.org/abs/2504.05482',
      image: 'images/papers/imperative-vs-declarative.jpg', fit: 'contain',
      alt: 'Side-by-side code for the imperative and declarative versions of a garage layout, with the resulting 3D garage between them',
      summary: 'The preprint that framed the question: should an LLM describe a room as constraints for a solver, or as step-by-step placement code? It argues for code, adds an error-correction pass that edits the program directly, and proposes an automatic layout metric that tracks human judgment.'
    },
    {
      match: 'open universe indoor scene generation using llm',
      title: 'Open-Universe Indoor Scene Generation using LLM Program Synthesis and Uncurated Object Databases',
      venue: 'arXiv · 2024', role: 'Co-first author', order: 3,
      link: 'https://arxiv.org/abs/2403.09675',
      image: 'images/papers/open-universe.jpg',
      alt: 'A generated witch’s room with a large cauldron, a lectern and shelves of jars',
      summary: 'Generates 3D rooms from any text prompt with no 3D training data: an LLM writes a layout program, an optimizer solves it, and a vision-language model finds matching furniture in huge, unlabeled mesh databases.'
    }
  ];

  const root = document.getElementById('research-live');
  if (!root) return;
  const el = id => document.getElementById(id);
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const month = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  function render(data) {
    const papers = data.papers.map(p => {
      const curated = CURATED.find(c => normalize(p.title).startsWith(c.match));
      return { ...p, ...(curated || {}), citations: p.citations };
    }).sort((a,b) => (a.order || 99) - (b.order || 99) || (b.year || 0) - (a.year || 0));
    el('cite-total').textContent = data.citations;
    if (data.profile) document.querySelector('.cites-stat').href = data.profile;
    el('cite-source').textContent = `Google Scholar · ${month(data.updated)}`;

    const years = Object.entries(data.perYear).map(([y,n]) => [Number(y),n]).sort((a,b) => a[0] - b[0]);
    const max = Math.max(1,...years.map(([,n]) => n));
    el('cite-bars').innerHTML = years.map(([y,n]) =>
      `<div class="cbar" tabindex="0" data-tip="${y} · ${n} citation${n === 1 ? '' : 's'}"><span class="cbar-fill" style="height:${n / max * 100}%">` +
      `${n === max && n > 0 ? `<b class="cbar-value">${n}</b>` : ''}</span><span class="cbar-year">${y}</span></div>`).join('');
    el('cite-table').innerHTML = `<caption>Citations per year</caption><tr><th scope="col">Year</th><th scope="col">Citations</th></tr>` +
      years.map(([y,n]) => `<tr><td>${y}</td><td>${n}</td></tr>`).join('');

    el('papers').innerHTML = papers.map((p,i) => {
      const link = p.link || p.scholarUrl;
      const figure = p.image
        ? `<img src="${escape(p.image)}" alt="${escape(p.alt || '')}" loading="lazy"${p.fit === 'contain' ? ' class="fit"' : ''}>`
        : `<span class="pub-noimg" aria-hidden="true">${escape(p.year || '')}</span>`;
      return `<article class="pub">
        <a class="pub-fig" href="${escape(link)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">${figure}<span class="pub-no">${String(i + 1).padStart(2,'0')}</span></a>
        <div class="pub-body">
          <div class="pub-meta"><span class="p-venue">${escape(p.venue || p.year)}</span>${p.role ? `<span>${escape(p.role)}</span>` : ''}<span class="pub-cites">Cited by ${p.citations}</span></div>
          <h3><a href="${escape(link)}" target="_blank" rel="noopener noreferrer">${escape(p.title)}</a></h3>
          ${p.summary ? `<p class="pub-sum"><span>Summary</span>${escape(p.summary)}</p>` : ''}
          <div class="pub-links"><a class="pub-link" href="${escape(link)}" target="_blank" rel="noopener noreferrer">Read the paper <span aria-hidden="true">↗</span></a>${p.code ? `<a class="pub-link" href="${escape(p.code)}" target="_blank" rel="noopener noreferrer">Research code <span aria-hidden="true">↗</span></a>` : ''}</div>
        </div>
      </article>`;
    }).join('');
  }

  // Tooltip for the bars (hover and keyboard focus).
  const tip = el('cite-tip');
  const bars = el('cite-bars');
  function showTip(bar) {
    if (!bar) return;
    tip.textContent = bar.dataset.tip;
    const box = bar.getBoundingClientRect(), frame = tip.closest('figure').getBoundingClientRect();
    const fill = bar.querySelector('.cbar-fill').getBoundingClientRect();
    tip.style.left = `${box.left - frame.left + box.width / 2}px`;
    tip.style.top = `${Math.min(fill.top,box.bottom - 20) - frame.top}px`;
    tip.hidden = false;
  }
  bars.addEventListener('pointerover',e => showTip(e.target.closest('.cbar')));
  bars.addEventListener('focusin',e => showTip(e.target.closest('.cbar')));
  bars.addEventListener('pointerleave',() => { tip.hidden = true; });
  bars.addEventListener('focusout',() => { tip.hidden = true; });

  fetch('data/research.json').then(r => r.ok ? r.json() : Promise.reject()).then(render).catch(() => {});
})();
