// Renderizador markdown mínimo, sem dependências.
// Cobre o essencial: headings, bold, italic, code, listas, links, blockquote, hr.
// Para algo mais robusto depois, troque por `marked` ou `markdown-it`.

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Só estes endereços viram link. Qualquer outro (javascript:, data:, file:, //host...)
// vira só o texto do link.
const LINK_PERMITIDO = /^(https?:\/\/|mailto:)/i;
// Endereço válido não tem espaço nem aspas/colchetes angulares (depois do escape).
// Isso impede que o endereço escreva atributos novos dentro do href.
const LINK_CARACTERE_PROIBIDO = /\s|&quot;|&#39;|&lt;|&gt;|[<>]/;

function inline(text) {
  // code inline primeiro (protege o conteúdo)
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // bold
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  // links [texto](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, texto, url) => {
    const destino = url.trim();
    if (!LINK_PERMITIDO.test(destino) || LINK_CARACTERE_PROIBIDO.test(destino)) {
      return texto;
    }
    return `<a href="${destino}" target="_blank" rel="noopener noreferrer">${texto}</a>`;
  });
  return text;
}

export function renderMarkdown(src) {
  if (!src || !src.trim()) {
    return '<p style="color:var(--text-dim)">Sem descrição.</p>';
  }

  const lines = src.split("\n");
  const out = [];
  let inCode  = false;
  let codeBuf = [];
  let listType = null; // "ul" | "ol" | null
  let cbIdx   = 0;    // índice global de checkboxes no documento

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (let raw of lines) {
    // fenced code block
    if (raw.trim().startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }

    const line = raw.trimEnd();

    // hr
    if (/^---+$/.test(line.trim())) {
      closeList();
      out.push("<hr>");
      continue;
    }
    // headings
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(escapeHtml(h[2]))}</h${lvl}>`);
      continue;
    }
    // blockquote
    if (line.startsWith("> ")) {
      closeList();
      out.push(`<blockquote>${inline(escapeHtml(line.slice(2)))}</blockquote>`);
      continue;
    }
    // checkbox list item — deve vir antes do unordered list genérico
    const cb = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
    if (cb) {
      if (listType !== "ul") {
        closeList();
        out.push('<ul class="task-list">');
        listType = "ul";
      }
      const checked = cb[1].toLowerCase() === "x";
      const text    = inline(escapeHtml(cb[2]));
      out.push(
        `<li class="task-item">` +
        `<input type="checkbox" class="md-checkbox" data-idx="${cbIdx++}"${checked ? " checked" : ""}>` +
        `<span class="${checked ? "task-done" : ""}">${text}</span>` +
        `</li>`
      );
      continue;
    }
    // unordered list
    if (/^[-*]\s+/.test(line)) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(escapeHtml(line.replace(/^[-*]\s+/, "")))}</li>`);
      continue;
    }
    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(escapeHtml(line.replace(/^\d+\.\s+/, "")))}</li>`);
      continue;
    }
    // blank line
    if (line.trim() === "") {
      closeList();
      continue;
    }
    // paragraph
    closeList();
    out.push(`<p>${inline(escapeHtml(line))}</p>`);
  }

  closeList();
  if (inCode) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
  }
  return out.join("\n");
}
