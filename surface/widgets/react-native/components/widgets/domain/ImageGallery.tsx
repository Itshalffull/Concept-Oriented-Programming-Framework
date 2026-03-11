import React, { useState, useCallback } from 'react';
import { View, Image, Text, Pressable, ScrollView, Modal, StyleSheet, type ViewStyle, Dimensions } from 'react-native';

export interface GalleryImage { id: string; src: string; alt?: string; thumbnail?: string; }

export interface ImageGalleryProps {
  images: GalleryImage[]; columns?: number;
  onImageSelect?: (id: string) => void; style?: ViewStyle;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, columns = 3, onImageSelect, style }) => {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const imgSize = (SCREEN_WIDTH - 24 - (columns - 1) * 4) / columns;

  return (
    <View style={[styles.root, style]}>
      <View style={styles.grid}>{images.map((img, i) => (
        <Pressable key={img.id} onPress={() => { setLightboxIdx(i); onImageSelect?.(img.id); }} style={{ width: imgSize, height: imgSize, margin: 2 }}>
          <Image source={{ uri: img.thumbnail || img.src }} style={styles.thumb} accessibilityLabel={img.alt || 'Image'} />
        </Pressable>
      ))}</View>
      <Modal visible={lightboxIdx !== null} transparent animationType="fade" onRequestClose={() => setLightboxIdx(null)}>
        <Pressable style={styles.overlay} onPress={() => setLightboxIdx(null)}>
          {lightboxIdx !== null && <Image source={{ uri: images[lightboxIdx].src }} style={styles.fullImage} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { padding: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  thumb: { width: '100%', height: '100%', borderRadius: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '90%', height: '80%' },
});

ImageGallery.displayName = 'ImageGallery';
export default ImageGallery;
