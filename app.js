(function () {
  const audio = document.getElementById("audio");
  const transcriptEl = document.getElementById("transcript");
  const commentaryEl = document.getElementById("commentary");
  const follow = document.getElementById("follow");
  const nowEl = document.getElementById("now");
  const copyLinkBtn = document.getElementById("copyLink");

  const data = window.APP_DATA || { transcript: [], commentary: [] };

  // ---- Set src ONLY here, then load() to start metadata pipeline
  if (data.audioSrc) {
    audio.src = data.audioSrc;
    audio.load();
  }

  // ---------- Utilities ----------
  const pad2 = (n)=> String(Math.floor(n)).padStart(2, "0");
  const fmt = (t)=>{
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t/60);
    const s = Math.floor(t%60);
    return `${pad2(m)}:${pad2(s)}`;
  };
  const clamp = (x, a, b)=> Math.min(b, Math.max(a, x));
  const within = (t, seg)=> t >= seg.start && t < (seg.end ?? (seg.start + 0.01));
  const byStart = (a, b)=> a.start - b.start;

  const T = (data.transcript || []).slice().sort(byStart);
  const C = (data.commentary || []).slice().sort(byStart);

  // ---------- Build DOM ----------
  const MAX_BADGE_COLORS = 6;
  const speakerIndex = new Map();
  let speakerSeq = 0;

  function getSpeakerClass(name) {
    if (!name) return "";
    if (!speakerIndex.has(name)) {
      speakerIndex.set(name, speakerSeq % MAX_BADGE_COLORS);
      speakerSeq++;
    }
    const idx = speakerIndex.get(name);
    return `badge badge-${idx}`;
  }



  function renderList(container, items, role){
    container.textContent = "";
    items.forEach((seg, idx) => {
      const div = document.createElement("div");
      div.className = "line";
      div.setAttribute("role", "listitem");
      div.setAttribute("tabindex", "0");
      div.dataset.role = role;
      div.dataset.idx = String(idx);
      div.dataset.start = String(seg.start);
      div.dataset.end = String(seg.end);

      const frag = document.createDocumentFragment();

      const stamp = document.createElement("span");
      stamp.className = "stamp";
      stamp.textContent = fmt(seg.start);
      frag.appendChild(stamp);

      if (seg.speaker) {
        const badge = document.createElement("span");
        badge.className = getSpeakerClass(seg.speaker);
        badge.textContent = seg.speaker;
        frag.appendChild(badge);

        const sep = document.createElement("span");
        sep.textContent = ": ";
        frag.appendChild(sep);
      }

    const txt = document.createElement("span");
    txt.textContent = seg.text;
    frag.appendChild(txt);

    div.appendChild(frag);
    container.appendChild(div);
  });
}

  renderList(transcriptEl, T, "transcript");
  renderList(commentaryEl, C, "comment");

  // ---------- Robust seeking + pending application ----------
  let pendingSeek = null;     // number|null
  let userSeeked = false;     // remember if user initiated a seek
  let initialApplied = false; // guard applying initial URL seek once

  function canSeekNow() {
    return audio.readyState >= 1 && audio.seekable && audio.seekable.length > 0;
  }

  function applyPendingSeek() {
    if (pendingSeek == null) return;
    if (!canSeekNow()) return;
    // Clamp into the first seekable range
    const start0 = audio.seekable.start(0);
    const end0   = audio.seekable.end(0);
    const target = clamp(pendingSeek, start0, Math.max(start0, end0 - 0.05));
    audio.currentTime = target;
    pendingSeek = null;
    syncUI(audio.currentTime);
  }

  function seekTo(seconds){
    if (!Number.isFinite(seconds)) return;
    userSeeked = true;
    pendingSeek = seconds;
    applyPendingSeek();
  }

  // ---------- Interaction ----------
  function handleClick(e){
    const line = e.target.closest(".line");
    if (!line) return;
    const start = parseFloat(line.dataset.start);
    if (Number.isFinite(start)) {
      seekTo(start + 0.001); // nudge inside segment
    }
  }
  transcriptEl.addEventListener("click", handleClick);
  commentaryEl.addEventListener("click", handleClick);

  function handleKey(e){
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("line")){
      e.preventDefault();
      const start = parseFloat(e.target.dataset.start);
      if (Number.isFinite(start)) {
        seekTo(start + 0.001);
      }
    }
  }
  transcriptEl.addEventListener("keydown", handleKey);
  commentaryEl.addEventListener("keydown", handleKey);

  // ---------- Highlight + follow (always centers when enabled) ----------
  let lastTIdx = -1, lastCIdx = -1;

  function activate(container, idx){
    const items = container.children;
    if (idx < 0 || idx >= items.length) return;

    for (let i = 0; i < items.length; i++){
      if (i === idx) items[i].classList.add("active");
      else items[i].classList.remove("active");
    }

    if (follow.checked) {
      const el = items[idx];
      const offset = el.offsetTop - container.clientHeight/2 + el.clientHeight/2;
      container.scrollTo({ top: clamp(offset, 0, container.scrollHeight), behavior: "smooth" });
    }
  }

  function findActiveIndex(list, t){
    for (let i=0;i<list.length;i++){
      if (within(t, list[i])) return i;
      if (i === list.length-1 && t >= list[i].start) return i;
    }
    return -1;
  }

  function syncUI(curTime){
    nowEl.textContent = fmt(curTime);
    const ti = findActiveIndex(T, curTime);
    const ci = findActiveIndex(C, curTime);
    if (ti !== lastTIdx && ti !== -1) { activate(transcriptEl, ti); lastTIdx = ti; }
    if (ci !== lastCIdx && ci !== -1) { activate(commentaryEl, ci); lastCIdx = ci; }

    // Keep URL param in sync for shareable deep links
    const ss = Math.floor(curTime);
    const url = new URL(location.href);
    if (url.searchParams.get("t") !== String(ss)) {
      url.searchParams.set("t", String(ss));
      history.replaceState(null, "", url);
    }
  }

  // Time-based updates
  audio.addEventListener("timeupdate", () => syncUI(audio.currentTime));
  audio.addEventListener("seeked", () => syncUI(audio.currentTime));

  // Apply initial seek from URL ONCE after metadata, unless user clicked already
  audio.addEventListener("loadedmetadata", () => {
    if (initialApplied) return;
    initialApplied = true;

    const url = new URL(location.href);
    const tFromURL = parseFloat(url.searchParams.get("t"));

    if (!userSeeked && Number.isFinite(tFromURL)) {
      pendingSeek = tFromURL;
    }
    applyPendingSeek(); // will do nothing until seekable is ready
    syncUI(audio.currentTime || 0);
  });

  // Some browsers only allow seeking after 'canplay' or 'durationchange'
  ["canplay", "loadeddata", "durationchange", "progress"].forEach(evt => {
    audio.addEventListener(evt, applyPendingSeek);
  });

  // Back/forward: treat as a requested seek
  window.addEventListener("popstate", () => {
    const url = new URL(location.href);
    const t = parseFloat(url.searchParams.get("t"));
    if (Number.isFinite(t)) {
      seekTo(t);
    }
  });

  copyLinkBtn.addEventListener("click", async () => {
    const url = new URL(location.href);
    url.searchParams.set("t", String(Math.floor(audio.currentTime || 0)));
    try {
      await navigator.clipboard.writeText(url.toString());
      copyLinkBtn.textContent = "Copied ✓";
      setTimeout(()=> copyLinkBtn.textContent = "Copy timestamped link", 1000);
    } catch {}
  });

  window.addEventListener("resize", () => {
    if (!follow.checked) return;
    syncUI(audio.currentTime || 0);
  });
})();
