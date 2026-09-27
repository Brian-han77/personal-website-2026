(() => {
  'use strict';
  document.getElementById('year').textContent = new Date().getFullYear();
  const buttons = [...document.querySelectorAll('.note-key')];
  const keys = ['a','s','d','f','g','h','j','k','l'];
  const names = ['Low E','F♯','G','A','B♭','Kick','Snare','Crash','High E'];
  // Recorded guitar notes low to high across the name, with MuldjordKit drums (DrumGizmo.org, via FreePats) on H, J and K.
  const samples = ['E_LOW','F_SHARP','G','A','B_FLAT','E_HIGH'];
  const guitarVoices = ['E_LOW','F_SHARP','G','A','B_FLAT',null,null,null,'E_HIGH'];
  const drumVoices = { 5: ['kick',.5], 6: ['snare',.45], 7: ['crash',.32] };
  const sampleOffsets = { E_HIGH: .045 };
  // Enter Sandman at 123 bpm, rhythm from Hetfield's part: the riff twice, then the turnaround.
  // Each entry is [note, beats until the next note, beats to hold (omit to ring until the next note)].
  // The first E and the turnaround's G are pushed half a beat early, onto the "and" of four, and
  // ring through the downbeat. The A is a quarter note (the palm-muted E chugs after it are left out).
  const score = [
    [0,1], [0,.5], [8,.5], [4,.5], [3,1.5,1],
    [0,1], [0,.5], [8,.5], [4,.5], [3,1.5,1],
    [2,1], [0,.5], [1,.5], [0,.5], [1,.5], [2,.5], [1,.5], [0,2,2]
  ];
  const melody = score.map(([note]) => note);
  // Lars's groove under it, in beats from the first note (bars start on the half beat after the pickup):
  // crash on the first downbeat, kick on 1 and 3, snare on 2 and 4, crash and kick with the final E.
  const drumScore = [[.5,7],[.5,5],[1.5,6],[2.5,5],[3.5,6],[4.5,5],[5.5,6],[6.5,5],[7.5,6],
    [8.5,5],[9.5,6],[10.5,5],[11.5,6],[12,7],[12,5]];
  const beat = 60 / 123;
  const listen = document.getElementById('listen');
  const mute = document.getElementById('mute');
  const status = document.getElementById('music-status');
  const progress = document.getElementById('score-progress');
  let context, master, sampleLoad, voice = null, hits = new Set(), held = new Map(), down = new Set(), cursor = 0, playing = false, muted = false, timer = null, run = 0;
  const visuals = new Set();
  const guitarBuffers = new Map();
  const flashes = new Map();
  async function loadGuitarSamples() {
    if (sampleLoad) return sampleLoad;
    status.textContent = 'Loading guitar…';
    const files = [...samples.map(note => [note,`audio/my_guitar/${note}.wav`]),
      ...Object.values(drumVoices).map(([drum]) => [drum,`audio/drums/${drum}.mp3`])];
    sampleLoad = Promise.all(files.map(async ([note,url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Guitar sample unavailable: ${note}`);
      guitarBuffers.set(note, await context.decodeAudioData(await response.arrayBuffer()));
    }));
    return sampleLoad;
  }
  async function audioReady() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { status.textContent = 'Audio is unavailable in this browser.'; return false; }
    if (!context) {
      context = new Audio();
      master = context.createGain(); master.gain.value = muted ? 0 : .62;
      const compressor = context.createDynamicsCompressor();
      master.connect(compressor); compressor.connect(context.destination);
    }
    if (context.state !== 'running') await context.resume();
    if (context.state !== 'running') return false;
    await loadGuitarSamples();
    return true;
  }
  function release(target,time,fadeTime = .015) {
    const fade = target.gain.gain;
    if (fade.cancelAndHoldAtTime) fade.cancelAndHoldAtTime(time); else fade.cancelScheduledValues(time);
    fade.setTargetAtTime(0,time,fadeTime);
    target.source.stop(time + fadeTime * 7);
  }
  function hit(index,time) {
    const [drum,level] = drumVoices[index];
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = guitarBuffers.get(drum);
    gain.gain.value = level;
    source.connect(gain); gain.connect(master);
    source.start(time);
    const current = { source, gain };
    hits.add(current);
    source.onended = () => { source.disconnect(); gain.disconnect(); hits.delete(current); };
  }
  // The riff is one string at a time: each note chokes the one before, like palm-muted playing.
  // Notes you play yourself (poly) ring together, so you can hold chords; only a repeat of the
  // same letter restarts it.
  function tone(index,time = context && context.currentTime,hold,poly = false) {
    if (!context || context.state !== 'running' || muted) return;
    if (drumVoices[index]) { hit(index,time); return; }
    const sample = guitarVoices[index];
    if (poly) { if (held.has(index)) release(held.get(index),time); }
    else if (voice) release(voice,time);
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = guitarBuffers.get(sample);
    gain.gain.setValueAtTime(1.6,time);
    gain.gain.setTargetAtTime(.6,time + .15,.5);
    gain.gain.setTargetAtTime(0,time + 2.2,.25);
    source.connect(gain); gain.connect(master);
    source.start(time,sampleOffsets[sample] || 0); source.stop(time + 3.4);
    const current = { source, gain };
    if (poly) held.set(index,current); else voice = current;
    if (hold) release(current,time + hold);
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (voice === current) voice = null;
      if (held.get(index) === current) held.delete(index);
    };
  }
  const instrument = document.querySelector('.name-instrument');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  // A red flare behind the letter and a spray of embers that drift up and burn out.
  function embers(index) {
    if (calm.matches) return;
    const button = buttons[index];
    const size = parseFloat(getComputedStyle(button.querySelector('.letter')).fontSize);
    const box = button.getBoundingClientRect(), frame = instrument.getBoundingClientRect();
    const bookend = button.classList.contains('bookend');
    const x = box.left - frame.left + box.width / 2;
    const y = box.top - frame.top + size * (bookend ? .4 : .31);
    const spark = (className,style) => {
      const el = document.createElement('span');
      el.className = className; el.setAttribute('aria-hidden','true');
      el.style.cssText = `left:${x}px;top:${y}px;${style}`;
      el.addEventListener('animationend',() => el.remove());
      instrument.append(el);
    };
    spark('flare',`--r:${size * (bookend ? .9 : .5)}px`);
    const spread = size * .35;
    for (let i = 0; i < 16; i++) {
      const drift = (Math.random() - .5) * spread * 2;
      spark('ember',`--dx:${drift}px;--sway:${drift * .3 + (Math.random() - .5) * 20}px;--dy:${-(size * .25 + Math.random() * size * .55)}px;` +
        `--size:${2 + Math.random() * 4}px;--t:${700 + Math.random() * 900}ms;--delay:${Math.random() * 80}ms;` +
        `margin-left:${(Math.random() - .5) * size * .18}px;margin-top:${(Math.random() - .5) * size * .12}px`);
    }
  }
  function flash(index) {
    const button = buttons[index];
    clearTimeout(flashes.get(index));
    embers(index);
    button.classList.add('lit');
    flashes.set(index,setTimeout(() => { button.classList.remove('lit'); flashes.delete(index); },450));
  }
  function update() {
    buttons.forEach((button,i) => button.classList.toggle('next',!playing && cursor < melody.length && i === melody[cursor]));
    progress.style.width = `${cursor / melody.length * 100}%`;
    status.textContent = cursor === melody.length ? 'Exit light, enter night. Again?' : `${playing ? 'Playing' : 'Follow the arrow'} · ${cursor} / ${melody.length}`;
  }
  function stop(silence = true) {
    playing = false; run++; clearTimeout(timer);
    visuals.forEach(clearTimeout); visuals.clear();
    if (silence && context) {
      if (voice) release(voice,context.currentTime);
      held.forEach(note => release(note,context.currentTime)); held.clear();
      hits.forEach(drum => release(drum,context.currentTime));
    }
    listen.textContent = '▶ Play the riff'; update();
  }
  async function press(index,fromKey = false) {
    if (playing) stop();
    try {
      if (!await audioReady()) return;
      if (cursor === melody.length) cursor = 0;
      tone(index,undefined,undefined,true); flash(index);
      // A key tapped and let go while the samples were still loading shouldn't ring on.
      if (fromKey && !down.has(index) && held.has(index)) { release(held.get(index),context.currentTime,.12); held.delete(index); }
      if (index === melody[cursor]) cursor++;
      update();
      if (index !== melody[Math.max(0,cursor-1)]) status.textContent = `${names[index]} · Your own melody. Follow the arrow to continue.`;
    } catch { status.textContent = 'Couldn’t start sound. Tap a letter to try again.'; }
  }
  buttons.forEach((button,i) => button.addEventListener('click',() => press(i)));
  document.addEventListener('keydown',event => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    const index = keys.indexOf(event.key.toLowerCase());
    if (index !== -1) { event.preventDefault(); down.add(index); press(index,true); }
  });
  // Letting go of a key lets that note fade out, like lifting a finger off the string.
  document.addEventListener('keyup',event => {
    const index = keys.indexOf(event.key.toLowerCase());
    down.delete(index);
    if (index === -1 || !held.has(index) || !context) return;
    release(held.get(index),context.currentTime,.12);
    held.delete(index);
  });
  addEventListener('blur',() => {
    if (!context) return;
    held.forEach(note => release(note,context.currentTime,.12)); held.clear(); down.clear();
  });
  listen.addEventListener('click',async () => {
    if (playing) { stop(); return; }
    try {
      if (!await audioReady()) return;
      playing = true; cursor = 0; const currentRun = ++run;
      listen.textContent = 'Ⅱ Pause'; update();
      // Notes are scheduled on the audio clock a little ahead of time so the eighths stay even;
      // the letter flashes follow on ordinary timers.
      let next = 0, when = context.currentTime + .08;
      const start = when;
      drumScore.forEach(([at,index]) => {
        const time = start + at * beat;
        tone(index,time);
        const visual = setTimeout(() => { visuals.delete(visual); if (run === currentRun) flash(index); },(time - context.currentTime) * 1000);
        visuals.add(visual);
      });
      function step() {
        if (!playing || run !== currentRun) return;
        const [note,gap,hold] = score[next];
        tone(note,when,hold && hold * beat);
        const visual = setTimeout(() => {
          visuals.delete(visual);
          if (!playing || run !== currentRun) return;
          flash(note); cursor++; update();
          if (cursor === score.length) setTimeout(() => { if (run === currentRun) stop(false); },gap * beat * 1000);
        },Math.max(0,(when - context.currentTime) * 1000));
        visuals.add(visual);
        when += gap * beat; next++;
        if (next < score.length) timer = setTimeout(step,Math.max(0,(when - context.currentTime - .1) * 1000));
      }
      step();
    } catch { stop(); status.textContent = 'Couldn’t start sound. Tap a letter to try again.'; }
  });
  mute.addEventListener('click',() => {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : .62,context.currentTime,.02);
    mute.textContent = muted ? 'Sound off' : 'Sound on'; mute.setAttribute('aria-pressed',String(muted));
  });
  document.querySelector('.blinker').addEventListener('click',() => listen.click());
  document.getElementById('reset').addEventListener('click',() => { stop(); cursor = 0; update(); });
  document.addEventListener('visibilitychange',() => { if (document.hidden) stop(); });
  update();
})();
