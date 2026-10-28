import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';

import { AsyncStatus } from '@/components/StateView';
import { bankListener } from '@/data/ingest';
import { addPerson, listPeople, removePerson } from '@/data/people';
import { getKv, listUnparsed } from '@/data/repo';
import { supabase } from '@/data/supabase';
import { formatTime } from '@/domain/text';
import type { PersonRole } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useApp } from '@/state/AppContext';
import { runSafely } from '@/ui/runSafely';
import { colors, ui } from '@/ui/theme';

// Màn "Cài đặt": tên người dùng, quyền đọc thông báo, đồng bộ, thông báo chưa đọc được.
export default function SettingsScreen() {
  const { db, owner, setOwner, permissionGranted, sync, refresh, version } = useApp();
  const listener = bankListener;
  // null = không ở chế độ sửa → chỉ hiển thị tên đang lưu và nút "Sửa".
  const [draft, setDraft] = useState<string | null>(null);

  // Danh sách mẫu chỉ đổi khi có dữ liệu mới; mốc đồng bộ chỉ đổi theo trạng thái đồng bộ.
  const unparsed = useAsync(() => listUnparsed(db), [db, version]);
  const lastSync = useAsync(() => getKv(db, 'last_sync_at'), [db, sync.state]);
  const keyboard = useKeyboardHeight();

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ paddingBottom: 32 + keyboard }} keyboardShouldPersistTaps="handled">
      <View style={ui.card}>
        <Text style={ui.h2}>Tên người dùng máy này</Text>
        <Text style={ui.muted}>Dùng để ghi lịch sử sửa (ai sửa).</Text>
        {draft === null ? (
          <View style={styles.nameRow}>
            <Text style={[ui.text, styles.nameText]}>{owner}</Text>
            <Pressable style={ui.buttonGhost} onPress={() => setDraft(owner)} accessibilityRole="button">
              <Text style={ui.buttonGhostText}>Sửa</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Ví dụ: Chủ Lan"
              autoFocus
            />
            <Pressable
              style={ui.button}
              onPress={() =>
                runSafely(async () => {
                  await setOwner(draft);
                  setDraft(null);
                })
              }
              accessibilityRole="button"
            >
              <Text style={ui.buttonText}>Lưu tên</Text>
            </Pressable>
            <Pressable style={[ui.buttonGhost, { marginTop: 8 }]} onPress={() => setDraft(null)} accessibilityRole="button">
              <Text style={ui.buttonGhostText}>Huỷ</Text>
            </Pressable>
          </>
        )}
      </View>

      <PeopleCard />

      <View style={ui.card}>
        <Text style={ui.h2}>Quyền đọc thông báo</Text>
        {!listener ? (
          <Text style={[ui.text, { color: colors.warn }]}>
            Bản đang chạy chưa có module native (ví dụ Expo Go). Hãy cài bản development build.
          </Text>
        ) : (
          <>
            <Text style={[ui.text, { color: permissionGranted ? colors.primary : colors.warn }]}>
              {permissionGranted ? '✓ Đã cấp quyền' : 'Chưa cấp quyền'}
            </Text>
            <Text style={ui.muted}>
              Android 13+: nếu công tắc bị mờ, vào Cài đặt → Ứng dụng → Sổ Quỹ → menu ⋮ → “Cho phép cài đặt bị hạn chế”, rồi bật
              lại. Nên tắt tối ưu pin cho Sổ Quỹ để không bị dừng nền.
            </Text>
            <Pressable style={[ui.buttonGhost, { marginTop: 10 }]} onPress={() => listener.openPermissionSettings()}>
              <Text style={ui.buttonGhostText}>Mở cài đặt quyền</Text>
            </Pressable>
          </>
        )}
      </View>

      <SyncCard lastSync={lastSync.data ?? null} onSync={refresh} message={sync.message} isError={sync.state === 'error'} />

      <View style={ui.card}>
        <Text style={ui.h2}>Thông báo chưa đọc được ({unparsed.data?.length ?? 0})</Text>
        <Text style={ui.muted}>Gửi các mẫu này cho người làm app (che số tài khoản) để cập nhật bộ đọc.</Text>
        <AsyncStatus state={unparsed} />
        {unparsed.data?.map((u) => (
          <Text key={u.id} selectable style={[ui.muted, styles.sample]}>
            {formatTime(u.posted_at)} · {u.package_name}
            {u.title ? `\n${u.title}` : ''}
            {'\n'}
            {u.text}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const ROLE_SECTIONS: { role: PersonRole; title: string; hint: string; add: string }[] = [
  { role: 'OWNER', title: 'Chủ cửa hàng', hint: 'Ngày nào cũng đi làm. Hôm nào nghỉ thì báo nghỉ trên tab Lịch.', add: '+ Thêm chủ' },
  { role: 'STAFF', title: 'Nhân viên', hint: 'Hôm nào đi làm thì thêm vào ngày đó trên tab Lịch.', add: '+ Thêm nhân viên' },
];

// Danh sách chủ + nhân viên, đồng bộ 2 máy. Bấm "+ Thêm…" mới hiện ô nhập.
function PeopleCard() {
  const { db, version, mutate } = useApp();
  const people = useAsync(() => listPeople(db), [db, version]);
  // null = không ở chế độ thêm.
  const [draft, setDraft] = useState<{ role: PersonRole; name: string } | null>(null);

  const save = async () => {
    if (!draft?.name.trim()) return;
    if (await mutate((d, owner) => addPerson(d, draft.name, draft.role, owner))) setDraft(null);
  };

  const remove = (id: string, name: string) =>
    Alert.alert(`Bỏ ${name} khỏi danh sách?`, 'Lịch sẽ không hiện người này nữa (trên cả 2 máy).', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Bỏ', style: 'destructive', onPress: () => void mutate((d, owner) => removePerson(d, id, owner)) },
    ]);

  return (
    <View style={ui.card}>
      <Text style={ui.h2}>Người làm ở cửa hàng</Text>
      <AsyncStatus state={people} />
      {ROLE_SECTIONS.map((s) => (
        <View key={s.role} style={{ marginTop: 12 }}>
          <Text style={[ui.text, { fontWeight: '700' }]}>{s.title}</Text>
          <Text style={ui.muted}>{s.hint}</Text>
          {people.data
            ?.filter((p) => p.role === s.role)
            .map((p) => (
              <View key={p.id} style={styles.nameRow}>
                <Text style={[ui.text, styles.nameText]}>{p.name}</Text>
                <Pressable
                  style={[ui.buttonGhost, { borderColor: colors.danger }]}
                  onPress={() => remove(p.id, p.name)}
                  accessibilityRole="button"
                >
                  <Text style={[ui.buttonGhostText, { color: colors.danger }]}>Bỏ</Text>
                </Pressable>
              </View>
            ))}
          {draft?.role === s.role ? (
            <>
              <TextInput
                style={styles.input}
                value={draft.name}
                onChangeText={(name) => setDraft({ role: s.role, name })}
                placeholder="Ví dụ: Lan"
                autoFocus
              />
              <Pressable
                style={[ui.button, { opacity: draft.name.trim() ? 1 : 0.5 }]}
                onPress={save}
                disabled={!draft.name.trim()}
                accessibilityRole="button"
              >
                <Text style={ui.buttonText}>Lưu</Text>
              </Pressable>
              <Pressable style={[ui.buttonGhost, { marginTop: 8 }]} onPress={() => setDraft(null)} accessibilityRole="button">
                <Text style={ui.buttonGhostText}>Huỷ</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[ui.buttonGhost, { marginTop: 10 }]}
              onPress={() => setDraft({ role: s.role, name: '' })}
              accessibilityRole="button"
            >
              <Text style={ui.buttonGhostText}>{s.add}</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

type SyncProps = { lastSync: string | null; onSync: () => Promise<void>; message: string; isError: boolean };

// Đăng nhập tài khoản Supabase dùng chung của cửa hàng và đồng bộ thủ công.
function SyncCard({ lastSync, onSync, message, isError }: SyncProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSignedInAs(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setSignedInAs(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const client = supabase;
  if (!client) {
    return (
      <View style={ui.card}>
        <Text style={ui.h2}>Đồng bộ 2 máy</Text>
        <Text style={[ui.text, { color: colors.warn }]}>Chưa cấu hình Supabase. App vẫn chạy offline trên máy này.</Text>
      </View>
    );
  }

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) setError(e.message);
    else {
      setPassword('');
      await onSync();
    }
  };

  return (
    <View style={ui.card}>
      <Text style={ui.h2}>Đồng bộ 2 máy</Text>
      {signedInAs ? (
        <>
          <Text style={ui.text}>Đã đăng nhập: {signedInAs}</Text>
          <Text style={ui.muted}>Lần đồng bộ cuối: {lastSync ? formatTime(Number(lastSync)) : 'chưa có'}</Text>
          {!!message && <Text style={[ui.muted, isError && { color: colors.danger }]}>{message}</Text>}
          <Pressable style={[ui.button, { marginTop: 10 }]} onPress={onSync} accessibilityRole="button">
            <Text style={ui.buttonText}>Đồng bộ ngay</Text>
          </Pressable>
          <Pressable style={[ui.buttonGhost, { marginTop: 8 }]} onPress={() => client.auth.signOut()}>
            <Text style={ui.buttonGhostText}>Đăng xuất</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={ui.muted}>Đăng nhập bằng tài khoản dùng chung của cửa hàng.</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mật khẩu" secureTextEntry />
          {error && <Text style={ui.errorText}>{error}</Text>}
          <Pressable style={[ui.button, { opacity: busy ? 0.6 : 1 }]} onPress={signIn} disabled={busy}>
            <Text style={ui.buttonText}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 22,
    marginVertical: 10,
    color: colors.text,
  },
  sample: { marginTop: 8, padding: 8, backgroundColor: colors.bg, borderRadius: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  nameText: { flex: 1, fontSize: 24, fontWeight: '600' },
});
