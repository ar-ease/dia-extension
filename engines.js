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
