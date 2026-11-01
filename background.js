// Search keywords: type "yt lofi" -> YouTube search. Edit freely; %s = query.
const ENGINES = {
  g: ["Google", "https://www.google.com/search?q=%s"],
  yt: ["YouTube", "https://www.youtube.com/results?search_query=%s"],
  gh: ["GitHub", "https://github.com/search?q=%s"],
  w: ["Wikipedia", "https://en.wikipedia.org/w/index.php?search=%s"],
  mdn: ["MDN", "https://developer.mozilla.org/en-US/search?q=%s"],
  so: ["Stack Overflow", "https://stackoverflow.com/search?q=%s"],
  maps: ["Google Maps", "https://www.google.com/maps/search/%s"],
  a: ["Amazon", "https://www.amazon.com/s?k=%s"],
  r: ["Reddit", "https://www.reddit.com/search/?q=%s"],
  ddg: ["DuckDuckGo", "https://duckduckgo.com/?q=%s"],
  b: ["Bing", "https://www.bing.com/search?q=%s"],
};

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
