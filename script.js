/* -------------------------------------------------------
   CLEAN MASTER SCRIPT - Full file
   - Fixed countdown logic (no 364-day jump)
   - Reveal window: Nov 21 09:00 local → visible for 24 hours
   - Album slideshow, hearts, sparkles, bokeh
   - Balloons rising from bottom
   - Wishes popup wiring
   - Robust audio toggle
--------------------------------------------------------- */

(function () {
  const $ = s => document.querySelector(s);
  let countdownInterval = null;
  let revealTimeout = null;
  const VISIBLE_MS = 24 * 60 * 60 * 1000; // 24 hours
  let revealed = false;
  
  function ensureVisualContainers() {
    const ensure = (id, tag = 'div') => {
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement(tag);
        el.id = id;
        document.body.appendChild(el);
        console.log('[ensure] created', id);
      }
      return el;
    };
    ensure('balloons', 'div');
    ensure('floating-hearts', 'div');
    ensure('bokehCanvas', 'canvas');
    ensure('sparkleCanvas', 'canvas');
  }

  /* ---------- Target calculation: returns startTs, endTs, now ---------- */
  function getTargetStartAndEnd() {
    const now = Date.now();
    const dNow = new Date(now);
    const year = dNow.getFullYear();

    const candidateStart = new Date(year, 10, 21, 9, 0, 0, 0).getTime(); // Nov 21, 09:00 local
    const candidateEnd = candidateStart + VISIBLE_MS;

    if (now < candidateStart) {
      return { startTs: candidateStart, endTs: candidateEnd, now };
    }

    if (now >= candidateStart && now < candidateEnd) {
      return { startTs: candidateStart, endTs: candidateEnd, now };
    }

    // already past this year's window → next year
    const nextStart = new Date(year + 1, 10, 21, 9, 0, 0, 0).getTime();
    return { startTs: nextStart, endTs: nextStart + VISIBLE_MS, now };
  }

  /* ---------- Format ms → DD : HH : MM : SS ---------- */
  function formatDiff(ms) {
    if (ms <= 0) return "00 : 00 : 00 : 00";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(d).padStart(2,'0')} : ${String(h).padStart(2,'0')} : ${String(m).padStart(2,'0')} : ${String(s).padStart(2,'0')}`;
  }

  /* ---------- Update preloader countdown (uses getTargetStartAndEnd) ---------- */
  function updatePreloaderCountdown() {
    const el = $("#preloader-countdown");
    const msg = $("#preloader-message");
    if (!el) return;

    const { startTs, endTs, now } = getTargetStartAndEnd();
    const diffToStart = startTs - now;
    const diffToEnd = endTs - now;

    // Inside reveal window
    if (now >= startTs && now < endTs) {
      el.textContent = formatDiff(diffToEnd);
      if (msg) msg.textContent = "🎉 It's Birthday Time!";
      // reveal once
      revealMainContent();
      return;
    }

    // Before start — countdown to start
    if (now < startTs) {
      el.textContent = formatDiff(diffToStart);
      if (msg) {
        const sd = new Date(startTs);
        msg.textContent = `Opens on ${sd.toLocaleDateString()} ${sd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
      }
      return;
    }

    // After window (shouldn't happen often due to above branches)
    el.textContent = "00 : 00 : 00 : 00";
    if (msg) msg.textContent = "⏳ Event Ended";
  }

  /* ---------- Reveal main content and start visuals ---------- */
  function revealMainContent() {
    if (revealed) return;
    revealed = true;

    // hide preloader
    const pre = $("#preloader");
    if (pre) {
      pre.style.opacity = "0";
      pre.style.pointerEvents = "none";
      setTimeout(()=> { try { pre.remove(); } catch(e) {} }, 600);
    }

    const main = $("#mainContent");
    if (main) {
      main.classList.remove("hidden");
      main.classList.add("show-content");
      document.getElementById("audioToggle")?.classList.add("visible");
document.getElementById("openWishes")?.classList.add("visible");
    }

    // start visuals
    try { startAlbum(); } catch(e) { console.warn(e); }
    try { startHearts(); } catch(e) { console.warn(e); }
    try { startSparkles(); } catch(e) { console.warn(e); }
    try { startBokeh(); } catch(e) { console.warn(e); }
    try { startBalloons(); } catch(e) { console.warn(e); }

    // show buttons
    const audioBtn = $("#audioToggle");
    const wishBtn = $("#openWishes");
    if (audioBtn) { audioBtn.style.opacity = "1"; audioBtn.style.pointerEvents = "auto"; }
    if (wishBtn) { wishBtn.style.opacity = "1"; wishBtn.style.pointerEvents = "auto"; }
  }

  /* ---------- schedule reload/hide after reveal window ends ---------- */
  function scheduleHideAfterWindow(endTs) {
    const now = Date.now();
    const ms = endTs - now;
    if (ms <= 0) return;
    setTimeout(()=> {
      try { location.reload(); } catch(e) {}
    }, ms + 500);
  }

  /* ---------- Album slideshow ---------- */
  function startAlbum() {
    const photos = Array.from(document.querySelectorAll(".photo-album .album-photo"));
    const captionEl = $("#album-caption");
    if (!photos.length) return;
    let idx = 0;
    photos.forEach((p,i) => p.classList.toggle("active", i===0));
    if (captionEl) captionEl.textContent = photos[0].dataset.caption || '';
    setInterval(()=> {
      photos[idx].classList.remove('active');
      idx = (idx + 1) % photos.length;
      photos[idx].classList.add('active');
      if (captionEl) captionEl.textContent = photos[idx].dataset.caption || '';
    }, 2000);
    const album = document.querySelector('.photo-album');
    if (album) album.classList.add('glow');
  }

  /* ---------- Hearts (simple DOM hearts) ---------- */
  function startHearts(opts = {}) {
  const cfg = Object.assign({ max: 30, spawnInterval: 600 }, opts);
  if (REDUCED) { console.log('startHearts: reduced motion enabled — disabled'); return { stop: () => {} }; }

  const container = ensureEl('floating-hearts', 'div');
  container.style.pointerEvents = 'none';

  // Pool of reusable heart nodes
  const pool = [];
  let activeCount = 0;
  let spawnTimer = null;

  function createNode() {
    const el = document.createElement('div');
    el.className = 'f-heart';
    el.style.position = 'absolute';
    el.style.willChange = 'transform, opacity';
    el.style.opacity = '0';
    return el;
  }

  function spawn() {
    if (activeCount >= cfg.max) return;
    const node = pool.length ? pool.pop() : createNode();
    node.textContent = ['💖','💗','💞','💕'][Math.floor(Math.random()*4)];
    const size = 14 + Math.random() * 26;
    node.style.fontSize = size + 'px';
    const left = Math.random() * 100;
    node.style.left = `calc(${left}vw - ${size/2}px)`;
    node.style.opacity = '1';
    node.style.transform = `translateY(0) scale(${0.9 + Math.random()*0.3})`;
    container.appendChild(node);
    activeCount++;

    // animate using CSS transitions but timed removal to reuse element
    const dur = 4200 + Math.random() * 2400;
    node.style.transition = `transform ${dur}ms cubic-bezier(.22,.9,.26,1), opacity ${dur}ms linear`;
    // force reflow then animate
    requestAnimationFrame(() => {
      node.style.transform = `translateY(-${120 + Math.random()*160}px) scale(${1 + Math.random()*0.15})`;
      node.style.opacity = '0';
    });

    // return to pool after animation
    setTimeout(() => {
      try { node.remove(); } catch (e) {}
      node.style.transition = '';
      pool.push(node);
      activeCount--;
    }, dur + 80);
  }

  // start spawning
  spawnTimer = setInterval(spawn, cfg.spawnInterval);

  // spawn a few upfront
  for (let i=0;i<4;i++) setTimeout(spawn, i*200);

  return {
    stop() {
      clearInterval(spawnTimer);
      spawnTimer = null;
      // cleanup nodes in DOM (but keep pool)
      pool.forEach(n => { try { n.remove(); } catch(e){} });
    }
  };
}

  
  /* ---------- Sparkles canvas ---------- */
  function startSparkles() {
    const canvas = $("#sparkleCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
    resize(); window.addEventListener('resize', resize);
    const sparks = [];
    function add() {
      sparks.push({
        x: Math.random()*canvas.width,
        y: Math.random()*canvas.height*0.6,
        vx: (Math.random()-0.5)*0.3,
        vy: -1 - Math.random()*1.4,
        life: 40 + Math.random()*60,
        r: 1 + Math.random()*3,
        a: 0.7 + Math.random()*0.2
      });
      if (sparks.length > 160) sparks.splice(0,30);
    }
    setInterval(add, 200);
    function step(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for (let i = sparks.length-1; i>=0; i--){
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy; s.life--;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, s.a * (s.life/100)).toFixed(2)})`;
        ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
        if (s.life<=0) sparks.splice(i,1);
      }
      requestAnimationFrame(step);
    }
    step();
  }

  /* ---------- Bokeh canvas ---------- */
  function startBokeh() {
    const canvas = $("#bokehCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width = innerWidth;
    let h = canvas.height = innerHeight;
    const dots = [];
    for (let i=0;i<28;i++){
      dots.push({x:Math.random()*w, y:Math.random()*h, r:20+Math.random()*60, alpha:0.04+Math.random()*0.12, vy:0.1+Math.random()*0.3});
    }
    window.addEventListener('resize', ()=>{ w=canvas.width=innerWidth; h=canvas.height=innerHeight; });
    function draw(){
      ctx.clearRect(0,0,w,h);
      dots.forEach(d=>{
        d.y -= d.vy; if (d.y < -100) d.y = h + 100;
        ctx.beginPath(); ctx.fillStyle = `rgba(255,214,107,${d.alpha})`; ctx.arc(d.x,d.y,d.r,0,Math.PI*2); ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ---------- Balloons ---------- */
  function startBalloons(cfg = {}) {
    const container = $("#balloons");
    if (!container) return;
    const count = cfg.count || 10;
    const colors = cfg.colors || ['#ffc976','#ff9fb0','#9ee6ff','#ffd86b','#ffd1ee'];

    function spawnOne() {
      const b = document.createElement('div');
      b.className = 'balloon';
      const size = 40 + Math.random()*90;
      b.style.width = b.style.height = size + 'px';
      b.style.left = Math.random()*95 + 'vw';
      b.style.background = colors[Math.floor(Math.random()*colors.length)];
      const duration = 10 + Math.random()*18;
      const delay = Math.random()*5;
      b.style.animation = `riseUp ${duration}s linear ${delay}s forwards, sway ${3 + Math.random()*2}s ease-in-out ${delay}s infinite`;
      container.appendChild(b);
      setTimeout(()=> {
        b.style.transition = 'opacity 0.6s';
        b.style.opacity = '0';
        setTimeout(()=> { try{ b.remove(); } catch(e){} }, 700);
      }, (duration + delay)*1000);
    }

    for (let i=0;i<count;i++) spawnOne();
    // continuous spawn
    if (!container._balloonInterval) {
      container._balloonInterval = setInterval(()=> { for(let k=0;k< (1+Math.floor(Math.random()*2));k++) spawnOne(); }, 6000 + Math.random()*4000);
    }
  }

  /* ---------- Wishes popup wiring ---------- */
  function wireWishes() {
    const open = $("#openWishes");
    const close = $("#closePopup");
    const close2 = $("#closePopup2");
    const popup = $("#wishesPopup");
    const form = $("#wishesForm");

    if (open) open.addEventListener('click', ()=> { if (popup) popup.style.display = 'flex'; });
    if (close) close.addEventListener('click', ()=> { if (popup) popup.style.display = 'none'; });
    if (close2) close2.addEventListener('click', ()=> { if (popup) popup.style.display = 'none'; });

    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const thanks = $("#thanksMessage"); if (thanks) { thanks.style.display = 'block'; }
      setTimeout(()=> { if (popup) popup.style.display = 'none'; if (thanks) thanks.style.display = 'none'; }, 2000);
    });

    // reactions - simple visual pop
    document.querySelectorAll('.reaction').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const parent = btn.closest('.popup-content');
        if (!parent) return;
        const el = document.createElement('div');
        el.textContent = btn.textContent;
        el.style.position = 'absolute';
        el.style.left = '50%';
        el.style.top = '60%';
        el.style.transform = 'translateX(-50%)';
        el.style.fontSize = '22px';
        parent.appendChild(el);
        el.animate([{transform:'translateY(0)', opacity:1},{transform:'translateY(-80px)', opacity:0}], {duration:900});
        setTimeout(()=> el.remove(), 900);
      });
    });
  }

  /* ---------- Robust audio toggle ---------- */
  function wireAudio() {
    const btn = $("#audioToggle");
    if (!btn) return;

    let audio = $("#myAudio");
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'myAudio';
      audio.loop = true;
      audio.preload = 'none';
      document.body.appendChild(audio);
    }
    // set default src if not present (adjust path if needed)
    if (!audio.src || audio.src.trim() === '') audio.src = "music.mp3";

    function setIcon(isPlaying) {
      btn.textContent = isPlaying ? '🔊' : '🔇';
      btn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    }

    // initialize icon
    setIcon(!audio.paused && !audio.ended);

    btn.style.pointerEvents = 'auto';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (audio.paused) {
          await audio.play();
          setIcon(true);
        } else {
          audio.pause();
          setIcon(false);
        }
      } catch (err) {
        console.warn('Audio play error:', err);
        // fallback: show play icon so user can attempt again
        btn.textContent = '▶️';
      }
    });

    // opportunistic play on first user gesture
    function firstGesture() {
      try {
        if (audio.paused) {
          audio.play().then(()=> setIcon(true)).catch(()=>{});
        }
      } catch(e){}
      window.removeEventListener('click', firstGesture);
      window.removeEventListener('touchstart', firstGesture);
    }
    window.addEventListener('click', firstGesture, {passive:true});
    window.addEventListener('touchstart', firstGesture, {passive:true});
  }

  /* ---------- Initialization ---------- */
  document.addEventListener('DOMContentLoaded', ()=> {
    // set preloader countdown updater
    updatePreloaderCountdown();
    countdownInterval = setInterval(updatePreloaderCountdown, 1000);

    // wire popup and audio
    wireWishes();
    wireAudio();

    // schedule reveal if target is in future (also ensures reveal if page stays open)
    const { startTs, endTs, now } = getTargetStartAndEnd();
    if (now < startTs) {
      const msUntil = startTs - now;
      revealTimeout = setTimeout(()=> {
        // stop regular countdown and reveal
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        revealMainContent();
        // hide after window
        scheduleHideAfterWindow(endTs);
      }, msUntil + 50);
    } else if (now >= startTs && now < endTs) {
      // already inside window — reveal and schedule hide
      revealMainContent();
      scheduleHideAfterWindow(endTs);
    } else {
      // in case now >= endTs, countdownInterval will handle next year's schedule via getTargetStartAndEnd
    }
  });

  // Expose helper for testing
  window.__revealNow = function(){ revealMainContent(); };
  window.__startBalloons = function(){ startBalloons(); };

})();
// VISUALS BOOTSTRAP - ensures containers exist and starts visuals
(function(){
  // ensure required DOM nodes exist
  function ensure(id, tag='div') {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement(tag);
      el.id = id;
      document.body.appendChild(el);
      console.log('Created', id);
    }
    return el;
  }

})();