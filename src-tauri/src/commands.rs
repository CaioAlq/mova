use crate::model::*;
use crate::storage;
use chrono::Utc;
use uuid::Uuid;

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

// ---------- Boards ----------

#[tauri::command]
pub fn list_boards() -> Result<Vec<BoardSummary>, String> {
    storage::list_boards()
}

#[tauri::command]
pub fn get_board(id: String) -> Result<Board, String> {
    storage::load_board(&id)
}

#[tauri::command]
pub fn create_board(name: String) -> Result<Board, String> {
    let board = Board {
        id: new_id(),
        name,
        columns: vec![
            Column { id: new_id(), color: None, name: "A fazer".into(), cards: vec![] },
            Column { id: new_id(), color: None, name: "Fazendo".into(), cards: vec![] },
            Column { id: new_id(), color: None, name: "Feito".into(), cards: vec![] },
        ],
    };
    storage::save_board(&board)?;
    Ok(board)
}

#[tauri::command]
pub fn rename_board(id: String, name: String) -> Result<Board, String> {
    let mut board = storage::load_board(&id)?;
    board.name = name;
    storage::save_board(&board)?;
    Ok(board)
}

#[tauri::command]
pub fn delete_board(id: String) -> Result<(), String> {
    storage::delete_board(&id)
}

/// Persiste o board inteiro. Usado para operações de reordenação
/// (mover cards entre colunas, reordenar colunas) onde o frontend
/// já tem o estado novo e só precisa gravar.
#[tauri::command]
pub fn save_board(board: Board) -> Result<(), String> {
    storage::save_board(&board)
}

// ---------- Colunas ----------

#[tauri::command]
pub fn add_column(board_id: String, name: String) -> Result<Board, String> {
    let mut board = storage::load_board(&board_id)?;
    board.columns.push(Column { id: new_id(), color: None, name, cards: vec![] });
    storage::save_board(&board)?;
    Ok(board)
}

#[tauri::command]
pub fn rename_column(board_id: String, column_id: String, name: String) -> Result<Board, String> {
    let mut board = storage::load_board(&board_id)?;
    if let Some(col) = board.columns.iter_mut().find(|c| c.id == column_id) {
        col.name = name;
    }
    storage::save_board(&board)?;
    Ok(board)
}

#[tauri::command]
pub fn delete_column(board_id: String, column_id: String) -> Result<Board, String> {
    let mut board = storage::load_board(&board_id)?;
    board.columns.retain(|c| c.id != column_id);
    storage::save_board(&board)?;
    Ok(board)
}

// ---------- Cards ----------

#[tauri::command]
pub fn add_card(board_id: String, column_id: String, title: String) -> Result<Board, String> {
    let mut board = storage::load_board(&board_id)?;
    let ts = now_iso();
    if let Some(col) = board.columns.iter_mut().find(|c| c.id == column_id) {
        col.cards.push(Card {
            id: new_id(),
            title,
            description: String::new(),
            tags: vec![],
            priority: None,
            due_date: None,
            status: None,
            archived: false,
            created_at: ts.clone(),
            updated_at: ts,
        });
    }
    storage::save_board(&board)?;
    Ok(board)
}

/// Atualiza um card por completo (título, descrição markdown, flags).
/// O frontend manda o card editado; o backend acha pelo id e substitui.
#[tauri::command]
pub fn update_card(board_id: String, card: Card) -> Result<Board, String> {
    let mut board = storage::load_board(&board_id)?;
    let mut updated = card;
    updated.updated_at = now_iso();

    for col in board.columns.iter_mut() {
        if let Some(existing) = col.cards.iter_mut().find(|c| c.id == updated.id) {
            // preserva created_at original
            updated.created_at = existing.created_at.clone();
            *existing = updated;
            break;
        }
    }
    storage::save_board(&board)?;
    Ok(board)
}

#[tauri::command]
pub fn archive_card(board_id: String, card_id: String, archived: bool) -> Result<Board, String> {
    let mut board = storage::load_board(&board_id)?;
    for col in board.columns.iter_mut() {
        if let Some(card) = col.cards.iter_mut().find(|c| c.id == card_id) {
            card.archived = archived;
            card.updated_at = now_iso();
            break;
        }
    }
    storage::save_board(&board)?;
    Ok(board)
}

#[tauri::command]
pub fn delete_card(board_id: String, card_id: String) -> Result<Board, String> {
    let mut board = storage::load_board(&board_id)?;
    for col in board.columns.iter_mut() {
        col.cards.retain(|c| c.id != card_id);
    }
    storage::save_board(&board)?;
    Ok(board)
}

// ---------- Tags globais ----------

#[tauri::command]
pub fn list_tags() -> Result<Vec<GlobalTag>, String> {
    storage::load_tags()
}

#[tauri::command]
pub fn create_tag(label: String, color: String) -> Result<Vec<GlobalTag>, String> {
    let mut tags = storage::load_tags()?;
    tags.push(GlobalTag { id: new_id(), label, color });
    storage::save_tags(&tags)?;
    Ok(tags)
}

#[tauri::command]
pub fn delete_tag(id: String) -> Result<Vec<GlobalTag>, String> {
    let mut tags = storage::load_tags()?;
    tags.retain(|t| t.id != id);
    storage::save_tags(&tags)?;
    Ok(tags)
}
