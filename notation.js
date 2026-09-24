// Maths notation for everything students see.
// Walkthrough text is often authored as plain text (x^2, 10^-3, 27^(2/3), sqrt3, +/-).
// This rewrites visible text into proper notation (x², 10⁻³, 27²ᐟ³, √3, ±), including
// text added later by the walkthrough engines (steps, "Your turn" questions, SVG labels).
// Typed answers are unaffected: input values are not text nodes.
(function () {
  var SUP = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', '/': 'ᐟ', '⁄': 'ᐟ',
    'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
    'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
    'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ', 'θ': 'ᶿ',
    '½': '¹ᐟ²', '⅓': '¹ᐟ³', '⅔': '²ᐟ³', '¼': '¹ᐟ⁴', '¾': '³ᐟ⁴',
    '¹': '¹', '²': '²', '³': '³', '⁻': '⁻', 'ᐟ': 'ᐟ'
  };

  function toSup(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === ' ') continue;
      var m = SUP[c];
      if (m == null) return null; // no superscript form: leave the original text alone
      out += m;
    }
    return out;
  }

  // base ^ exponent: {...}, (...) with one level of nesting, a signed number, one letter,
  // or characters that are already superscripts (x^⁻ʳ)
  var BASE = "[A-Za-z0-9)\\]}πθλμ²³¹⁰-⁹₀-₉]";
  var EXP = "\\{([^{}]{1,16})\\}|\\(((?:[^()]|\\([^()]{0,10}\\)){1,20})\\)|[-−]?(?:\\d+|[A-Za-zθλ½⅓⅔¼¾])|[⁰-⁹¹²³⁻⁺ⁿᵃ-ᶻʰ-ʸˡ-ˣᐟ]+";
  var POW = new RegExp("(" + BASE + ")\\s?\\^\\s?(" + EXP + ")", "g");

  function prep(text) {
    return text
      .replace(/(\d)\s*[xX]\s*10\s?\^/g, '$1 × 10^')  // 3x10^5 → 3 × 10^5
      .replace(/\bsqrt\s*\(/g, '√(')
      .replace(/\bsqrt\s*(\d)/g, '√$1')
      .replace(/\+\/-/g, '±');
  }

  // Unicode superscript fractions (²ᐟ³, ⁻¹ᐟ², ᵐᐟⁿ) are too small to read, so they become real superscripts
  var SUPCH = '⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿᵐᵃᵇᶜᵈᵏᵖʳˢᵗˣʸ', NORMCH = '0123456789−+nmabcdkprstxy';
  var FRAC = new RegExp('([' + SUPCH + ']+)ᐟ([' + SUPCH + ']+)', 'g');
  function unsup(x) { return x.replace(/./g, function (c) { var i = SUPCH.indexOf(c); return i < 0 ? c : NORMCH[i]; }); }

  // Splits text into plain strings and {sup: "..."} parts that need a real superscript element
  function parts(text) {
    var t = prep(text), out = [], last = 0, buf = '', m;
    POW.lastIndex = 0;
    while ((m = POW.exec(t))) {
      var inner = m[3] != null ? m[3] : m[4] != null ? m[4] : m[2];
      if (/^[⁰-⁹¹²³⁻⁺ⁿᵃ-ᶻʰ-ʸˡ-ˣᐟ]+$/.test(inner) && inner.indexOf('ᐟ') < 0) { buf += t.slice(last, m.index) + m[1] + inner; last = POW.lastIndex; continue; }
      var sup = inner.indexOf('/') < 0 && inner.indexOf('ᐟ') < 0 ? toSup(inner) : null;
      if (sup != null) { buf += t.slice(last, m.index) + m[1] + sup; last = POW.lastIndex; continue; }
      buf += t.slice(last, m.index) + m[1];
      out.push(buf, { sup: unsup(inner).replace(/-/g, '−'), orig: m[0].slice(m[1].length) }); buf = ''; last = POW.lastIndex;
    }
    buf += t.slice(last);
    out.push(buf);
    // second pass: Unicode superscript fractions inside the plain strings
    var res = [];
    out.forEach(function (p) {
      if (typeof p !== 'string') { res.push(p); return; }
      var l = 0, f; FRAC.lastIndex = 0;
      while ((f = FRAC.exec(p))) { res.push(p.slice(l, f.index), { sup: unsup(f[1]) + '/' + unsup(f[2]), orig: f[0] }); l = FRAC.lastIndex; }
      res.push(p.slice(l));
    });
    return res;
  }

  function fix(text) {
    if (text.indexOf('^') === -1 && text.indexOf('sqrt') === -1 && text.indexOf('+/-') === -1 && text.indexOf('ᐟ') === -1) return text;
    return parts(text).map(function (p) { return typeof p === 'string' ? p : p.orig; }).join('');
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1, OPTION: 1, TITLE: 1 };
  var SVGNS = 'http://www.w3.org/2000/svg';

  function fixText(node) {
    var p = node.parentNode;
    if (!p || SKIP[p.nodeName.toUpperCase()]) return;
    var v = node.nodeValue;
    if (v.indexOf('^') === -1 && v.indexOf('sqrt') === -1 && v.indexOf('+/-') === -1 && v.indexOf('ᐟ') === -1) return;
    var ps = parts(v);
    if (ps.length === 1) { if (ps[0] !== v) node.nodeValue = ps[0]; return; }
    // Some exponents need a real superscript element: <sup> in HTML, a raised <tspan> in SVG
    var inSvg = p.namespaceURI === SVGNS, frag = document.createDocumentFragment();
    var raised = false;
    ps.forEach(function (x) {
      if (typeof x === 'string') {
        if (!x) return;
        if (inSvg && raised) {
          var back = document.createElementNS(SVGNS, 'tspan');
          back.setAttribute('dy', '0.32em');
          back.textContent = x;
          frag.appendChild(back);
          raised = false;
        } else frag.appendChild(document.createTextNode(x));
        return;
      }
      var el;
      if (inSvg) {
        el = document.createElementNS(SVGNS, 'tspan');
        el.setAttribute('font-size', '70%');
        el.setAttribute('dy', raised ? '0' : '-0.46em');
        raised = true;
      } else {
        el = document.createElement('sup');
      }
      el.textContent = x.sup;
      frag.appendChild(el);
    });
    p.replaceChild(frag, node);
  }

  function fixNode(node) {
    if (node.nodeType === 3) { fixText(node); return; }
    if (node.nodeType !== 1 || SKIP[node.nodeName.toUpperCase()]) return;
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    var n, list = [];
    while ((n = walker.nextNode())) list.push(n);
    list.forEach(fixText);
  }

  function start() {
    fixNode(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === 'characterData') fixText(m.target);
        else m.addedNodes.forEach(fixNode);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.abcNotation = fix; // for engines that build strings outside the DOM
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
