(() => {
  'use strict';
  // Scroll moments. Sideways: Work and Research pin in place while vertical scrolling slides their
  // cards horizontally, the statement's lines slide in opposite directions, and section titles glide
  // in from the left. Also: a page-progress line, the name shrinking away, the statement lighting up
  // word by word, rows fading up, numbers counting up, and paper figures taking on colour mid-screen.
  // Content stays fully visible without this script; reduced motion gets the finished state, and
  // narrow screens keep the normal vertical layout for the pinned sections.
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = window.matchMedia('(min-width: 901px)');
  const root = document.documentElement;
  root.classList.add('scroll-fx');
  if (calm) root.classList.add('calm');

  // Split each statement line into words so they can light up one by one.
  const statement = document.querySelector('.statement p');
  const lines = statement ? [...statement.querySelectorAll('.line')] : [];
  const words = [];
  lines.forEach(line => {
    line.innerHTML = line.textContent.trim().split(/\s+/).map(word => `<span class="word">${word}</span>`).join(' ');
    words.push(...line.querySelectorAll('.word'));
  });

  // Mark what should fade up on arrival.
  const reveal = [...document.querySelectorAll('.sec-head .sec-no, .sec-head p, .about-copy > *, .tl-date, .tl-card, .cites > *, .projects, .card-stage')];
  reveal.forEach(el => el.classList.add('reveal'));
  // Timeline cards swing in from whichever side of the line they sit on.
  document.querySelectorAll('.tl-item').forEach((item,i) => item.querySelector('.tl-card').classList.add(i % 2 ? 'from-right' : 'from-left'));

  // Numbers that count up the first time they're seen.
  const counters = [...document.querySelectorAll('.tl-stat strong, #cite-total')];
  function countUp(el) {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent));
    const match = node && node.textContent.match(/^(\D*)([\d,]*\.?\d+)(.*)$/);
    if (!match) return;
    const [,prefix,number,suffix] = match;
    const target = parseFloat(number.replace(/,/g,''));
    const decimals = (number.split('.')[1] || '').length;
    const format = v => number.includes(',') ? Number(v.toFixed(decimals)).toLocaleString('en-US') : v.toFixed(decimals);
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1,(now - start) / 1100);
      node.textContent = prefix + format(target * (1 - Math.pow(1 - t,3))) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if (calm) return;


  const seen = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    if (counters.includes(entry.target)) countUp(entry.target);
    seen.unobserve(entry.target);
  }),{ rootMargin: '0px 0px -12% 0px' });
  reveal.forEach(el => seen.observe(el));
  counters.forEach(el => seen.observe(el));

  // Paper figures take on colour in the middle of the screen. scholar.js re-renders the list,
  // so watch for new ones.
  const focus = new IntersectionObserver(entries => entries.forEach(entry =>
    entry.target.classList.toggle('in-focus',entry.isIntersecting)),{ rootMargin: '-25% -20% -25% -20%' });
  const watchPapers = () => {
    document.querySelectorAll('.pub').forEach(pub => {
      if (pub.dataset.watched) return;
      pub.dataset.watched = '1';
      pub.classList.add('reveal');
      seen.observe(pub);
      focus.observe(pub);
      pub.querySelectorAll('img').forEach(img => img.addEventListener('load',size,{ once: true }));
    });
    size();
  };

  // ---------- Pinned horizontal sections ----------
  // Each .hs is made as tall as its track is wide, so scrolling down through it maps to sliding
  // the track left while its sticky frame stays put under the header.
  const panels = [...document.querySelectorAll('.hs')].map(el => ({
    el, track: el.querySelector('.hs-track'), count: el.querySelector('.hs-count'), bar: el.querySelector('.hs-bar i'), distance: 0
  }));
  const header = () => document.querySelector('header.bar').offsetHeight;
  function size() {
    const on = wide.matches;
    root.classList.toggle('hs-on',on);
    panels.forEach(p => {
      if (!on) { p.el.style.height = ''; p.track.style.transform = ''; p.distance = 0; return; }
      p.distance = Math.max(0,p.track.scrollWidth - window.innerWidth);
      p.el.style.height = `${window.innerHeight - header() + p.distance}px`;
    });
    request();
  }

  // ---------- Scroll-scrubbed pieces, updated once per frame ----------
  const bar = document.querySelector('header.bar');
  const name = document.querySelector('.name-instrument');
  const cta = document.querySelector('.name-cta');
  const outro = document.querySelector('.outro-cta');
  const titles = [...document.querySelectorAll('.sec-head h2')];
  const timeline = document.querySelector('.tl');
  const nodes = timeline ? [...timeline.querySelectorAll('.tl-item')] : [];
  const clamp = v => Math.max(0,Math.min(1,v));
  let queued = false;

  function frame() {
    queued = false;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    bar.style.setProperty('--progress',max > 0 ? clamp(scrollY / max) : 0);

    // The name shrinks toward its top edge and dims as it leaves, without moving over the controls.
    const away = clamp(scrollY / (vh * .9));
    if (name) { name.style.transform = `scale(${1 - away * .1})`; name.style.opacity = 1 - away * .7; }
    if (cta) cta.style.opacity = 1 - clamp(scrollY / (vh * .35));

    // Statement: lines slide in opposite directions, and words light up first to last.
    if (statement) {
      const box = statement.getBoundingClientRect();
      const through = clamp((vh - box.top) / (vh + box.height));
      lines.forEach((line,i) => {
        const direction = i % 2 ? 1 : -1;
        line.style.transform = `translate3d(${(through - .5) * 18 * direction}vw,0,0)`;
      });
      const lit = clamp((vh * .82 - box.top) / (box.height + vh * .38));
      const count = Math.round(lit * words.length);
      words.forEach((word,i) => word.classList.toggle('lit',i < count));
    }

    // Section titles glide in from the left as they arrive.
    titles.forEach(title => {
      const arrive = clamp((vh - title.getBoundingClientRect().top) / (vh * .55));
      title.style.transform = `translate3d(${(1 - arrive) * -14}vw,0,0)`;
      title.style.opacity = .15 + arrive * .85;
    });

    // The timeline's centre line fills in as you read down it, lighting each node it passes.
    if (timeline) {
      const box = timeline.getBoundingClientRect(), line = vh * .6;
      timeline.style.setProperty('--tl',clamp((line - box.top) / box.height));
      nodes.forEach(item => item.classList.toggle('on',item.querySelector('.tl-node').getBoundingClientRect().top < line));
    }

    // Pinned sections: vertical progress through the section slides the track sideways.
    panels.forEach(p => {
      if (!p.distance) return;
      const progress = clamp((header() - p.el.getBoundingClientRect().top) / p.distance);
      p.track.style.transform = `translate3d(${-progress * p.distance}px,0,0)`;
      const cards = p.track.children.length;
      if (p.count) p.count.textContent = `${String(Math.min(cards,1 + Math.floor(progress * cards * .999))).padStart(2,'0')} / ${String(cards).padStart(2,'0')}`;
      if (p.bar) p.bar.style.transform = `scaleX(${progress})`;
    });

    // The closing line slides in from the left as it arrives.
    if (outro) {
      const arrive = clamp((vh - outro.getBoundingClientRect().top) / (vh * .45));
      outro.style.transform = `translate3d(${(1 - arrive) * -8}vw,0,0)`;
      outro.style.opacity = .35 + arrive * .65;
    }
  }
  function request() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

  watchPapers();
  const papers = document.getElementById('papers');
  if (papers) new MutationObserver(watchPapers).observe(papers,{ childList: true });
  addEventListener('scroll',request,{ passive: true });
  addEventListener('resize',size);
  wide.addEventListener('change',size);
  if (document.fonts) document.fonts.ready.then(size);
  addEventListener('load',size);
  size();
})();
