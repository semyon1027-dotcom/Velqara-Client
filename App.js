import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const PURPLE = '#A855F7';
const CYAN = '#22D3EE';
const BG = '#08090D';
const CARD = '#11131B';
const MUTED = '#9297A7';

const moduleGroups = [
  {
    title: 'Visuals',
    items: [
      ['Screen shake', 'Убрать тряску экрана', false],
      ['Fulbright', 'Освещение мира', false],
      ['Swing animation', 'Анимация взмаха', false],
      ['Custom fog', 'Туман и палитра', false],
      ['Custom sky', 'Цвет неба', false],
      ['Item physics', 'Физика предметов', false],
      ['Aspect ratio', '4:3 · 5:4 · 16:9 · 16:10', false],
      ['Custom FOV', 'Поле зрения', false],
      ['Glint', 'Цвет зачарований', false],
    ],
  },
  {
    title: 'Overlays',
    items: [
      ['Watermark', 'Velqara · FPS · CPS · BPS', true],
      ['Array list', 'Список включённых функций', true],
      ['Potion HUD', 'Эффекты и таймеры', false],
      ['Target HUD', 'Карточка последней цели', false],
      ['Inventory HUD', 'Сетка инвентаря', false],
      ['Armor HUD', 'Броня и прочность', false],
      ['Death position', 'Метка и координаты', false],
      ['Waypoints', 'Точки на карте', false],
    ],
  },
  {
    title: 'World tools',
    items: [
      ['Item ESP', 'Предметы на земле', false],
      ['Block ESP', 'Сундуки, бочки и блоки', false],
      ['Mob ESP', 'Подсветка мобов', false],
      ['Player ESP', 'Подсветка игроков', false],
      ['Jump circle', 'Кольцо прыжка', false],
      ['Projectile predict', 'Траектория броска', false],
      ['TNT timer', 'Таймер динамита', false],
      ['Free camera', 'Свободная камера', false],
      ['Ore vision', 'Руды через блоки', false],
    ],
  },
  {
    title: 'Audio',
    items: [
      ['Hit sounds', 'Звуки ударов', false],
      ['Kill sounds', 'Мемные звуки убийства', false],
      ['Hit particles', 'Сердца, доллары и цвета', false],
    ],
  },
];

