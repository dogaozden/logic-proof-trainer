use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use logic_core::models::{Proof, Theorem, UserStatistics};

/// Maximum length for portfolio notes (characters)
const MAX_NOTES_LENGTH: usize = 10_000;
/// Maximum length for theorem/entry names (characters)
const MAX_NAME_LENGTH: usize = 200;

/// A proof saved to the portfolio (completed or in-progress)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PortfolioEntry {
    pub id: String,
    pub proof: Proof,
    #[serde(alias = "completed_at")]  // Backward compatibility with existing entries
    pub saved_at: DateTime<Utc>,
    pub time_spent_secs: Option<u64>,
    pub steps_count: usize,
    pub hints_used: u32,
    pub notes: Option<String>,
}

impl PortfolioEntry {
    pub fn new(proof: Proof, time_spent_secs: Option<u64>, hints_used: u32) -> Self {
        let steps_count = proof.lines.len();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            proof,
            saved_at: Utc::now(),
            time_spent_secs,
            steps_count,
            hints_used,
            notes: None,
        }
    }
}

/// Data structure for export/import
#[derive(Serialize, Deserialize)]
pub struct ExportData {
    pub proofs: Vec<Proof>,
    pub custom_theorems: Vec<Theorem>,
    pub statistics: UserStatistics,
    pub portfolio: Vec<PortfolioEntry>,
}

/// Storage service for persisting data to disk
pub struct StorageService {
    data_dir: PathBuf,
}

#[derive(Debug)]
pub struct StorageError(pub String);

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Storage error: {}", self.0)
    }
}

impl std::error::Error for StorageError {}

impl From<std::io::Error> for StorageError {
    fn from(err: std::io::Error) -> Self {
        StorageError(err.to_string())
    }
}

impl From<serde_json::Error> for StorageError {
    fn from(err: serde_json::Error) -> Self {
        StorageError(err.to_string())
    }
}

