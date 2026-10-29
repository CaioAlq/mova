// Especifica a segurança do renderizador (src/markdown.js). O HTML que ele devolve vai para
// innerHTML numa janela com acesso aos comandos do Rust: nada do texto do card pode virar
// tag, atributo ou link executável.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/markdown.js';

const hasTag = (html, tag) => new RegExp(`<${tag}[\\s>]`, 'i').test(html);
const hasAttr = (html, attr) => new RegExp(`<[^>]*\\s${attr}\\s*=`, 'i').test(html);

test('tags no texto viram texto', () => {
  const html = renderMarkdown('oi <script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.equal(hasTag(html, 'script'), false);
  assert.equal(hasTag(html, 'img'), false);
  assert.match(html, /&lt;script&gt;/);
});

test('aspas no endereço do link não abrem atributo novo', () => {
  const html = renderMarkdown('[clique](https://x.test/" onmouseover="alert`1`)');
  assert.equal(hasAttr(html, 'onmouseover'), false);
});

test('aspas no texto viram entidade', () => {
  const html = renderMarkdown(`ele disse "oi" e 'tchau'`);
  assert.match(html, /&quot;oi&quot;/);
  assert.match(html, /&#39;tchau&#39;/);
});

for (const url of [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  'java&#115;cript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///etc/passwd',
  '//outro.test/x',
  'javascript:void//https://x.test',
]) {
  test(`link perigoso não vira link: ${url}`, () => {
    const html = renderMarkdown(`[abrir](${url})`);
    assert.equal(hasTag(html, 'a'), false, html);
    assert.match(html, /abrir/, 'o texto do link continua aparecendo');
  });
}

for (const url of ['https://exemplo.test/a?b=1&c=2', 'http://exemplo.test', 'mailto:ana@exemplo.test', 'HTTPS://exemplo.test', ' https://exemplo.test ']) {
  test(`link seguro vira link: ${url}`, () => {
    const html = renderMarkdown(`[abrir](${url})`);
    assert.equal(hasTag(html, 'a'), true, html);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
  });
}

test('& no endereço do link sai como &amp;', () => {
  const html = renderMarkdown('[a](https://x.test/?a=1&b=2)');
  assert.match(html, /href="https:\/\/x\.test\/\?a=1&amp;b=2"/);
});

test('texto do link é escapado', () => {
  const html = renderMarkdown('[<b>oi</b>](https://x.test)');
  assert.equal(hasTag(html, 'b'), false);
});

test('código inline e bloco de código são escapados', () => {
  const html = renderMarkdown('`<i>x</i>`\n\n```\n<script>y</script>\n```');
  assert.equal(hasTag(html, 'i'), false);
  assert.equal(hasTag(html, 'script'), false);
});

test('o markdown de sempre continua funcionando', () => {
  const html = renderMarkdown('# Título\n\n**forte** e *ênfase*\n\n- [x] feito\n- item\n\n> citação');
  assert.match(html, /<h1>Título<\/h1>/);
  assert.match(html, /<strong>forte<\/strong>/);
  assert.match(html, /<em>ênfase<\/em>/);
  assert.match(html, /<input type="checkbox" class="md-checkbox" data-idx="0" checked>/);
  assert.match(html, /<li>item<\/li>/);
  assert.match(html, /<blockquote>citação<\/blockquote>/);
});
