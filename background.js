importScripts("engines.js"); // ENGINES table, shared with content.js

const isUrl = (s) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(s) || /^localhost(:\d+)?/.test(s);
const normalize = (u) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : (/^localhost/.test(u) ? "http://" : "https://") + u);

// The top row: what Enter does for the raw text.
function primary(text) {
  const m = text.match(/^(\S+)\s+(.+)$/);
  const e = m && ENGINES[m[1]];
  if (e) return { kind: "url", title: `Search ${e[0]} for “${m[2]}”`, url: e[1].replace("%s", encodeURIComponent(m[2])) };
  if (isUrl(text)) return { kind: "url", title: `Open ${text}`, url: normalize(text) };
  return { kind: "search", title: `Search for “${text}”`, text };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "suggest") {
    const q = msg.q.toLowerCase();
    Promise.all([
      chrome.tabs.query({}),
      q ? chrome.bookmarks.search(q) : [],
      q ? chrome.history.search({ text: q, maxResults: 6 }) : [],
    ]).then(([tabs, marks, hist]) => {
      const hit = (t) => (t.title + " " + t.url).toLowerCase().includes(q);
      reply([
        ...(msg.q ? [primary(msg.q)] : []),
        ...tabs.filter(hit).slice(0, 6).map((t) => ({ kind: "tab", id: t.id, winId: t.windowId, title: t.title, url: t.url })),
        ...marks.filter((b) => b.url).slice(0, 4).map((b) => ({ kind: "url", title: "★ " + b.title, url: b.url })),
        ...hist.map((h) => ({ kind: "url", title: h.title, url: h.url })),
      ]);
    });
    return true; // async reply
  }
  if (msg.type === "go") {
    const item = msg.item || (msg.text && primary(msg.text));
    if (!item) return;
    if (item.kind === "tab") {
      chrome.tabs.update(item.id, { active: true });
      chrome.windows.update(item.winId, { focused: true });
    } else if (item.kind === "search") {
      chrome.search.query({ text: item.text, disposition: msg.newTab ? "NEW_TAB" : "CURRENT_TAB" });
    } else {
      const url = normalize(item.url);
      msg.newTab ? chrome.tabs.create({ url }) : chrome.tabs.update(sender.tab.id, { url });
    }
  }
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd === "toggle-full") {
    const w = await chrome.windows.getCurrent();
    return chrome.windows.update(w.id, { state: w.state === "fullscreen" ? "normal" : "fullscreen" });
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: "open", newTab: cmd === "open-new" }).catch(() => {}); // page without content script (dia://, new-tab)
});
