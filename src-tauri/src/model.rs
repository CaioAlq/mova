use serde::{Deserialize, Serialize};

/// Prioridade do card.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
}

/// Uma tag/label colorida. A cor é um hex string (ex: "#e06c75").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub label: String,
    pub color: String,
}

/// Card individual. A descrição é markdown bruto; o frontend renderiza.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<Tag>,
    #[serde(default)]
    pub priority: Option<Priority>,
    /// Data de vencimento em ISO 8601 (ex: "2026-06-15"). Opcional.
    #[serde(default)]
    pub due_date: Option<String>,
    /// Status customizável livre (ex: "bloqueado", "em revisão").
    #[serde(default)]
    pub status: Option<String>,
    /// Card arquivado continua pertencendo ao board, mas filtrado da view.
    #[serde(default)]
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Coluna com lista ordenada de cards.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Column {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub cards: Vec<Card>,
    #[serde(default)]
    pub color: Option<String>,
}

/// Board com lista ordenada de colunas. Persistido como um arquivo JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Board {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub columns: Vec<Column>,
}

/// Metadado leve usado pela sidebar — evita carregar todos os boards inteiros.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardSummary {
    pub id: String,
    pub name: String,
}

/// Tag global — biblioteca compartilhada entre todos os boards.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalTag {
    pub id: String,
    pub label: String,
    pub color: String,
}
