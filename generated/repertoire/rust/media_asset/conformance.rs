// generated: media_asset/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::MediaAssetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn media_asset_invariant_1() {
        // invariant 1: after createMedia, extractMetadata, getMedia behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let a = "u-test-invariant-001".to_string();
        let s = "u-test-invariant-002".to_string();
        let f = "u-test-invariant-003".to_string();
        let m = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // createMedia(asset: a, source: s, file: f) -> ok(asset: a)
        let step1 = handler.create_media(
            CreateMediaInput { asset: a.clone(), source: s.clone(), file: f.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateMediaOutput::Ok { asset, .. } => {
                assert_eq!(asset, a.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // extractMetadata(asset: a) -> ok(metadata: m)
        let step2 = handler.extract_metadata(
            ExtractMetadataInput { asset: a.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ExtractMetadataOutput::Ok { metadata, .. } => {
                assert_eq!(metadata, m.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // getMedia(asset: a) -> ok(asset: a, metadata: m, thumbnail: _)
        let step3 = handler.get_media(
            GetMediaInput { asset: a.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            GetMediaOutput::Ok { asset, metadata, thumbnail, .. } => {
                assert_eq!(asset, a.clone());
                assert_eq!(metadata, m.clone());
                assert_eq!(thumbnail, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
