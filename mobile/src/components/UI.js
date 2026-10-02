import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { logo } from '../constants/assets';

export function Page({ children, scroll = true, refreshing = false, onRefresh = undefined, contentStyle = undefined, keyboard = false }) {
  const content = scroll
    ? <ScrollView
        contentContainerStyle={[styles.pageContent, contentStyle]}
        keyboardShouldPersistTaps={keyboard ? 'handled' : 'never'}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}
      >{children}</ScrollView>
    : <View style={[styles.pageContent, styles.fixedPage, contentStyle]}>{children}</View>;
  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>{content}</SafeAreaView>;
}

export function BrandHeader({ eyebrow = 'ERP modular', title, subtitle }) {
  return <View style={styles.brandHeader}>
    <View style={styles.brandRow}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <View style={styles.brandCopy}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.brandName}>YordanUp</Text></View>
    </View>
    {title ? <Text style={styles.pageTitle}>{title}</Text> : null}
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>;
}

export function Card({ children, style = undefined }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action = undefined }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{action || null}</View>;
}

export function Pill({ children, tone = 'neutral' }) {
  return <View style={[styles.pill, tone === 'demo' && styles.pillDemo, tone === 'success' && styles.pillSuccess]}><Text style={[styles.pillText, tone === 'demo' && styles.pillDemoText, tone === 'success' && styles.pillSuccessText]}>{children}</Text></View>;
}

export function Button({ title, onPress, variant = 'primary', disabled = false, loading = false, style = undefined, accessibilityLabel = undefined }) {
  const secondary = variant === 'secondary';
  const danger = variant === 'danger';
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || title}
    onPress={onPress}
    disabled={disabled || loading}
    style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, danger && styles.buttonDanger, (disabled || loading) && styles.buttonDisabled, pressed && styles.buttonPressed, style]}
  >
    {loading ? <ActivityIndicator color={secondary ? colors.brand : '#fff'} /> : <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText, danger && styles.buttonDangerText]}>{title}</Text>}
  </Pressable>;
}

export function Field({ label, value = '', onChangeText = undefined, placeholder = undefined, keyboardType = undefined, secureTextEntry = false, multiline = false, autoCapitalize = undefined, editable = true }) {
  return <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      value={value == null ? '' : String(value)}
      onChangeText={onChangeText}
      placeholder={placeholder || label}
      placeholderTextColor="#95A1B2"
      keyboardType={keyboardType || 'default'}
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      autoCapitalize={autoCapitalize || 'sentences'}
      editable={editable}
      style={[styles.input, multiline && styles.multilineInput, !editable && styles.inputDisabled]}
    />
  </View>;
}

export function Notice({ children, tone = 'info' }) {
  const warning = tone === 'warning';
  const error = tone === 'error';
  return <View style={[styles.notice, warning && styles.noticeWarning, error && styles.noticeError]}><Text style={[styles.noticeText, warning && styles.noticeWarningText, error && styles.noticeErrorText]}>{children}</Text></View>;
}

export function LoadingPanel({ title = 'Cargando…', detail = 'Consultando el ERP.' }) {
  return <View style={styles.loadingPanel}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.loadingTitle}>{title}</Text><Text style={styles.subtitle}>{detail}</Text></View>;
}

export function EmptyPanel({ title, detail }) {
  return <View style={styles.emptyPanel}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.subtitle}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  pageContent: { padding: 20, paddingBottom: 32, gap: 16 },
  fixedPage: { flex: 1 },
  brandHeader: { gap: 8, marginBottom: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 52, height: 44 },
  brandCopy: { gap: 1 },
  eyebrow: { color: colors.inkMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  brandName: { color: colors.brand, fontWeight: '800', fontSize: 16 },
  pageTitle: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 8 },
  subtitle: { color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  pill: { alignSelf: 'flex-start', backgroundColor: '#EDF1F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  pillDemo: { backgroundColor: colors.warningLight },
  pillDemoText: { color: colors.warning },
  pillSuccess: { backgroundColor: colors.mintLight },
  pillSuccessText: { color: colors.success },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, borderRadius: 12, paddingHorizontal: 16 },
  buttonSecondary: { backgroundColor: '#EAF0F6', borderWidth: 1, borderColor: '#D8E1EA' },
  buttonDanger: { backgroundColor: colors.dangerLight },
  buttonDisabled: { opacity: 0.58 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  buttonSecondaryText: { color: colors.brand },
  buttonDangerText: { color: colors.danger },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', paddingHorizontal: 13, color: colors.ink, fontSize: 15 },
  multilineInput: { minHeight: 94, textAlignVertical: 'top', paddingTop: 12 },
  inputDisabled: { color: colors.inkMuted, backgroundColor: colors.canvas },
  notice: { borderRadius: 12, backgroundColor: '#EAF2FC', borderWidth: 1, borderColor: '#D7E5F5', padding: 13 },
  noticeWarning: { backgroundColor: colors.warningLight, borderColor: '#F2DEA8' },
  noticeError: { backgroundColor: colors.dangerLight, borderColor: '#F2C8C8' },
  noticeText: { color: colors.brand, fontSize: 13, lineHeight: 19 },
  noticeWarningText: { color: colors.warning },
  noticeErrorText: { color: colors.danger },
  loadingPanel: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 12 },
  loadingTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  emptyPanel: { alignItems: 'center', paddingVertical: 28, gap: 7 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' }
});
