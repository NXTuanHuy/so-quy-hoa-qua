import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#F5F7F4',
  card: '#FFFFFF',
  text: '#1B1F1C',
  muted: '#6B746E',
  border: '#E1E6E2',
  primary: '#2E7D32',
  primarySoft: '#E8F5E9',
  warn: '#B26A00',
  warnSoft: '#FFF4E0',
  danger: '#C62828',
  dangerSoft: '#FDECEA',
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Cỡ chữ to (~+40%) cho người lớn tuổi dễ đọc.
  h1: { fontSize: 46, fontWeight: '700', color: colors.text },
  h2: { fontSize: 24, fontWeight: '600', color: colors.text },
  text: { fontSize: 22, color: colors.text },
  muted: { fontSize: 20, color: colors.muted },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  buttonGhost: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonGhostText: { color: colors.primary, fontSize: 22, fontWeight: '600' },
  // Thẻ cảnh báo (vàng) / nguy hiểm (đỏ): dùng cùng ui.card.
  cardWarn: { backgroundColor: colors.warnSoft, borderColor: colors.warn },
  cardDanger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 20, marginBottom: 8 },
  // Thanh nút cố định dưới đáy màn hình.
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  emptyText: { fontSize: 20, color: colors.muted, textAlign: 'center', marginTop: 32 },
});