function Pill({ children, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{children}</Text>
    </TouchableOpacity>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [enabled, setEnabled] = useState({ Watermark: true, 'Array list': true });
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState('Default');
  const [version, setVersion] = useState('Не определена');
  const [language, setLanguage] = useState('Русский');
  const [accent, setAccent] = useState(PURPLE);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('velqara.settings.v1').then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.enabled) setEnabled(saved.enabled);
        if (saved.profile) setProfile(saved.profile);
        if (saved.language) setLanguage(saved.language);
        if (saved.accent) setAccent(saved.accent);
      }
    }).catch(() => {}).finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    AsyncStorage.setItem('velqara.settings.v1', JSON.stringify({ enabled, profile, language, accent })).catch(() => {});
  }, [enabled, profile, language, accent, storageReady]);

  const allItems = useMemo(
    () => moduleGroups.flatMap((group) => group.items.map(([name, subtitle, risk]) => ({ name, subtitle, risk, group: group.title }))),
    []
  );
  const filtered = allItems.filter((item) => `${item.name} ${item.subtitle}`.toLowerCase().includes(search.toLowerCase()));

  const toggle = (name) => setEnabled((old) => ({ ...old, [name]: !old[name] }));

  const openMinecraft = async () => {
    if (Platform.OS === 'android') {
      try {
        const MinecraftDetector = require('expo-modules-core').requireNativeModule('MinecraftDetector');
        const result = await MinecraftDetector.launchMinecraft();
        if (result?.launched) return;
        Alert.alert('Minecraft не найден', 'Не найдено установленное приложение com.mojang.minecraftpe. Проверь установку игры и нажми «Проверить версию».');
        return;
      } catch (_) {
        Alert.alert('Нужна Android-сборка', 'Запуск по пакету доступен в собранном APK. В веб-предпросмотре открой Minecraft вручную.');
        return;
      }
    }
    const candidates = ['minecraft://', 'minecraftpe://'];
    for (const url of candidates) {
      try {
        if (await Linking.canOpenURL(url)) {
          await Linking.openURL(url);
          return;
        }
      } catch (_) {}
    }
    Alert.alert('Minecraft не найден', 'Открой Minecraft вручную. В APK добавим запуск по пакету com.mojang.minecraftpe.');
  };

  const detectVersion = () => {
    if (Platform.OS !== 'android') {
      setVersion('Только в Android APK');
      Alert.alert('Проверка версии', 'В веб-предпросмотре установленные Android-приложения недоступны. В APK версия читается из Android PackageManager.');
      return;
    }
    try {
      const MinecraftDetector = require('expo-modules-core').requireNativeModule('MinecraftDetector');
      MinecraftDetector.getMinecraftInfo().then((info) => {
        if (!info?.installed) {
          setVersion('Не установлен');
          Alert.alert('Minecraft не найден', 'Не найден пакет com.mojang.minecraftpe. Источник установки и доступность магазина не влияют на проверку.');
          return;
        }
        setVersion(`${info.versionName || 'Версия неизвестна'} · код ${info.versionCode}`);
      }).catch(() => Alert.alert('Ошибка проверки', 'Не удалось прочитать сведения о пакете Minecraft.'));
    } catch (_) {
      setVersion('Соберите Android APK');
      Alert.alert('Нужна Android-сборка', 'Нативный детектор доступен в установленном APK, а не в предпросмотре.');
    }
  };

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.eyebrow}>VELQARA CLIENT</Text>
          <Text style={styles.title}>Bedrock, по‑твоему.</Text>
          <Text style={styles.subtitle}>Локальный профиль визуальных модулей для офлайн‑миров.</Text>
        </View>
        <View style={styles.logo}><Text style={styles.logoText}>V</Text></View>
      </View>
      <Card style={styles.statusCard}>
        <View style={styles.rowBetween}>
          <View><Text style={styles.cardTitle}>Minecraft Bedrock</Text><Text style={styles.muted}>{version}</Text></View>
          <View style={styles.dot} />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={openMinecraft}><Text style={styles.primaryText}>Запустить Minecraft</Text></TouchableOpacity>
        <TouchableOpacity style={styles.outlineButton} onPress={detectVersion}><Text style={styles.outlineText}>Проверить установленную версию</Text></TouchableOpacity>
      </Card>
      <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Активный профиль</Text><Pill active onPress={() => setTab('profiles')}>{profile}</Pill></View>
      <Card><Text style={styles.bigNumber}>{Object.values(enabled).filter(Boolean).length}</Text><Text style={styles.muted}>активных модулей</Text><View style={styles.moduleRow}>{Object.entries(enabled).filter(([, on]) => on).map(([name]) => <Pill key={name} active onPress={() => setTab('modules')}>{name}</Pill>)}</View></Card>
      <Text style={styles.sectionTitle}>Быстрые действия</Text>
      <View style={styles.grid}>{[['modules', 'Модули'], ['hud', 'HUD'], ['profiles', 'Профили'], ['settings', 'Настройки']].map(([id, label]) => <TouchableOpacity key={id} style={styles.quick} onPress={() => setTab(id)}><Text style={styles.quickIcon}>{id === 'modules' ? '✦' : id === 'hud' ? '◈' : id === 'profiles' ? '▱' : '⚙'}</Text><Text style={styles.quickLabel}>{label}</Text></TouchableOpacity>)}</View>
      <Card style={styles.warning}><Text style={styles.warningTitle}>Ban risk</Text><Text style={styles.muted}>ESP, Ore vision, Free camera и другие игровые оверлеи могут нарушать правила серверов. Используй их только там, где это разрешено.</Text></Card>
    </ScrollView>
  );

  const renderModules = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Модули</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="Поиск модулей" placeholderTextColor={MUTED} style={styles.input} />
      {moduleGroups.map((group) => {
        const items = filtered.filter((item) => item.group === group.title);
        if (!items.length) return null;
        return <View key={group.title}><Text style={styles.sectionTitle}>{group.title}</Text><Card>{items.map((item) => <View key={item.name} style={styles.moduleItem}><View style={{ flex: 1 }}><View style={styles.row}><Text style={styles.moduleName}>{item.name}</Text>{(['Item ESP', 'Block ESP', 'Mob ESP', 'Player ESP', 'Ore vision', 'Free camera'].includes(item.name)) && <Text style={styles.risk}>BAN RISK</Text>}</View><Text style={styles.muted}>{item.subtitle}</Text></View><Switch value={!!enabled[item.name]} onValueChange={() => toggle(item.name)} trackColor={{ false: '#2A2D38', true: accent }} thumbColor="#FFFFFF" /></View>)}</Card></View>;
      })}
    </ScrollView>
  );

  const renderHud = () => (
    <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>HUD и экран</Text><Card><Text style={styles.cardTitle}>Предпросмотр HUD</Text><View style={styles.hudPreview}><Text style={styles.hudWatermark}>VELQARA</Text><Text style={styles.hudStats}>FPS 120   CPS 8   BPS 4.2</Text><Text style={styles.hudArray}>Watermark{enabled['Array list'] ? '\nArray list' : ''}</Text><View style={styles.hotbar}><View/><View/><View/><View/><View/><View/><View/><View/><View/></View></View></Card>{[['Размер меню', '100%'], ['Прозрачность HUD', '85%'], ['Дальность ESP', '32 блока'], ['Длительность jump circle', '1.2 сек']].map(([label, value]) => <Card key={label}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{label}</Text><Text style={styles.value}>{value}</Text></View><View style={styles.slider}><View style={[styles.sliderFill, { width: label === 'Дальность ESP' ? '65%' : '50%', backgroundColor: accent }]} /></View></Card>)}</ScrollView>
  );

  const renderProfiles = () => (
    <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Профили</Text><Card><Text style={styles.cardTitle}>Активный профиль</Text><TextInput value={profile} onChangeText={setProfile} style={styles.input} placeholder="Название профиля" placeholderTextColor={MUTED} /><View style={styles.row}><TouchableOpacity style={styles.primarySmall} onPress={() => Alert.alert('Сохранено', `Профиль «${profile}» сохранён локально.`)}><Text style={styles.primaryText}>Сохранить</Text></TouchableOpacity><TouchableOpacity style={styles.outlineSmall} onPress={() => setEnabled({ Watermark: true, 'Array list': true })}><Text style={styles.outlineText}>Сбросить</Text></TouchableOpacity></View></Card><Card><Text style={styles.cardTitle}>Локальное хранение</Text><Text style={styles.muted}>Настройки остаются на устройстве. Облачный вход не требуется.</Text></Card></ScrollView>
  );

  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Настройки</Text><Card><Text style={styles.cardTitle}>Язык</Text><View style={styles.moduleRow}><Pill active={language === 'Русский'} onPress={() => setLanguage('Русский')}>Русский</Pill><Pill active={language === 'English'} onPress={() => setLanguage('English')}>English</Pill></View></Card><Card><Text style={styles.cardTitle}>Акцентный цвет</Text><View style={styles.moduleRow}>{[[PURPLE, 'Фиолетовый'], [CYAN, 'Циан'], ['#FACC15', 'Жёлтый'], ['#34D399', 'Зелёный']].map(([color, label]) => <TouchableOpacity key={color} onPress={() => setAccent(color)} style={[styles.colorChoice, { backgroundColor: color, borderColor: accent === color ? '#FFF' : 'transparent' }]}><Text style={styles.colorLabel}>{label}</Text></TouchableOpacity>)}</View></Card><Card><View style={styles.rowBetween}><Text style={styles.cardTitle}>Снег и дождь</Text><Switch value={false} onValueChange={() => {}} trackColor={{ false: '#2A2D38', true: accent }} thumbColor="#FFFFFF" /></View><Text style={styles.muted}>Отключено по умолчанию для FPS.</Text></Card><Card><Text style={styles.cardTitle}>Совместимость</Text><Text style={styles.muted}>Минимальная версия профиля: Bedrock 1.26.60. Фактическая версия читается в нативной Android‑сборке.</Text></Card></ScrollView>
  );

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={BG} /><View style={styles.app}>{tab === 'home' && renderHome()}{tab === 'modules' && renderModules()}{tab === 'hud' && renderHud()}{tab === 'profiles' && renderProfiles()}{tab === 'settings' && renderSettings()}<View style={styles.nav}>{[['home', 'Главная', '⌂'], ['modules', 'Модули', '✦'], ['hud', 'HUD', '◈'], ['profiles', 'Профили', '▱'], ['settings', 'Настройки', '⚙']].map(([id, label, icon]) => <TouchableOpacity key={id} onPress={() => setTab(id)} style={styles.navItem}><Text style={[styles.navIcon, tab === id && { color: accent }]}>{icon}</Text><Text style={[styles.navLabel, tab === id && { color: accent }]}>{label}</Text></TouchableOpacity>)}</View></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG }, app: { flex: 1, backgroundColor: BG }, content: { padding: 20, paddingBottom: 110 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: CYAN, fontSize: 12, fontWeight: '800', letterSpacing: 2 }, title: { color: '#FFF', fontSize: 30, fontWeight: '900', marginTop: 6 }, subtitle: { color: MUTED, fontSize: 14, marginTop: 8, maxWidth: 270, lineHeight: 20 }, logo: { width: 58, height: 58, borderRadius: 20, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', shadowColor: PURPLE, shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }, logoText: { color: '#FFF', fontSize: 32, fontWeight: '900' }, card: { backgroundColor: CARD, borderWidth: 1, borderColor: '#202330', borderRadius: 22, padding: 18, marginBottom: 14 }, statusCard: { borderColor: '#283542' }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cardTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' }, muted: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 5 }, dot: { width: 10, height: 10, borderRadius: 8, backgroundColor: '#34D399' }, primaryButton: { backgroundColor: PURPLE, borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, primarySmall: { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, marginTop: 14 }, primaryText: { color: '#FFF', fontSize: 15, fontWeight: '900' }, outlineButton: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: '#3A3D4A' }, outlineText: { color: '#E7E8EF', fontSize: 13, fontWeight: '800' }, outlineSmall: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, marginTop: 14, marginLeft: 10, borderWidth: 1, borderColor: '#3A3D4A' }, sectionTitle: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginTop: 10, marginBottom: 10 }, bigNumber: { color: '#FFF', fontSize: 38, fontWeight: '900' }, moduleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, pill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 99, backgroundColor: '#1B1E29', borderWidth: 1, borderColor: '#2A2D38' }, pillActive: { backgroundColor: '#2C1847', borderColor: PURPLE }, pillText: { color: MUTED, fontSize: 12, fontWeight: '700' }, pillTextActive: { color: '#F2E8FF' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 }, quick: { width: '47%', minHeight: 94, backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: '#202330', padding: 14, justifyContent: 'space-between' }, quickIcon: { color: PURPLE, fontSize: 24 }, quickLabel: { color: '#FFF', fontWeight: '800' }, warning: { borderColor: '#654B12', backgroundColor: '#17140C' }, warningTitle: { color: '#FACC15', fontWeight: '900', fontSize: 13, letterSpacing: 1 }, pageTitle: { color: '#FFF', fontSize: 28, fontWeight: '900', marginBottom: 16 }, input: { backgroundColor: '#191C26', borderRadius: 13, borderWidth: 1, borderColor: '#2B2E3B', color: '#FFF', paddingHorizontal: 14, height: 48, marginTop: 12 }, moduleItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#202330' }, moduleName: { color: '#FFF', fontSize: 15, fontWeight: '800' }, risk: { color: '#FACC15', fontSize: 9, fontWeight: '900', borderWidth: 1, borderColor: '#6B5312', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }, value: { color: CYAN, fontWeight: '900' }, slider: { height: 8, borderRadius: 8, backgroundColor: '#292D39', marginTop: 16, overflow: 'hidden' }, sliderFill: { height: 8, borderRadius: 8 }, hudPreview: { height: 220, backgroundColor: '#06070A', borderRadius: 15, borderWidth: 1, borderColor: '#272A37', marginTop: 16, padding: 12, position: 'relative' }, hudWatermark: { color: PURPLE, fontWeight: '900' }, hudStats: { color: '#FFF', fontSize: 11, marginTop: 7 }, hudArray: { color: '#FFF', fontSize: 12, position: 'absolute', right: 12, top: 12, textAlign: 'right' }, hotbar: { position: 'absolute', bottom: 18, left: 35, right: 35, flexDirection: 'row', gap: 4 }, hotbarItem: { flex: 1, height: 24, backgroundColor: '#262A35', borderWidth: 1, borderColor: '#454A5B' }, colorChoice: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 2 }, colorLabel: { color: '#FFF', fontSize: 11, fontWeight: '800' }, nav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 78, backgroundColor: '#101219', borderTopWidth: 1, borderTopColor: '#252936', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }, navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 55 }, navIcon: { color: MUTED, fontSize: 22 }, navLabel: { color: MUTED, fontSize: 10, marginTop: 4, fontWeight: '700' },
});
