(() => {
  'use strict';
  // Project carousel after the papers, as a ring: the current project sits in the middle and the
  // others peek in from both sides, smaller and dimmed. It loops in either direction. Arrows,
  // arrow keys, swipes, or clicking a side project bring it to the middle. Only the middle
  // project's video plays (muted, with controls), and only while the carousel is on screen.
  const root = document.getElementById('projects');
  if (!root) return;
  const slides = [...root.querySelectorAll('.proj')];
  const count = root.querySelector('.proj-count');
  const viewport = root.querySelector('.proj-viewport');
  const videos = slides.map(slide => slide.querySelector('video'));
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0, visible = false;
  const offsets = slides.map(() => null);

  function sync() {
    videos.forEach((video,i) => {
      // People who ask for reduced motion start videos themselves.
      if (i === index && visible && !calm) video.play().catch(() => {});
      else video.pause();
    });
  }

  // Where slide i sits relative to the middle: 0 = centre, -1 = left, +1 = right, and so on.
  function offsetOf(i) {
    const n = slides.length;
    let offset = ((i - index) % n + n) % n;
    if (offset > n / 2) offset -= n;
    return offset;
  }

  function place(slide,offset) {
    const gap = window.innerWidth < 650 ? 12 : 28;
    slide.style.transform = `translate3d(calc(${offset * 100}% + ${offset * gap}px),0,0) scale(${offset ? .86 : 1})`;
    slide.style.opacity = offset === 0 ? 1 : Math.abs(offset) === 1 ? .38 : 0;
    slide.style.zIndex = String(10 - Math.abs(offset));
  }

  function go(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide,i) => {
      const offset = offsetOf(i), previous = offsets[i];
      const side = offset !== 0;
      slide.classList.toggle('side',side);
      slide.setAttribute('aria-hidden',String(side));
      [...slide.children].forEach(child => child.toggleAttribute('inert',side));
      // A slide wrapping from one side to the other jumps there invisibly, then fades in,
      // instead of sliding across the middle.
      if (previous !== null && Math.abs(offset - previous) > 1) {
        slide.style.transition = 'none';
        place(slide,offset); slide.style.opacity = 0;
        slide.getBoundingClientRect();
        slide.style.transition = '';
        // Read the position when the frame runs, in case another click moved things since.
        requestAnimationFrame(() => place(slide,offsets[i]));
      } else place(slide,offset);
      offsets[i] = offset;
    });
    count.textContent = `${String(index + 1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;
    if (videos[index].preload === 'none') videos[index].preload = 'metadata';
    sync();
  }

  root.querySelector('.proj-prev').addEventListener('click',() => go(index - 1));
  root.querySelector('.proj-next').addEventListener('click',() => go(index + 1));
  slides.forEach((slide,i) => slide.addEventListener('click',() => { if (i !== index) go(i); }));
  viewport.addEventListener('keydown',event => {
    if (event.target !== viewport) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1); }
  });

  // Swipe or drag sideways to rotate; vertical swipes still scroll the page.
  let start = null, swiped = false;
  viewport.addEventListener('pointerdown',event => {
    if (event.target.closest('video, a')) return;
    start = { x: event.clientX, y: event.clientY };
  });
  viewport.addEventListener('pointerup',event => {
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    start = null;
    swiped = Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy);
    if (swiped) go(index + (dx < 0 ? 1 : -1));
  });
  viewport.addEventListener('pointercancel',() => { start = null; });
  // A swipe that ends on a side project shouldn't also count as clicking it.
  viewport.addEventListener('click',event => { if (swiped) { event.stopPropagation(); swiped = false; } },true);

  addEventListener('resize',() => slides.forEach((slide,i) => place(slide,offsets[i])));
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); },{ threshold: .35 }).observe(viewport);
  go(0);
})();
