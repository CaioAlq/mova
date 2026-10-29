use crate::model::{Board, BoardSummary, GlobalTag};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// Pasta raiz dos dados do app: `MOVA_DATA_DIR`, se definida (os testes usam), senão
/// `<data_dir>/mova`. Os boards ficam em `boards/` e as tags em `tags.json`, dentro dela.
/// Cria a pasta se não existir.
pub fn data_root() -> Result<PathBuf, String> {
    let dir = match std::env::var("MOVA_DATA_DIR") {
        Ok(v) if !v.is_empty() => PathBuf::from(v),
        _ => {
            let mut dir = dirs::data_dir().ok_or("não foi possível resolver o diretório de dados")?;
            dir.push("mova");
            dir
        }
    };
    fs::create_dir_all(&dir).map_err(|e| format!("erro ao criar diretório: {e}"))?;
    Ok(dir)
}

/// Diretório dos boards: `data_root()/boards`. Em Linux, ~/.local/share/mova/boards.
/// Cria a pasta se não existir.
pub fn boards_dir() -> Result<PathBuf, String> {
    let mut dir = data_root()?;
    dir.push("boards");
    fs::create_dir_all(&dir).map_err(|e| format!("erro ao criar diretório: {e}"))?;
    Ok(dir)
}

/// Valida o id de um board: só aceita o formato padrão de UUID (minúsculo, com hífens,
/// como `Uuid::new_v4().to_string()`). Formatos como `{...}`, `urn:uuid:...`, sem hífens
/// ou em maiúsculo são recusados, para que cada board tenha um único nome de arquivo.
fn validar_id(id: &str) -> Result<(), String> {
    let uuid = Uuid::parse_str(id).map_err(|_| format!("id de painel inválido: {id:?}"))?;
    if uuid.hyphenated().to_string() != id {
        return Err(format!("id de board fora do formato padrão de UUID: {id:?}"));
    }
    Ok(())
}

/// Caminho do arquivo de um board. O id tem que ser UUID canônico: isso impede
/// path traversal (ex.: `../fora`) antes de qualquer acesso ao disco.
fn board_path(id: &str) -> Result<PathBuf, String> {
    validar_id(id)?;
    let mut dir = boards_dir()?;
    dir.push(format!("{id}.json"));
    Ok(dir)
}

/// Grava `content` em `path` de forma atômica: escreve num temporário na mesma pasta
/// e depois troca pelo definitivo com `rename`. Se algo falhar, o temporário é removido.
fn escrever_atomico(path: &Path, content: &str) -> std::io::Result<()> {
    let nome = path.file_name().and_then(|n| n.to_str()).unwrap_or("arquivo");
    let tmp = path.with_file_name(format!(".{nome}.{}.tmp", Uuid::new_v4()));
    if let Err(e) = fs::write(&tmp, content) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    if let Err(e) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(())
}

/// Lê todos os boards, retornando só id + nome para a sidebar.
/// Um arquivo corrompido é pulado (com log), sem derrubar a lista inteira.
pub fn list_boards() -> Result<Vec<BoardSummary>, String> {
    let dir = boards_dir()?;
    let mut summaries = Vec::new();

    for entry in fs::read_dir(&dir).map_err(|e| format!("erro ao ler diretório: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("painel ignorado, erro ao ler {path:?}: {e}");
                continue;
            }
        };
        // Parse parcial: só precisamos de id e name para o resumo.
        let board: Board = match serde_json::from_str(&content) {
            Ok(b) => b,
            Err(e) => {
                eprintln!("painel ignorado, JSON inválido em {path:?}: {e}");
                continue;
            }
        };
        summaries.push(BoardSummary {
            id: board.id,
            name: board.name,
        });
    }

    summaries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(summaries)
}

/// Carrega um board completo pelo id.
pub fn load_board(id: &str) -> Result<Board, String> {
    let path = board_path(id)?;
    let content =
        fs::read_to_string(&path).map_err(|e| format!("painel não encontrado: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("JSON inválido: {e}"))
}

/// Salva (cria ou sobrescreve) um board no disco, de forma atômica.
pub fn save_board(board: &Board) -> Result<(), String> {
    let path = board_path(&board.id)?;
    let json = serde_json::to_string_pretty(board).map_err(|e| e.to_string())?;
    escrever_atomico(&path, &json).map_err(|e| format!("erro ao salvar: {e}"))
}

/// Remove um board do disco.
pub fn delete_board(id: &str) -> Result<(), String> {
    let path = board_path(id)?;
    fs::remove_file(&path).map_err(|e| format!("erro ao remover: {e}"))
}

// ---------- Tags globais ----------

fn tags_path() -> Result<PathBuf, String> {
    let mut path = data_root()?;
    path.push("tags.json");
    Ok(path)
}

pub fn load_tags() -> Result<Vec<GlobalTag>, String> {
    let path = tags_path()?;
    if !path.exists() { return Ok(vec![]); }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| format!("JSON inválido: {e}"))
}

/// Salva as tags globais de forma atômica.
pub fn save_tags(tags: &[GlobalTag]) -> Result<(), String> {
    let path = tags_path()?;
    let json = serde_json::to_string_pretty(tags).map_err(|e| e.to_string())?;
    escrever_atomico(&path, &json).map_err(|e| format!("erro ao salvar tags: {e}"))
}

#[cfg(test)]
#[path = "storage_tests.rs"]
mod tests;
