use wasm_bindgen::prelude::*;

/// Run a trainer command by its Tauri name with JSON arguments; returns JSON, or the
/// command's error message (rejected promise on the JavaScript side, as with Tauri).
#[wasm_bindgen]
pub fn invoke(command: &str, args_json: &str) -> Result<String, JsValue> {
    let args: serde_json::Value =
        serde_json::from_str(args_json).map_err(|e| JsValue::from_str(&format!("bad arguments: {e}")))?;
    trainer_core::dispatch(command, &args)
        .map(|v| v.to_string())
        .map_err(|e| JsValue::from_str(&e))
}
