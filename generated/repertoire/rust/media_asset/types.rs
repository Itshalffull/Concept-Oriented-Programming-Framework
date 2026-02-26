// generated: media_asset/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaAssetCreateMediaInput {
    pub asset: String,
    pub source: String,
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MediaAssetCreateMediaOutput {
    Ok {
        asset: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaAssetExtractMetadataInput {
    pub asset: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MediaAssetExtractMetadataOutput {
    Ok {
        metadata: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaAssetGenerateThumbnailInput {
    pub asset: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MediaAssetGenerateThumbnailOutput {
    Ok {
        thumbnail: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaAssetGetMediaInput {
    pub asset: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MediaAssetGetMediaOutput {
    Ok {
        asset: String,
        metadata: String,
        thumbnail: String,
    },
    Notfound {
        message: String,
    },
}

