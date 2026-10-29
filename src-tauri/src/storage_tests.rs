// Especifica as regras de segurança e de robustez do storage.rs.
// Cada teste usa a própria pasta de dados (MOVA_DATA_DIR), para nunca tocar nos boards reais.
use super::*;
use crate::model::{Board, Column};
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

// MOVA_DATA_DIR é global no processo: os testes que mexem nele rodam um de cada vez.
static ENV_LOCK: Mutex<()> = Mutex::new(());

struct DataDir {
    path: PathBuf,
    _guard: std::sync::MutexGuard<'static, ()>,
}

impl Drop for DataDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
        std::env::remove_var("MOVA_DATA_DIR");
    }
}

fn data_dir() -> DataDir {
    let guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let path = std::env::temp_dir().join(format!("mova-test-{}", Uuid::new_v4()));
    fs::create_dir_all(&path).unwrap();
    std::env::set_var("MOVA_DATA_DIR", &path);
    let dir = DataDir { path, _guard: guard };
    // Trava de segurança: sem o MOVA_DATA_DIR, o teste para aqui em vez de gravar nos boards reais.
    assert_eq!(
        data_root().unwrap(),
        dir.path,
        "storage não usa MOVA_DATA_DIR; o teste parou para não mexer nos dados reais"
    );
    dir
}

fn board(id: &str, name: &str) -> Board {
    Board {
        id: id.into(),
        name: name.into(),
        columns: vec![Column { id: Uuid::new_v4().to_string(), name: "A fazer".into(), cards: vec![], color: None }],
    }
}

#[test]
fn mova_data_dir_decide_onde_ficam_boards_e_tags() {
    let dir = data_dir();
    assert_eq!(boards_dir().unwrap(), dir.path.join("boards"));
    save_tags(&[]).unwrap();
    assert!(dir.path.join("tags.json").exists());
}

#[test]
fn board_com_id_valido_vai_e_volta() {
    let _dir = data_dir();
    let id = Uuid::new_v4().to_string();
    save_board(&board(&id, "Casa")).unwrap();
    assert_eq!(load_board(&id).unwrap().name, "Casa");
    delete_board(&id).unwrap();
    assert!(load_board(&id).is_err());
}

#[test]
fn id_que_nao_e_uuid_e_recusado_em_tudo() {
    let _dir = data_dir();
    for id in ["../fora", "../../etc/passwd", "/tmp/x", "abc", "", "..", "x/../../y"] {
        assert!(load_board(id).is_err(), "load aceitou {id:?}");
        assert!(delete_board(id).is_err(), "delete aceitou {id:?}");
        assert!(save_board(&board(id, "x")).is_err(), "save aceitou {id:?}");
    }
}

#[test]
fn so_o_formato_padrao_de_uuid_vale() {
    let _dir = data_dir();
    let id = Uuid::new_v4();
    for outro in [format!("{{{id}}}"), format!("urn:uuid:{id}"), id.simple().to_string(), id.to_string().to_uppercase()] {
        assert!(save_board(&board(&outro, "x")).is_err(), "save aceitou {outro:?}");
    }
}

#[test]
fn save_com_id_malicioso_nao_grava_fora_da_pasta() {
    let dir = data_dir();
    let _ = save_board(&board("../fora", "x"));
    assert!(!dir.path.join("fora.json").exists());
    assert!(!dir.path.join("boards").join("..").join("fora.json").exists());
}

#[test]
fn delete_com_id_malicioso_nao_apaga_arquivo_de_fora() {
    let dir = data_dir();
    let alvo = dir.path.join("importante.json");
    fs::write(&alvo, "{}").unwrap();
    let _ = delete_board("../importante");
    assert!(alvo.exists(), "o delete apagou um arquivo fora da pasta de boards");
}

#[test]
fn board_corrompido_nao_derruba_a_lista() {
    let _dir = data_dir();
    let id = Uuid::new_v4().to_string();
    save_board(&board(&id, "Bom")).unwrap();
    fs::write(boards_dir().unwrap().join(format!("{}.json", Uuid::new_v4())), "{ isso não é json").unwrap();
    let lista = list_boards().unwrap();
    assert_eq!(lista.len(), 1);
    assert_eq!(lista[0].name, "Bom");
}

#[test]
fn salvar_nao_deixa_arquivo_temporario_para_tras() {
    let _dir = data_dir();
    let id = Uuid::new_v4().to_string();
    save_board(&board(&id, "Casa")).unwrap();
    save_board(&board(&id, "Casa 2")).unwrap();
    let arquivos: Vec<_> = fs::read_dir(boards_dir().unwrap()).unwrap().map(|e| e.unwrap().file_name()).collect();
    assert_eq!(arquivos, vec![std::ffi::OsString::from(format!("{id}.json"))]);
    assert_eq!(load_board(&id).unwrap().name, "Casa 2");
}
