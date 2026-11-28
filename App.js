import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { buildVelqaraMcaddon, bytesToBase64 } from './src/bedrockPack';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  NativeModules,
  PanResponder,
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
const Overlay = NativeModules.VelqaraOverlay;

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

function RangeSlider({ value, onChange, min = 0, max = 100, step = 1, accent = PURPLE }) {
  const [width, setWidth] = useState(1);
  const update = (x) => {
    const ratio = Math.max(0, Math.min(1, x / Math.max(width, 1)));
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, Number(stepped.toFixed(2)))));
  };
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => update(event.nativeEvent.locationX),
    onPanResponderMove: (event) => update(event.nativeEvent.locationX),
  }), [width, min, max, step, onChange]);
  const progress = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <View
      style={styles.sliderTouchArea}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
        <View style={[styles.sliderThumb, { left: `${progress * 100}%`, backgroundColor: accent }]} />
      </View>
    </View>
  );
}


function NeonBackground() {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift]);
  const shift = drift.interpolate({ inputRange: [0, 1], outputRange: [-24, 24] });
  return (
    <View pointerEvents="none" style={styles.neonBackground}>
      <Animated.View style={[styles.neonOrb, { transform: [{ translateX: shift }, { translateY: 18 }] }]} />
      <Animated.View style={[styles.neonOrbTwo, { transform: [{ translateX: shift.interpolate({ inputRange: [-24, 24], outputRange: [20, -20] }) }, { translateY: -10 }] }]} />
      <View style={styles.neonGrid} />
    </View>
  );
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
  const [packStatus, setPackStatus] = useState('');
  const [overlayStatus, setOverlayStatus] = useState('Оверлей выключен');
  const [sliderValues, setSliderValues] = useState({ menuSize: 100, hudOpacity: 85, espDistance: 32, jumpDuration: 1.2 });
  const [booting, setBooting] = useState(true);
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('velqara.settings.v1').then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.enabled) setEnabled(saved.enabled);
        if (saved.profile) setProfile(saved.profile);
        if (saved.language) setLanguage(saved.language);
        if (saved.accent) setAccent(saved.accent);
        if (saved.sliderValues) setSliderValues(saved.sliderValues);
      }
    }).catch(() => {}).finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    AsyncStorage.setItem('velqara.settings.v1', JSON.stringify({ enabled, profile, language, accent, sliderValues })).catch(() => {});
  }, [enabled, profile, language, accent, sliderValues, storageReady]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }),
    ]).start();
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(logoScale, { toValue: 1.06, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    pulse.start();
    const timer = setTimeout(() => setBooting(false), 1500);
    return () => { clearTimeout(timer); pulse.stop(); };
  }, [logoOpacity, logoScale]);

  const allItems = useMemo(
    () => moduleGroups.flatMap((group) => group.items.map(([name, subtitle, risk]) => ({ name, subtitle, risk, group: group.title }))),
    []
  );
  const filtered = allItems.filter((item) => `${item.name} ${item.subtitle}`.toLowerCase().includes(search.toLowerCase()));

  const toggle = (name) => setEnabled((old) => ({ ...old, [name]: !old[name] }));
  const changeSlider = (key, value) => setSliderValues((old) => ({ ...old, [key]: value }));
  const goTo = (nextTab) => {
    if (nextTab === tab) return;
    Animated.parallel([
      Animated.timing(screenOpacity, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(screenTranslate, { toValue: 8, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      setTab(nextTab);
      Animated.parallel([
        Animated.timing(screenOpacity, { toValue: 1, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(screenTranslate, { toValue: 0, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

  const exportBedrockPack = async () => {
    try {
      setPackStatus('Создаю mcaddon…');
      const bytes = buildVelqaraMcaddon({ enabled, accent });
      const uri = `${FileSystem.cacheDirectory}Velqara_Client.mcaddon`;
      await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
      if (!(await Sharing.isAvailableAsync())) {
        setPackStatus('Файл создан в памяти приложения');
        Alert.alert('Пакет создан', `Файл готов: ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'application/octet-stream', dialogTitle: 'Импортировать Velqara в Minecraft' });
      setPackStatus('Пакет готов к импорту');
    } catch (error) {
      setPackStatus('Ошибка экспорта');
      Alert.alert('Не удалось создать пакет', String(error?.message || error));
    }
  };

  const enableOverlay = async () => {
    if (!Overlay) {
      Alert.alert('Нужна новая сборка', 'Системный оверлей доступен в новой Android-сборке Velqara.');
      return;
    }
    try {
      const granted = await Overlay.requestOverlayPermission();
      if (!granted) {
        setOverlayStatus('Разрешение ожидается');
        Alert.alert('Разрешение оверлея', 'Включи «Показывать поверх других приложений» для Velqara, вернись в приложение и нажми «Включить поверх» ещё раз.');
        return;
      }
      await Overlay.startOverlay();
      setOverlayStatus('Оверлей запущен');
    } catch (_) {
      Alert.alert('Разрешение нужно включить вручную', 'Открой разрешение «Показывать поверх других приложений» для Velqara Client и повтори.');
    }
  };

  const disableOverlay = async () => {
    try { await Overlay?.stopOverlay(); } catch (_) {}
    setOverlayStatus('Оверлей выключен');
  };

  const openMinecraft = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Overlay?.launchMinecraft) {
          await Overlay.launchMinecraft();
          return;
        }
        await IntentLauncher.startActivityAsync('android.intent.action.MAIN', { packageName: 'com.mojang.minecraftpe', category: 'android.intent.category.LAUNCHER' });
        return;
      } catch (_) {
        // Some vendor launchers do not resolve MAIN/LAUNCHER by package. Try the public URI next.
        try { await Linking.openURL('minecraft://'); return; } catch (_) {}
        Alert.alert('Minecraft не найден', 'Не удалось открыть com.mojang.minecraftpe. Проверь, что Minecraft установлен из любого источника.');
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
    setVersion('Пакет: com.mojang.minecraftpe');
    Alert.alert('Проверка установки', 'Velqara использует пакет com.mojang.minecraftpe и не обращается к Google Play. Точную versionName Android не отдаёт этому Expo-модулю; её можно посмотреть в системных сведениях о приложении.');
  };

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.eyebrow}>VELQARA CLIENT</Text>
          <Text style={styles.title}>Bedrock, по‑твоему.</Text>
          <Text style={styles.subtitle}>Локальный профиль визуальных модулей для офлайн‑миров.</Text>
        </View>
        <Image source={require('./assets/velqara_icon.png')} style={styles.logoImage} />
      </View>
      <Card style={styles.statusCard}>
        <View style={styles.rowBetween}>
          <View><Text style={styles.cardTitle}>Minecraft Bedrock</Text><Text style={styles.muted}>{version}</Text></View>
          <View style={styles.dot} />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={openMinecraft}><Text style={styles.primaryText}>Запустить Minecraft</Text></TouchableOpacity>
        <TouchableOpacity style={styles.outlineButton} onPress={detectVersion}><Text style={styles.outlineText}>Проверить установленную версию</Text></TouchableOpacity>
      </Card>
      <Card style={styles.packCard}>
        <View style={styles.rowBetween}><View style={{ flex: 1, paddingRight: 12 }}><Text style={styles.cardTitle}>Bedrock-пакет Velqara</Text><Text style={styles.muted}>Экспортируй включённые модули в .mcaddon и импортируй файл в Minecraft.</Text></View><Text style={styles.packIcon}>◆</Text></View>
        <TouchableOpacity style={styles.primaryButton} onPress={exportBedrockPack}><Text style={styles.primaryText}>Экспортировать .mcaddon</Text></TouchableOpacity>
        {!!packStatus && <Text style={styles.packStatus}>{packStatus}</Text>}
      </Card>
      <Card style={styles.overlayCard}>
        <View style={styles.rowBetween}><View><Text style={styles.cardTitle}>Системный оверлей</Text><Text style={styles.muted}>{overlayStatus}</Text></View><Text style={styles.overlayIcon}>◉</Text></View>
        <View style={styles.row}><TouchableOpacity style={styles.primarySmall} onPress={enableOverlay}><Text style={styles.primaryText}>Включить поверх</Text></TouchableOpacity><TouchableOpacity style={styles.outlineSmall} onPress={disableOverlay}><Text style={styles.outlineText}>Выключить</Text></TouchableOpacity></View>
      </Card>
      <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Активный профиль</Text><Pill active onPress={() => goTo('profiles')}>{profile}</Pill></View>
      <Card><Text style={styles.bigNumber}>{Object.values(enabled).filter(Boolean).length}</Text><Text style={styles.muted}>активных модулей</Text><View style={styles.moduleRow}>{Object.entries(enabled).filter(([, on]) => on).map(([name]) => <Pill key={name} active onPress={() => goTo('modules')}>{name}</Pill>)}</View></Card>
      <Text style={styles.sectionTitle}>Быстрые действия</Text>
      <View style={styles.grid}>{[['modules', 'Модули'], ['hud', 'HUD'], ['profiles', 'Профили'], ['settings', 'Настройки']].map(([id, label]) => <TouchableOpacity key={id} style={styles.quick} onPress={() => goTo(id)}><Text style={styles.quickIcon}>{id === 'modules' ? '✦' : id === 'hud' ? '◈' : id === 'profiles' ? '▱' : '⚙'}</Text><Text style={styles.quickLabel}>{label}</Text></TouchableOpacity>)}</View>
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
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>HUD и экран</Text>
      <Card>
        <Text style={styles.cardTitle}>Предпросмотр HUD</Text>
        <Animated.View style={[styles.hudPreview, { opacity: Math.max(0.22, sliderValues.hudOpacity / 100), transform: [{ scale: sliderValues.menuSize / 100 }] }]}>
          <Text style={[styles.hudWatermark, { color: accent }]}>VELQARA</Text>
          <Text style={[styles.hudStats, { fontSize: 9 + sliderValues.menuSize / 55 }]}>FPS 120   CPS 8   BPS 4.2   ESP {Math.round(sliderValues.espDistance)}m</Text>
          <Text style={styles.hudArray}>Watermark{enabled['Array list'] ? '\nArray list' : ''}</Text>
          <View style={styles.hotbar}><View/><View/><View/><View/><View/><View/><View/><View/><View/></View>
        </View>
      </Card>
      <Card><View style={styles.rowBetween}><Text style={styles.cardTitle}>Размер меню</Text><Text style={styles.value}>{Math.round(sliderValues.menuSize)}%</Text></View><RangeSlider value={sliderValues.menuSize} min={75} max={125} onChange={(v) => changeSlider('menuSize', v)} accent={accent} /></Card>
      <Card><View style={styles.rowBetween}><Text style={styles.cardTitle}>Прозрачность HUD</Text><Text style={styles.value}>{Math.round(sliderValues.hudOpacity)}%</Text></View><RangeSlider value={sliderValues.hudOpacity} min={0} max={100} onChange={(v) => changeSlider('hudOpacity', v)} accent={accent} /></Card>
      <Card><View style={styles.rowBetween}><Text style={styles.cardTitle}>Дальность ESP</Text><Text style={styles.value}>{Math.round(sliderValues.espDistance)} блоков</Text></View><RangeSlider value={sliderValues.espDistance} min={8} max={128} onChange={(v) => changeSlider('espDistance', v)} accent={accent} /></Card>
      <Card><View style={styles.rowBetween}><Text style={styles.cardTitle}>Длительность jump circle</Text><Text style={styles.value}>{sliderValues.jumpDuration.toFixed(1)} сек</Text></View><RangeSlider value={sliderValues.jumpDuration} min={0.3} max={3} step={0.1} onChange={(v) => changeSlider('jumpDuration', v)} accent={accent} /></Card>
    </ScrollView>
  );

  const renderProfiles = () => (
    <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Профили</Text><Card><Text style={styles.cardTitle}>Активный профиль</Text><TextInput value={profile} onChangeText={setProfile} style={styles.input} placeholder="Название профиля" placeholderTextColor={MUTED} /><View style={styles.row}><TouchableOpacity style={styles.primarySmall} onPress={() => Alert.alert('Сохранено', `Профиль «${profile}» сохранён локально.`)}><Text style={styles.primaryText}>Сохранить</Text></TouchableOpacity><TouchableOpacity style={styles.outlineSmall} onPress={() => setEnabled({ Watermark: true, 'Array list': true })}><Text style={styles.outlineText}>Сбросить</Text></TouchableOpacity></View></Card><Card><Text style={styles.cardTitle}>Локальное хранение</Text><Text style={styles.muted}>Настройки остаются на устройстве. Облачный вход не требуется.</Text></Card></ScrollView>
  );

  const renderPacks = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Bedrock Packs</Text>
      <Card style={styles.packCard}><Text style={styles.cardTitle}>Velqara Behavior Pack</Text><Text style={styles.muted}>Скриптовые функции локального мира: Fulbright, particles, sounds, TNT HUD, jump circle, death position и waypoints.</Text><View style={styles.rowBetween}><Pill active>Готов к экспорту</Pill><Text style={styles.value}>1.26.60+</Text></View></Card>
      <Card style={styles.packCard}><Text style={styles.cardTitle}>Velqara Resource Pack</Text><Text style={styles.muted}>Fog и визуальные ресурсы. Пакет импортируется вместе с behavior pack.</Text><View style={styles.rowBetween}><Pill active>Готов к экспорту</Pill><Text style={styles.value}>Resource</Text></View></Card>
      <TouchableOpacity style={styles.primaryButton} onPress={exportBedrockPack}><Text style={styles.primaryText}>Установить пакеты в Minecraft</Text></TouchableOpacity>
      <Card><Text style={styles.cardTitle}>После импорта</Text><Text style={styles.muted}>Выбери Minecraft в системном окне, затем открой настройки мира и активируй Velqara Behavior и Resource packs.</Text></Card>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Настройки</Text>
      <Card><Text style={styles.cardTitle}>Язык</Text><View style={styles.moduleRow}><Pill active={language === 'Русский'} onPress={() => setLanguage('Русский')}>Русский</Pill><Pill active={language === 'English'} onPress={() => setLanguage('English')}>English</Pill></View></Card>
      <Card><Text style={styles.cardTitle}>Акцентный цвет</Text><View style={styles.moduleRow}>{[[PURPLE, 'Фиолетовый'], [CYAN, 'Циан'], ['#FACC15', 'Жёлтый'], ['#34D399', 'Зелёный']].map(([color, label]) => <TouchableOpacity key={color} onPress={() => setAccent(color)} style={[styles.colorChoice, { backgroundColor: color, borderColor: accent === color ? '#FFF' : 'transparent' }]}><Text style={styles.colorLabel}>{label}</Text></TouchableOpacity>)}</View></Card>
      <Card><View style={styles.rowBetween}><Text style={styles.cardTitle}>Bedrock-пакет</Text><TouchableOpacity style={styles.primarySmall} onPress={exportBedrockPack}><Text style={styles.primaryText}>Экспорт</Text></TouchableOpacity></View><Text style={styles.muted}>После экспорта выбери Minecraft в системном меню «Открыть с помощью».</Text></Card>
      <Card><View style={styles.rowBetween}><Text style={styles.cardTitle}>Снег и дождь</Text><Switch value={false} onValueChange={() => {}} trackColor={{ false: '#2A2D38', true: accent }} thumbColor="#FFFFFF" /></View><Text style={styles.muted}>Отключено по умолчанию для FPS.</Text></Card>
      <Card><Text style={styles.cardTitle}>Совместимость</Text><Text style={styles.muted}>Пакет рассчитан на Bedrock 1.26.60+. Старые версии могут не поддержать Script API.</Text></Card>
    </ScrollView>
  );

  if (booting) return <SafeAreaView style={styles.splash}><StatusBar barStyle="light-content" backgroundColor={BG} /><Animated.View style={[styles.splashLogoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}><Image source={require('./assets/velqara_icon.png')} style={styles.logoLargeImage} /><Text style={styles.splashTitle}>VELQARA CLIENT</Text><Text style={styles.splashSubtitle}>BEDROCK CLIENT</Text><ActivityIndicator color={CYAN} size="small" style={styles.splashSpinner} /></Animated.View></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={BG} /><View style={styles.app}><NeonBackground /><Animated.View style={[styles.screen, { opacity: screenOpacity, transform: [{ translateY: screenTranslate }] }]}>{tab === 'home' && renderHome()}{tab === 'modules' && renderModules()}{tab === 'hud' && renderHud()}{tab === 'profiles' && renderProfiles()}{tab === 'packs' && renderPacks()}{tab === 'settings' && renderSettings()}</Animated.View><View style={styles.nav}>{[['home', 'Главная', '⌂'], ['modules', 'Модули', '✦'], ['hud', 'HUD', '◈'], ['profiles', 'Профили', '▱'], ['packs', 'Packs', '◆'], ['settings', 'Настройки', '⚙']].map(([id, label, icon]) => <TouchableOpacity key={id} onPress={() => goTo(id)} style={styles.navItem}><Text style={[styles.navIcon, tab === id && { color: accent }]}>{icon}</Text><Text style={[styles.navLabel, tab === id && { color: accent }]}>{label}</Text></TouchableOpacity>)}</View></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG }, app: { flex: 1, backgroundColor: '#050711' }, neonBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }, neonOrb: { position: 'absolute', width: 280, height: 280, borderRadius: 160, top: -90, left: -95, backgroundColor: PURPLE, opacity: 0.19, shadowColor: PURPLE, shadowOpacity: 0.9, shadowRadius: 70, elevation: 20 }, neonOrbTwo: { position: 'absolute', width: 240, height: 240, borderRadius: 140, right: -70, bottom: 70, backgroundColor: CYAN, opacity: 0.13, shadowColor: CYAN, shadowOpacity: 0.9, shadowRadius: 70, elevation: 20 }, neonGrid: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 1, borderColor: '#172A4D', opacity: 0.45 }, screen: { flex: 1 }, content: { padding: 16, paddingBottom: 108 }, splash: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }, splashLogoWrap: { alignItems: 'center' }, logoLarge: { width: 116, height: 116, borderRadius: 36, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', shadowColor: PURPLE, shadowOpacity: 0.85, shadowRadius: 28, shadowOffset: { width: 0, height: 0 }, elevation: 18 }, logoLargeImage: { width: 132, height: 132, borderRadius: 40, shadowColor: CYAN, shadowOpacity: 0.75, shadowRadius: 26, shadowOffset: { width: 0, height: 0 }, elevation: 18 }, logoLargeText: { color: '#FFF', fontSize: 68, fontWeight: '900' }, splashTitle: { color: '#FFF', fontSize: 25, fontWeight: '900', letterSpacing: 5, marginTop: 22 }, splashSubtitle: { color: CYAN, fontSize: 11, fontWeight: '800', letterSpacing: 3, marginTop: 7 }, splashSpinner: { marginTop: 24 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: CYAN, fontSize: 10, fontWeight: '800', letterSpacing: 2 }, title: { color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 6 }, subtitle: { color: '#A7B0C8', fontSize: 12, marginTop: 8, maxWidth: 270, lineHeight: 20 }, logo: { width: 58, height: 58, borderRadius: 20, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', shadowColor: PURPLE, shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }, logoImage: { width: 62, height: 62, borderRadius: 20, shadowColor: CYAN, shadowOpacity: 0.9, shadowRadius: 18, elevation: 12 }, logoText: { color: '#FFF', fontSize: 32, fontWeight: '900' }, card: { backgroundColor: '#0D1220', borderWidth: 1, borderColor: '#26375B', borderRadius: 26, padding: 16, marginBottom: 14 }, statusCard: { borderColor: '#283542' }, packCard: { borderColor: '#3B2360', backgroundColor: '#12101C' }, packIcon: { color: CYAN, fontSize: 24 }, packStatus: { color: '#34D399', fontSize: 12, fontWeight: '800', marginTop: 10 }, overlayCard: { borderColor: '#174A55', backgroundColor: '#0C171C' }, overlayIcon: { color: CYAN, fontSize: 24 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cardTitle: { color: '#F4F7FF', fontSize: 14, fontWeight: '800' }, muted: { color: '#929FBB', fontSize: 12, lineHeight: 19, marginTop: 5 }, dot: { width: 10, height: 10, borderRadius: 8, backgroundColor: '#34D399' }, primaryButton: { backgroundColor: '#7C3AED', borderColor: '#C084FC', borderWidth: 1, borderRadius: 26, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, primarySmall: { backgroundColor: '#7C3AED', borderColor: '#C084FC', borderWidth: 1, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 18, marginTop: 14 }, primaryText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, outlineButton: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: '#3A3D4A' }, outlineText: { color: '#E7E8EF', fontSize: 13, fontWeight: '800' }, outlineSmall: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, marginTop: 14, marginLeft: 10, borderWidth: 1, borderColor: '#3A3D4A' }, sectionTitle: { color: '#E8ECFF', fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginTop: 10, marginBottom: 10 }, bigNumber: { color: '#FFF', fontSize: 30, fontWeight: '900' }, moduleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, pill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 99, backgroundColor: '#1B1E29', borderWidth: 1, borderColor: '#2A2D38' }, pillActive: { backgroundColor: '#24104A', borderColor: '#C084FC', shadowColor: PURPLE, shadowOpacity: 0.45, shadowRadius: 8, elevation: 5 }, pillText: { color: MUTED, fontSize: 12, fontWeight: '700' }, pillTextActive: { color: '#F2E8FF' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 }, quick: { width: '47%', minHeight: 86, backgroundColor: '#0D1220', borderColor: '#384B7A', borderRadius: 24, borderWidth: 1, padding: 14, justifyContent: 'space-between' }, quickIcon: { color: CYAN, fontSize: 21, textShadowColor: PURPLE, textShadowRadius: 10 }, quickLabel: { color: '#FFF', fontWeight: '800' }, warning: { borderColor: '#654B12', backgroundColor: '#17140C' }, warningTitle: { color: '#FACC15', fontWeight: '900', fontSize: 13, letterSpacing: 1 }, pageTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', marginBottom: 16 }, input: { backgroundColor: '#10182A', borderRadius: 22, borderWidth: 1, borderColor: '#2B2E3B', color: '#FFF', paddingHorizontal: 14, height: 48, marginTop: 12 }, moduleItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#202330' }, moduleName: { color: '#FFF', fontSize: 15, fontWeight: '800' }, risk: { color: '#FACC15', fontSize: 9, fontWeight: '900', borderWidth: 1, borderColor: '#6B5312', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }, value: { color: '#67E8F9', fontSize: 12, fontWeight: '900' }, slider: { height: 8, borderRadius: 8, backgroundColor: '#292D39', marginTop: 16, overflow: 'hidden' }, sliderTouchArea: { height: 34, justifyContent: 'center', marginTop: 10 }, sliderTrack: { height: 8, borderRadius: 8, backgroundColor: '#292D39', position: 'relative' }, sliderThumb: { position: 'absolute', width: 20, height: 20, borderRadius: 12, top: -6, marginLeft: -10, borderWidth: 3, borderColor: '#FFF', shadowColor: '#FFF', shadowOpacity: 0.4, shadowRadius: 6, elevation: 5 }, sliderFill: { height: 8, borderRadius: 8 }, hudPreview: { height: 220, backgroundColor: '#080B18', borderRadius: 22, borderWidth: 1, borderColor: CYAN, shadowColor: CYAN, shadowOpacity: 0.28, shadowRadius: 18, elevation: 8, marginTop: 16, padding: 12, position: 'relative' }, hudWatermark: { color: PURPLE, fontWeight: '900' }, hudStats: { color: '#FFF', fontSize: 11, marginTop: 7 }, hudArray: { color: '#FFF', fontSize: 12, position: 'absolute', right: 12, top: 12, textAlign: 'right' }, hotbar: { position: 'absolute', bottom: 18, left: 35, right: 35, flexDirection: 'row', gap: 4 }, hotbarItem: { flex: 1, height: 24, backgroundColor: '#262A35', borderWidth: 1, borderColor: '#454A5B' }, colorChoice: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 2 }, colorLabel: { color: '#FFF', fontSize: 11, fontWeight: '800' }, nav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 78, backgroundColor: '#101219', borderTopWidth: 1, borderTopColor: '#252936', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }, navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 55 }, navIcon: { color: MUTED, fontSize: 22 }, navLabel: { color: MUTED, fontSize: 9, marginTop: 4, fontWeight: '700' },
});
