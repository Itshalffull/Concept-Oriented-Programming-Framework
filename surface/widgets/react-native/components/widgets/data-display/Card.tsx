import React, { useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";

export interface CardProps {
  variant?: "elevated" | "filled" | "outlined"; clickable?: boolean; padding?: "none" | "sm" | "md" | "lg";
  title?: string; description?: string; header?: ReactNode; media?: ReactNode; footer?: ReactNode;
  actions?: ReactNode; onPress?: () => void; children?: ReactNode; style?: ViewStyle;
}
const padMap = { none: 0, sm: 8, md: 16, lg: 24 };

export const Card: React.FC<CardProps> = ({ variant = "elevated", clickable = false, padding = "md", title, description, header, media, footer, actions, onPress, children, style }) => {
  const [pressed, setPressed] = useState(false);
  const vs = variant === "elevated" ? styles.elevated : variant === "outlined" ? styles.outlined : styles.filled;
  const inner = (<>{header && <View style={styles.header}>{header}</View>}{!header && title && <View style={styles.header}><Text style={styles.title}>{title}</Text>{description && <Text style={styles.desc}>{description}</Text>}</View>}{media && <View style={styles.media}>{media}</View>}<View>{children}</View>{(footer || actions) && <View style={styles.footer}>{footer}{actions && <View style={styles.actions}>{actions}</View>}</View>}</>);
  if (clickable) return <Pressable onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} accessibilityRole="button" style={[styles.root, vs, { padding: padMap[padding], opacity: pressed ? 0.9 : 1 }, style]}>{inner}</Pressable>;
  return <View style={[styles.root, vs, { padding: padMap[padding] }, style]} accessibilityRole="summary">{inner}</View>;
};
const styles = StyleSheet.create({
  root: { borderRadius: 8, overflow: "hidden" }, elevated: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3 },
  outlined: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" }, filled: { backgroundColor: "#f1f5f9" },
  header: { marginBottom: 8 }, title: { fontSize: 16, fontWeight: "600", color: "#1e293b" }, desc: { fontSize: 13, color: "#64748b", marginTop: 2 }, media: { marginBottom: 8 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" }, actions: { flexDirection: "row", gap: 8 },
});
Card.displayName = "Card";
export default Card;