impl StorageService {
    /// Validate an ID to prevent path traversal attacks.
    /// Only allows alphanumeric characters and hyphens (UUID-like format).
    fn validate_id(id: &str) -> Result<(), StorageError> {
        if id.is_empty() {
            return Err(StorageError("ID cannot be empty".to_string()));
        }
        if id.contains("..") || id.contains('/') || id.contains('\\') {
            return Err(StorageError("Invalid ID format: contains path traversal characters".to_string()));
        }
        // Only allow alphanumeric and hyphens (standard UUID format)
        if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err(StorageError("Invalid ID format: must be alphanumeric with hyphens only".to_string()));
        }
        Ok(())
    }

    pub fn new() -> Result<Self, StorageError> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| StorageError("Could not find data directory".to_string()))?
            .join("LogicProofTrainer");

        // Create directories if they don't exist
        fs::create_dir_all(&data_dir)?;
        fs::create_dir_all(data_dir.join("proofs"))?;
        fs::create_dir_all(data_dir.join("theorems"))?;
        fs::create_dir_all(data_dir.join("portfolio"))?;

        Ok(Self { data_dir })
    }

    fn proofs_dir(&self) -> PathBuf {
        self.data_dir.join("proofs")
    }

    fn theorems_dir(&self) -> PathBuf {
        self.data_dir.join("theorems")
    }

    fn portfolio_dir(&self) -> PathBuf {
        self.data_dir.join("portfolio")
    }

    fn statistics_file(&self) -> PathBuf {
        self.data_dir.join("statistics.json")
    }

    fn global_notes_file(&self) -> PathBuf {
        self.data_dir.join("global_notes.txt")
    }

    // Proof operations

    pub fn save_proof(&self, proof: &Proof) -> Result<(), StorageError> {
        Self::validate_id(&proof.id)?;
        let path = self.proofs_dir().join(format!("{}.json", proof.id));
        let json = serde_json::to_string_pretty(proof)?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn load_proof(&self, id: &str) -> Result<Proof, StorageError> {
        Self::validate_id(id)?;
        let path = self.proofs_dir().join(format!("{}.json", id));
        let json = fs::read_to_string(path)?;
        let proof: Proof = serde_json::from_str(&json)?;
        Ok(proof)
    }

    pub fn load_all_proofs(&self) -> Result<Vec<Proof>, StorageError> {
        let mut proofs = Vec::new();

        for entry in fs::read_dir(self.proofs_dir())? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(json) = fs::read_to_string(&path) {
                    if let Ok(proof) = serde_json::from_str::<Proof>(&json) {
                        proofs.push(proof);
                    }
                }
            }
        }

        Ok(proofs)
    }

    pub fn delete_proof(&self, id: &str) -> Result<(), StorageError> {
        Self::validate_id(id)?;
        let path = self.proofs_dir().join(format!("{}.json", id));
        if path.exists() {
            fs::remove_file(&path)?;
            // Verify deletion succeeded
            if path.exists() {
                return Err(StorageError("Failed to delete proof".to_string()));
            }
        } else {
            return Err(StorageError("Proof not found".to_string()));
        }
        Ok(())
    }

    // Custom theorem operations

    pub fn save_custom_theorem(&self, theorem: &Theorem) -> Result<(), StorageError> {
        Self::validate_id(&theorem.id)?;
        let path = self.theorems_dir().join(format!("{}.json", theorem.id));
        let json = serde_json::to_string_pretty(theorem)?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn load_custom_theorem(&self, id: &str) -> Result<Theorem, StorageError> {
        Self::validate_id(id)?;
        let path = self.theorems_dir().join(format!("{}.json", id));
        let json = fs::read_to_string(path)?;
        let theorem: Theorem = serde_json::from_str(&json)?;
        Ok(theorem)
    }

    pub fn load_all_custom_theorems(&self) -> Result<Vec<Theorem>, StorageError> {
        let mut theorems = Vec::new();

        for entry in fs::read_dir(self.theorems_dir())? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(json) = fs::read_to_string(&path) {
                    if let Ok(theorem) = serde_json::from_str::<Theorem>(&json) {
                        theorems.push(theorem);
                    }
                }
            }
        }

        Ok(theorems)
    }

    pub fn delete_custom_theorem(&self, id: &str) -> Result<(), StorageError> {
        Self::validate_id(id)?;
        let path = self.theorems_dir().join(format!("{}.json", id));
        if path.exists() {
            fs::remove_file(&path)?;
            // Verify deletion succeeded
            if path.exists() {
                return Err(StorageError("Failed to delete theorem".to_string()));
            }
        } else {
            return Err(StorageError("Theorem not found".to_string()));
        }
        Ok(())
    }

    // Statistics operations

    pub fn save_statistics(&self, stats: &UserStatistics) -> Result<(), StorageError> {
        let json = serde_json::to_string_pretty(stats)?;
        fs::write(self.statistics_file(), json)?;
        Ok(())
    }

    pub fn load_statistics(&self) -> Result<UserStatistics, StorageError> {
        let path = self.statistics_file();
        if !path.exists() {
            return Ok(UserStatistics::default());
        }

        let json = fs::read_to_string(path)?;
        let stats: UserStatistics = serde_json::from_str(&json)?;
        Ok(stats)
    }

    // Portfolio operations

    pub fn save_to_portfolio(&self, entry: &PortfolioEntry) -> Result<(), StorageError> {
        Self::validate_id(&entry.id)?;
        let path = self.portfolio_dir().join(format!("{}.json", entry.id));
        let json = serde_json::to_string_pretty(entry)?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn load_portfolio_entry(&self, id: &str) -> Result<PortfolioEntry, StorageError> {
        Self::validate_id(id)?;
        let path = self.portfolio_dir().join(format!("{}.json", id));
        let json = fs::read_to_string(path)?;
        let entry: PortfolioEntry = serde_json::from_str(&json)?;
        Ok(entry)
    }

    pub fn load_portfolio(&self) -> Result<Vec<PortfolioEntry>, StorageError> {
        let mut entries = Vec::new();

        if let Ok(dir_entries) = fs::read_dir(self.portfolio_dir()) {
            for entry in dir_entries {
                let entry = entry?;
                let path = entry.path();

                if path.extension().map_or(false, |ext| ext == "json") {
                    if let Ok(json) = fs::read_to_string(&path) {
                        if let Ok(portfolio_entry) = serde_json::from_str::<PortfolioEntry>(&json) {
                            entries.push(portfolio_entry);
                        }
                    }
                }
            }
        }

        // Sort by saved date, newest first
        entries.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
        Ok(entries)
    }

    pub fn delete_portfolio_entry(&self, id: &str) -> Result<(), StorageError> {
        Self::validate_id(id)?;
        let path = self.portfolio_dir().join(format!("{}.json", id));
        if path.exists() {
            fs::remove_file(&path)?;
            // Verify deletion succeeded
            if path.exists() {
                return Err(StorageError("Failed to delete portfolio entry".to_string()));
            }
        } else {
            return Err(StorageError("Portfolio entry not found".to_string()));
        }
        Ok(())
    }

    pub fn update_portfolio_notes(&self, id: &str, notes: String) -> Result<(), StorageError> {
        Self::validate_id(id)?;
        if notes.len() > MAX_NOTES_LENGTH {
            return Err(StorageError(format!(
                "Notes exceed maximum length of {} characters",
                MAX_NOTES_LENGTH
            )));
        }
        let mut entry = self.load_portfolio_entry(id)?;
        entry.notes = Some(notes);
        self.save_to_portfolio(&entry)?;
        Ok(())
    }

    pub fn rename_portfolio_entry(&self, id: &str, name: String) -> Result<(), StorageError> {
        Self::validate_id(id)?;
        if name.len() > MAX_NAME_LENGTH {
            return Err(StorageError(format!(
                "Name exceeds maximum length of {} characters",
                MAX_NAME_LENGTH
            )));
        }
        let mut entry = self.load_portfolio_entry(id)?;
        entry.proof.theorem.name = Some(name);
        self.save_to_portfolio(&entry)?;
        Ok(())
    }

    // Export/Import operations

    pub fn export_all(&self) -> Result<String, StorageError> {
        let data = ExportData {
            proofs: self.load_all_proofs()?,
            custom_theorems: self.load_all_custom_theorems()?,
            statistics: self.load_statistics()?,
            portfolio: self.load_portfolio()?,
        };

        let json = serde_json::to_string_pretty(&data)?;
        Ok(json)
    }

    pub fn import_all(&self, json: &str) -> Result<(), StorageError> {
        let data: ExportData = serde_json::from_str(json)?;

        for proof in &data.proofs {
            self.save_proof(proof)?;
        }

        for theorem in &data.custom_theorems {
            self.save_custom_theorem(theorem)?;
        }

        for entry in &data.portfolio {
            self.save_to_portfolio(entry)?;
        }

        self.save_statistics(&data.statistics)?;

        Ok(())
    }

    // Global notes operations

    pub fn load_global_notes(&self) -> Result<String, StorageError> {
        let path = self.global_notes_file();
        if path.exists() {
            Ok(fs::read_to_string(path)?)
        } else {
            Ok(String::new())
        }
    }

    pub fn save_global_notes(&self, notes: &str) -> Result<(), StorageError> {
        if notes.len() > MAX_NOTES_LENGTH {
            return Err(StorageError(format!(
                "Notes exceed maximum length of {} characters",
                MAX_NOTES_LENGTH
            )));
        }
        let path = self.global_notes_file();
        fs::write(path, notes)?;
        Ok(())
    }
}

