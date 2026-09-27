(() => {
  'use strict';
  // The 3D business card in the Contact section. Drag to spin it (it keeps coasting and slows
  // down), double-click or press Enter to flip it, arrow keys to turn it. A drag never counts as a
  // click, so links only open on a real tap. Until it's touched it floats gently.
  const stage = document.querySelector('.card-stage');
  if (!stage) return;
  const card = stage.querySelector('.card3d');
  const shadow = stage.querySelector('.card-shadow');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let rx = -8, ry = -22;          // current tilt (degrees)
  let vx = 0, vy = 0;             // coasting speed after a drag
  let touched = false;            // stop the idle float once someone interacts
  let flipTo = null;              // target angle while flipping
  let drag = null;
  let suppressClick = false;

  function render(time) {
    let x = rx, y = ry;
    if (!touched && !calm) {
      x += Math.sin(time / 1400) * 5;
      y += Math.sin(time / 1900) * 9;
    }
    card.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
    // Sheen slides across as the card turns; the shadow narrows when it's edge-on.
    const turn = ((y % 360) + 360) % 360;
    card.style.setProperty('--sheen',`${50 + Math.sin(turn * Math.PI / 180) * 60}%`);
    const face = Math.abs(Math.cos(turn * Math.PI / 180));
    shadow.style.transform = `translateX(-50%) scaleX(${.35 + face * .65})`;
    shadow.style.opacity = .35 + face * .4;
  }

  function loop(time) {
    if (!drag) {
      if (flipTo !== null) {
        ry += (flipTo - ry) * .12;
        if (Math.abs(flipTo - ry) < .2) { ry = flipTo; flipTo = null; }
      } else if (Math.abs(vx) + Math.abs(vy) > .02) {
        ry += vy; rx = Math.max(-70,Math.min(70,rx + vx));
        vx *= .94; vy *= .94;
      }
    }
    render(time);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  stage.addEventListener('pointerdown',event => {
    if (event.button !== 0) return;
    touched = true; flipTo = null; vx = vy = 0; suppressClick = false;
    drag = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, lastT: performance.now(), moved: false, id: event.pointerId };
  });
  stage.addEventListener('pointermove',event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x,event.clientY - drag.y) > 6) {
      drag.moved = true;
      // Capture only once it's clearly a drag, so plain clicks still reach the links.
      stage.setPointerCapture(event.pointerId);
      stage.classList.add('dragging');
    }
    if (!drag.moved) return;
    const dx = event.clientX - drag.lastX, dy = event.clientY - drag.lastY;
    const now = performance.now(), dt = Math.max(8,now - drag.lastT);
    ry += dx * .45;
    rx = Math.max(-70,Math.min(70,rx - dy * .35));
    vy = dx * .45 * (16 / dt); vx = -dy * .35 * (16 / dt);
    drag.lastX = event.clientX; drag.lastY = event.clientY; drag.lastT = now;
  });
  function endDrag(event) {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    suppressClick = drag.moved;
    if (!drag.moved) { vx = vy = 0; }
    drag = null;
    stage.classList.remove('dragging');
  }
  stage.addEventListener('pointerup',endDrag);
  stage.addEventListener('pointercancel',endDrag);
  // A drag that ends over a link shouldn't open it.
  stage.addEventListener('click',event => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
  },true);

  function flip() {
    touched = true; vx = vy = 0;
    const base = Math.round(ry / 180) * 180;
    flipTo = base + 180;
  }
  stage.addEventListener('dblclick',event => { if (!event.target.closest('a')) flip(); });
  stage.addEventListener('keydown',event => {
    if (event.target !== stage) return;
    const turns = { ArrowLeft: [0,-20], ArrowRight: [0,20], ArrowUp: [12,0], ArrowDown: [-12,0] };
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flip(); }
    else if (turns[event.key]) {
      event.preventDefault(); touched = true; flipTo = null; vx = vy = 0;
      rx = Math.max(-70,Math.min(70,rx + turns[event.key][0])); ry += turns[event.key][1];
    }
  });
})();
