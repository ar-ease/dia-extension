let host, pos = { x: 0, y: 0 }; // pos: last dragged offset, kept until the page reloads
const icon = (u) => chrome.runtime.getURL("/_favicon/") + "?pageUrl=" + encodeURIComponent(u) + "&size=32";

function open(newTab) {
  if (host) return host.remove(), (host = null);
  host = document.createElement("div");
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>
    :host{--bg:rgba(255,255,255,.92);--fg:#1d1d1f;--dim:#8e8e93;--sel:rgba(0,0,0,.055);--line:rgba(0,0,0,.09)}
    @media(prefers-color-scheme:dark){:host{--bg:rgba(30,30,32,.9);--fg:#f5f5f7;--dim:#8e8e93;--sel:rgba(255,255,255,.08);--line:rgba(255,255,255,.1)}}
    .back{position:fixed;inset:0;z-index:2147483647;display:flex;justify-content:center;align-items:flex-start;padding-top:20vh;
      font:13.5px -apple-system,system-ui,sans-serif;color:var(--fg);-webkit-font-smoothing:antialiased}
    .box{width:560px;max-width:92vw;background:var(--bg);backdrop-filter:blur(24px) saturate(1.6);border-radius:14px;
      box-shadow:0 0 0 .5px var(--line),0 12px 40px rgba(0,0,0,.18);overflow:hidden}
    .g{height:14px;cursor:grab;display:flex;justify-content:center;align-items:flex-end}
    .g:active{cursor:grabbing}
    .g::after{content:'';width:32px;height:3px;border-radius:2px;background:var(--line)}
    .row{display:flex;align-items:center;gap:10px;padding:6px 18px 14px}
    .chip{flex:none;background:var(--sel);border-radius:6px;padding:3px 9px;font-size:13px;font-weight:500}
    .chip[hidden]{display:none}
    input{all:unset;box-sizing:border-box;flex:1;min-width:0;font-size:16px;color:var(--fg)}
    input::placeholder{color:var(--dim)}
    #l{padding:6px;max-height:50vh;overflow:auto;border-top:.5px solid var(--line)}
    #l:empty{display:none}
    .r{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;cursor:pointer}
    .r.sel{background:var(--sel)}
    .r img,.r svg{width:16px;height:16px;flex:none;border-radius:3px}
    .r svg{stroke:var(--dim);fill:none;stroke-width:2;stroke-linecap:round}
    .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .t small{color:var(--dim);margin-left:8px;font-size:12px}
    .h{color:var(--dim);font-size:11.5px;flex:none}
  </style><div class="back"><div class="box"><div class="g"></div><div class="row"><span class="chip" hidden></span><input></div><div id="l"></div></div></div>`;
  const input = root.querySelector("input"), list = root.getElementById("l"), chip = root.querySelector(".chip");
  let items = [], sel = 0, engine = null; // engine: active search keyword, shown as a chip
  const base = newTab ? "Search or enter URL…" : "Edit URL or search…";
  const full = () => (engine ? engine + " " : "") + input.value.trim();
  const setEngine = (k) => {
    engine = k;
    chip.hidden = !k;
    chip.textContent = k ? ENGINES[k][0] : "";
    input.placeholder = k ? `Search ${ENGINES[k][0]}…` : base;
  };
  setEngine(null);

  const render = () => {
    list.replaceChildren(...items.map((it, i) => {
      const d = document.createElement("div");
      d.className = "r" + (i === sel ? " sel" : "");
      let ic;
      if (it.kind === "search") (ic = document.createElementNS("http://www.w3.org/2000/svg", "svg")).innerHTML = '<circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/>', ic.setAttribute("viewBox", "0 0 16 16");
      else (ic = document.createElement("img")).src = icon(it.url);
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = it.title || it.url;
      if (it.kind !== "search" && it.title !== it.url && !it.title?.startsWith("Search ") && !it.title?.startsWith("Open ")) {
        const s = document.createElement("small");
        s.textContent = it.url.replace(/^https?:\/\/(www\.)?/, "");
        t.append(s);
      }
      d.append(ic, t);
      if (i === sel) {
        const h = document.createElement("span");
        h.className = "h";
        h.textContent = (it.kind === "tab" ? "Switch to Tab" : it.kind === "search" ? "Search" : "Open") + " ↵";
        d.append(h);
      }
      d.onmousedown = (e) => (e.preventDefault(), go(it));
      return d;
    }));
    list.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
  };
  const close = () => (host?.remove(), (host = null));
  const go = (item) => {
    if (engine && !input.value.trim()) return; // chip with no query yet
    chrome.runtime.sendMessage({ type: "go", item, text: full(), newTab });
    close();
  };
  const move = (d) => items.length && ((sel = (sel + d + items.length) % items.length), render());

  input.oninput = () => {
    if (engine && !input.value.trim()) return ((items = []), (sel = -1), render());
    chrome.runtime.sendMessage({ type: "suggest", q: full() }, (r) => {
      items = r || []; sel = full() ? 0 : -1; render();
    });
  };
  input.onkeydown = (e) => {
    e.stopPropagation(); // keep page hotkeys out
    const k = e.key, c = e.ctrlKey;
    const word = input.value.trim();
    if ((k === " " || k === "Tab") && !engine && ENGINES[word] && input.value === word) {
      e.preventDefault(); // "yt" + space/tab -> chip
      input.value = "";
      setEngine(word);
      input.oninput();
    } else if (k === "Backspace" && engine && !input.value) {
      e.preventDefault(); // backspace on empty input removes the chip, keeps the keyword as text
      input.value = engine;
      setEngine(null);
      input.oninput();
    } else if (k === "Escape") close();
    else if (k === "Enter") go(items[sel]);
    else if (k === "ArrowDown" || (k === "Tab" && !e.shiftKey) || (c && (k === "n" || k === "j"))) (e.preventDefault(), move(1));
    else if (k === "ArrowUp" || (k === "Tab" && e.shiftKey) || (c && (k === "p" || k === "k"))) (e.preventDefault(), move(-1));
  };
  for (const ev of ["keyup", "keypress"]) input.addEventListener(ev, (e) => e.stopPropagation());
  input.onblur = close;
  root.querySelector(".back").onmousedown = (e) => e.target.className === "back" && close();

  const box = root.querySelector(".box"), grip = root.querySelector(".g");
  const place = () => (box.style.transform = `translate(${pos.x}px,${pos.y}px)`);
  place();
  grip.onpointerdown = (e) => {
    e.preventDefault(); // keep input focus, otherwise onblur closes the bar
    grip.setPointerCapture(e.pointerId);
    const sx = e.clientX - pos.x, sy = e.clientY - pos.y;
    grip.onpointermove = (m) => ((pos = { x: m.clientX - sx, y: m.clientY - sy }), place());
    grip.onpointerup = () => (grip.onpointermove = grip.onpointerup = null);
  };

  document.documentElement.append(host);
  if (!newTab) input.value = location.href; // like Arc's Cmd+L
  input.focus();
  input.select();
  chrome.runtime.sendMessage({ type: "suggest", q: "" }, (r) => { items = r || []; sel = -1; render(); }); // -1: Enter on the prefilled URL opens it, not a tab
}

addEventListener("keydown", (e) => {
  // Ctrl+Opt+O = current tab, Ctrl+Opt+Shift+O = new tab (Karabiner maps Cmd+L / Cmd+T to these).
  if (e.ctrlKey && e.altKey && !e.metaKey && e.code === "KeyO") {
    e.preventDefault(); e.stopPropagation();
    open(e.shiftKey);
  }
}, true);

chrome.runtime.onMessage.addListener((m) => m.type === "open" && open(m.newTab));