impl Default for StorageService {
    fn default() -> Self {
        Self::new().expect("Failed to initialize storage service")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use logic_core::models::{Formula, theorem::Difficulty};
    use tempfile::tempdir;

    fn create_test_storage() -> StorageService {
        let temp = tempdir().unwrap();
        let storage = StorageService {
            data_dir: temp.into_path(),
        };
        // Create required subdirectories
        fs::create_dir_all(storage.proofs_dir()).unwrap();
        fs::create_dir_all(storage.theorems_dir()).unwrap();
        fs::create_dir_all(storage.portfolio_dir()).unwrap();
        storage
    }

    fn make_simple_theorem() -> Theorem {
        Theorem::new(
            vec![Formula::parse("P").unwrap()],
            Formula::parse("P").unwrap(),
            Difficulty::Easy,
            None,
            Some("Test Theorem".to_string()),
        )
    }

    fn make_simple_proof() -> Proof {
        Proof::new(make_simple_theorem())
    }

    // === ID Validation Tests (Security - Path Traversal Prevention) ===

    #[test]
    fn test_validate_id_rejects_empty() {
        let result = StorageService::validate_id("");
        assert!(result.is_err());
        assert!(result.unwrap_err().0.contains("empty"));
    }

    #[test]
    fn test_validate_id_rejects_path_traversal_dots() {
        let result = StorageService::validate_id("../../../etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().0.contains("path traversal"));
    }

    #[test]
    fn test_validate_id_rejects_forward_slash() {
        let result = StorageService::validate_id("some/path/id");
        assert!(result.is_err());
        assert!(result.unwrap_err().0.contains("path traversal"));
    }

    #[test]
    fn test_validate_id_rejects_backslash() {
        let result = StorageService::validate_id("some\\path\\id");
        assert!(result.is_err());
        assert!(result.unwrap_err().0.contains("path traversal"));
    }

    #[test]
    fn test_validate_id_accepts_valid_uuid() {
        let result = StorageService::validate_id("550e8400-e29b-41d4-a716-446655440000");
        assert!(result.is_ok());
    }

    // === Proof Operations Tests ===

    #[test]
    fn test_save_and_load_proof() {
        let storage = create_test_storage();

        let theorem = Theorem::new(
            vec![Formula::parse("P").unwrap()],
            Formula::parse("P").unwrap(),
            Difficulty::Easy,
            None,
            None,
        );
        let proof = Proof::new(theorem);
        let id = proof.id.clone();

        storage.save_proof(&proof).unwrap();
        let loaded = storage.load_proof(&id).unwrap();

        assert_eq!(loaded.id, id);
    }

    #[test]
    fn test_load_proof_nonexistent_returns_error() {
        let storage = create_test_storage();

        let result = storage.load_proof("nonexistent-id-12345");
        assert!(result.is_err());
    }

    #[test]
    fn test_load_all_proofs_skips_corrupted_json() {
        let storage = create_test_storage();

        // Save a valid proof
        let proof = make_simple_proof();
        storage.save_proof(&proof).unwrap();

        // Write a corrupted JSON file
        let corrupted_path = storage.proofs_dir().join("corrupted.json");
        fs::write(&corrupted_path, "{ invalid json !!!").unwrap();

        // load_all_proofs should skip the corrupted file
        let proofs = storage.load_all_proofs().unwrap();
        assert_eq!(proofs.len(), 1);
        assert_eq!(proofs[0].id, proof.id);
    }

    #[test]
    fn test_delete_proof_success() {
        let storage = create_test_storage();

        let proof = make_simple_proof();
        let id = proof.id.clone();
        storage.save_proof(&proof).unwrap();

        // Verify it exists
        assert!(storage.load_proof(&id).is_ok());

        // Delete it
        storage.delete_proof(&id).unwrap();

        // Verify it's gone
        assert!(storage.load_proof(&id).is_err());
    }

    // === Custom Theorem Operations Tests ===

    #[test]
    fn test_save_and_load_custom_theorem() {
        let storage = create_test_storage();

        let theorem = make_simple_theorem();
        let id = theorem.id.clone();

        storage.save_custom_theorem(&theorem).unwrap();
        let loaded = storage.load_custom_theorem(&id).unwrap();

        assert_eq!(loaded.id, id);
        assert_eq!(loaded.name, Some("Test Theorem".to_string()));
    }

    #[test]
    fn test_load_all_custom_theorems_multiple() {
        let storage = create_test_storage();

        // Save multiple theorems
        let theorem1 = make_simple_theorem();
        let theorem2 = Theorem::new(
            vec![Formula::parse("Q").unwrap()],
            Formula::parse("Q").unwrap(),
            Difficulty::Medium,
            None,
            Some("Second Theorem".to_string()),
        );

        storage.save_custom_theorem(&theorem1).unwrap();
        storage.save_custom_theorem(&theorem2).unwrap();

        let theorems = storage.load_all_custom_theorems().unwrap();
        assert_eq!(theorems.len(), 2);
    }

    #[test]
    fn test_delete_custom_theorem_success() {
        let storage = create_test_storage();

        let theorem = make_simple_theorem();
        let id = theorem.id.clone();
        storage.save_custom_theorem(&theorem).unwrap();

        // Verify it exists
        assert!(storage.load_custom_theorem(&id).is_ok());

        // Delete it
        storage.delete_custom_theorem(&id).unwrap();

        // Verify it's gone
        assert!(storage.load_custom_theorem(&id).is_err());
    }

    // === Portfolio Operations Tests ===

    #[test]
    fn test_save_and_load_portfolio_entry() {
        let storage = create_test_storage();

        let proof = make_simple_proof();
        let entry = PortfolioEntry::new(proof, Some(120), 0);
        let id = entry.id.clone();

        storage.save_to_portfolio(&entry).unwrap();
        let loaded = storage.load_portfolio_entry(&id).unwrap();

        assert_eq!(loaded.id, id);
        assert_eq!(loaded.time_spent_secs, Some(120));
    }

    #[test]
    fn test_load_portfolio_sorted_by_date() {
        let storage = create_test_storage();

        // Create entries with different timestamps
        let proof1 = make_simple_proof();
        let mut entry1 = PortfolioEntry::new(proof1, Some(60), 0);

        let proof2 = make_simple_proof();
        let mut entry2 = PortfolioEntry::new(proof2, Some(120), 0);

        // Manually set dates to ensure ordering
        entry1.saved_at = chrono::Utc::now() - chrono::Duration::hours(2);
        entry2.saved_at = chrono::Utc::now();

        storage.save_to_portfolio(&entry1).unwrap();
        storage.save_to_portfolio(&entry2).unwrap();

        let portfolio = storage.load_portfolio().unwrap();
        assert_eq!(portfolio.len(), 2);
        // Newest first
        assert_eq!(portfolio[0].id, entry2.id);
        assert_eq!(portfolio[1].id, entry1.id);
    }

    #[test]
    fn test_update_portfolio_notes_exceeds_max_length() {
        let storage = create_test_storage();

        let proof = make_simple_proof();
        let entry = PortfolioEntry::new(proof, None, 0);
        let id = entry.id.clone();
        storage.save_to_portfolio(&entry).unwrap();

        // Try to update with notes that exceed max length
        let long_notes = "x".repeat(MAX_NOTES_LENGTH + 1);
        let result = storage.update_portfolio_notes(&id, long_notes);

        assert!(result.is_err());
        assert!(result.unwrap_err().0.contains("maximum length"));
    }

    #[test]
    fn test_rename_portfolio_entry_exceeds_max_length() {
        let storage = create_test_storage();

        let proof = make_simple_proof();
        let entry = PortfolioEntry::new(proof, None, 0);
        let id = entry.id.clone();
        storage.save_to_portfolio(&entry).unwrap();

        // Try to rename with name that exceeds max length
        let long_name = "x".repeat(MAX_NAME_LENGTH + 1);
        let result = storage.rename_portfolio_entry(&id, long_name);

        assert!(result.is_err());
        assert!(result.unwrap_err().0.contains("maximum length"));
    }

    // === Export/Import Operations Tests ===

    #[test]
    fn test_export_all_includes_all_data() {
        let storage = create_test_storage();

        // Save various data types
        let proof = make_simple_proof();
        storage.save_proof(&proof).unwrap();

        let theorem = make_simple_theorem();
        storage.save_custom_theorem(&theorem).unwrap();

        let entry = PortfolioEntry::new(make_simple_proof(), Some(300), 1);
        storage.save_to_portfolio(&entry).unwrap();

        let mut stats = UserStatistics::new();
        stats.total_proofs_completed = 5;
        storage.save_statistics(&stats).unwrap();

        // Export all
        let json = storage.export_all().unwrap();

        // Verify JSON contains expected data
        assert!(json.contains(&proof.id));
        assert!(json.contains(&theorem.id));
        assert!(json.contains(&entry.id));
        // Serde uses snake_case by default for Rust field names
        assert!(json.contains("total_proofs_completed"), "JSON should contain total_proofs_completed field");
        assert!(json.contains("5") || json.contains(": 5"), "JSON should contain value 5");
    }

    #[test]
    fn test_import_all_round_trip() {
        let storage1 = create_test_storage();

        // Save data to first storage
        let proof = make_simple_proof();
        let proof_id = proof.id.clone();
        storage1.save_proof(&proof).unwrap();

        let theorem = make_simple_theorem();
        let theorem_id = theorem.id.clone();
        storage1.save_custom_theorem(&theorem).unwrap();

        // Export
        let json = storage1.export_all().unwrap();

        // Import to fresh storage
        let storage2 = create_test_storage();
        storage2.import_all(&json).unwrap();

        // Verify data was imported
        let loaded_proof = storage2.load_proof(&proof_id).unwrap();
        assert_eq!(loaded_proof.id, proof_id);

        let loaded_theorem = storage2.load_custom_theorem(&theorem_id).unwrap();
        assert_eq!(loaded_theorem.id, theorem_id);
    }

    // === Global Notes Operations Tests ===

    #[test]
    fn test_load_global_notes_empty_when_missing() {
        let storage = create_test_storage();

        let notes = storage.load_global_notes().unwrap();
        assert!(notes.is_empty());
    }

    #[test]
    fn test_save_global_notes_exceeds_max_length_rejected() {
        let storage = create_test_storage();

        let long_notes = "x".repeat(MAX_NOTES_LENGTH + 1);
        let result = storage.save_global_notes(&long_notes);

        assert!(result.is_err());
        assert!(result.unwrap_err().0.contains("maximum length"));
    }

    // === Original Tests ===

    #[test]
    fn test_statistics() {
        let storage = create_test_storage();

        let mut stats = UserStatistics::new();
        stats.total_proofs_attempted = 10;
        stats.total_proofs_completed = 7;

        storage.save_statistics(&stats).unwrap();
        let loaded = storage.load_statistics().unwrap();

        assert_eq!(loaded.total_proofs_attempted, 10);
        assert_eq!(loaded.total_proofs_completed, 7);
    }
}
