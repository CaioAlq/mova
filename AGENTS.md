# Mova — regras do projeto

Kanban pessoal, leve e local, para desktop. Backend em Rust + Tauri v2 (dados em JSON),
frontend em JavaScript puro, sem bundler, com tema escuro.

## Arquitetura

```
src-tauri/                backend em Rust
  src/model.rs            estruturas: Board, Column, Card, Tag, Priority
  src/storage.rs          leitura e gravação dos JSON em disco
  src/storage_tests.rs    testes do storage.rs
  src/commands.rs         comandos expostos ao frontend (#[tauri::command])
  src/lib.rs              registra os comandos
  icons/                  ícones do app (gerados a partir de icon.png)
  tauri.conf.json         janela, CSP e bundle
  capabilities/           permissões (Tauri v2)
src/                      frontend
  index.html              estrutura da tela
  styles.css              tema escuro
  markdown.js             renderizador de Markdown sem dependências
  main.js                 estado, renderização, arrastar e soltar, modais
test/                     testes do frontend (node --test)
```

**O frontend nunca toca o disco.** Toda leitura e gravação passa por `invoke("comando", {...})`
→ um `#[tauri::command]` em `commands.rs` → `storage.rs` → arquivo JSON. A maioria dos comandos
devolve o painel inteiro atualizado, e o frontend renderiza de novo a partir dele.

## Dados

- Pasta raiz: `MOVA_DATA_DIR`, se definida; senão a pasta de dados do sistema + `mova/`
  (`dirs::data_dir()`).
- Um arquivo por painel em `boards/<uuid>.json`, e as tags globais em `tags.json`.
- Cards arquivados ficam no próprio painel com `archived: true`: o "Arquivo" é um filtro, não
  um painel separado.
- A gravação é atômica (arquivo temporário + `rename`), e um JSON corrompido é pulado na lista.

**Nunca rode testes nem scripts contra a pasta de dados real.** Os testes do Rust usam uma pasta
temporária via `MOVA_DATA_DIR` e param antes de gravar se ela não for respeitada.

## Comandos

| Comando | Para quê |
|---|---|
| `npm install` | instala as dependências do frontend e a CLI do Tauri |
| `npm run dev` | abre o app em modo de desenvolvimento |
| `npm run build` | gera o instalador |
| `npm test` | testes do frontend (`node --test`) |
| `cd src-tauri && cargo test` | testes do backend |

## Testes primeiro

Todo comportamento novo começa por um teste que falha: `test/<arquivo>.test.js` para o frontend,
`src-tauri/src/<modulo>_tests.rs` para o backend. Mudar um teste para ele passar é mudar uma
decisão: pergunte antes. A tarefa só está pronta com `npm test` e `cargo test` passando.

## Segurança

O texto dos cards é tratado como não confiável: o HTML do Markdown vai para `innerHTML` numa
janela que pode chamar comandos do Rust.

- `markdown.js` escapa `& < > " '` e só cria link para `http://`, `https://` e `mailto:`.
  Qualquer outro endereço vira só o texto.
- Texto do usuário entra no DOM por `textContent` (helper `el()`), nunca por `innerHTML`.
- A CSP do `tauri.conf.json` não permite script de fora nem inline. Não afrouxe a CSP: ajuste o
  código.
- Todo id de painel precisa ser um UUID no formato padrão (minúsculo, com hífens). Isso impede
  gravar ou apagar arquivos fora da pasta de dados.

## Fatos do ambiente

- **`dragDropEnabled: false`** no `tauri.conf.json` é obrigatório: com ele ligado, o Tauri usa o
  soltar de arquivos do sistema e o arrastar e soltar HTML5 dos cards e colunas para de funcionar.
- **A pasta `src-tauri/icons/` precisa da exceção no `.gitignore`.** A regra global comum
  `Icon?` (arquivo do macOS) também pega `icons` em sistemas que não diferenciam maiúsculas.
- A janela usa a barra nativa com `titleBarStyle: "Overlay"`: os botões nativos ficam no canto
  superior esquerdo, e os cabeçalhos do topo têm `data-tauri-drag-region` para arrastar a janela.

## Idioma

- **Tudo o que o usuário vê é em português**, e o nome da coisa é **painel** (nunca "board" na
  interface, nas mensagens de erro ou no README).
- Identificadores no código são em inglês (`Board`, `board_id`, `boards/`), e os comentários são
  em português.
