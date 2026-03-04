import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface PaginationProps {
  page?: number;
  defaultPage?: number;
  totalPages: number;
  siblingCount?: number;
  disabled?: boolean;
  onPageChange?: (page: number) => void;
  style?: ViewStyle;
}

function computePages(current: number, total: number, siblings: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = [];
  const start = Math.max(2, current - siblings);
  const end = Math.min(total - 1, current + siblings);
  pages.push(1);
  if (start > 2) pages.push('ellipsis');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('ellipsis');
  if (total > 1) pages.push(total);
  return pages;
}

export const Pagination: React.FC<PaginationProps> = ({
  page: controlledPage,
  defaultPage = 1,
  totalPages,
  siblingCount = 1,
  disabled = false,
  onPageChange,
  style,
}) => {
  const [internalPage, setInternalPage] = useState(defaultPage);
  const currentPage = controlledPage ?? internalPage;

  const pages = useMemo(() => computePages(currentPage, totalPages, siblingCount), [currentPage, totalPages, siblingCount]);

  const goTo = useCallback((p: number) => {
    if (disabled || p < 1 || p > totalPages) return;
    setInternalPage(p);
    onPageChange?.(p);
  }, [disabled, totalPages, onPageChange]);

  return (
    <View style={[styles.root, style]} accessibilityRole="navigation" accessibilityLabel="Pagination">
      <Pressable onPress={() => goTo(currentPage - 1)} disabled={currentPage <= 1 || disabled} style={[styles.button, (currentPage <= 1 || disabled) && styles.disabled]} accessibilityLabel="Previous page">
        <Text style={styles.buttonText}>Prev</Text>
      </Pressable>
      {pages.map((p, i) => {
        if (p === 'ellipsis') return <Text key={`ell-${i}`} style={styles.ellipsis}>...</Text>;
        const isCurrent = p === currentPage;
        return (
          <Pressable key={p} onPress={() => goTo(p)} style={[styles.pageButton, isCurrent && styles.currentPage]} accessibilityLabel={`Page ${p}`}>
            <Text style={[styles.pageText, isCurrent && styles.currentPageText]}>{p}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => goTo(currentPage + 1)} disabled={currentPage >= totalPages || disabled} style={[styles.button, (currentPage >= totalPages || disabled) && styles.disabled]} accessibilityLabel="Next page">
        <Text style={styles.buttonText}>Next</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  button: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  buttonText: { fontSize: 13, color: '#475569' },
  disabled: { opacity: 0.4 },
  pageButton: { width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  currentPage: { backgroundColor: '#3b82f6' },
  pageText: { fontSize: 13, color: '#475569' },
  currentPageText: { color: '#fff', fontWeight: '600' },
  ellipsis: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 4 },
});

Pagination.displayName = 'Pagination';
export default Pagination;
