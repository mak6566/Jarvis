// ═══════════════════════════════════════════════════════════
//  JARVIS v2.0 — Master Controller
//  Iron Man HUD · Puter.js AI · Hybrid Voice + Chat
// ═══════════════════════════════════════════════════════════
'use strict';

// ── Helpers ──────────────────────────────────────────────
const $  = (id) => document.getElementById(id);
const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false });

// ── Localization: command replies speak the language chosen in settings.
//    English is the default/priority; every other language is optional.
//    T(key, ...args) substitutes {0}, {1}… placeholders and falls back to en. ──
const I18N = {
  en: {
    yesSir: "Yes, sir?",
    opening: "Opening {0}, sir.",
    searching: "Searching for \"{0}\", sir.",
    navigating: "Navigating to {0}, sir.",
    clicking: "Clicking \"{0}\", sir.",
    time: "The current time is {0}, sir.",
    date: "Today is {0}.",
    status: "All systems nominal, sir. JARVIS v2.1 online. Puter AI: {0}. Model: {1}.",
    connected: "connected",
    offline: "offline",
    model: "Current AI model is {0}.",
    stop: "Of course, sir.",
    readFail: "I could not read this page, sir.",
    greeting: "Good day. All systems are online. How may I assist you?",
    help: "Voice control ready, sir. Try: 'open gmail', 'search for weather', 'show links' then 'click 5', 'scroll down', 'new tab', 'reload', 'zoom in', or just ask me anything.",
    micNotEnabled: "Microphone is not enabled yet. I opened a one-time permission tab — click \"ENABLE MICROPHONE\" there and come back.",
    micDenied: "Microphone permission denied.",
    micNotFound: "No usable microphone was found.",
    micEnabled: "Microphone enabled. Listening is back online.",
    aiError: "I encountered an error with the AI request, sir."
  },
  sk: {
    yesSir: "Áno, pane?",
    opening: "Otváram {0}, pane.",
    searching: "Hľadám \"{0}\", pane.",
    navigating: "Prechádzam na {0}, pane.",
    clicking: "Klikám na \"{0}\", pane.",
    time: "Aktuálny čas je {0}, pane.",
    date: "Dnes je {0}.",
    status: "Všetky systémy v poriadku, pane. JARVIS v2.1 online. Puter AI: {0}. Model: {1}.",
    connected: "pripojený",
    offline: "offline",
    model: "Aktuálny AI model je {0}.",
    stop: "Samozrejme, pane.",
    readFail: "Nepodarilo sa mi prečítať túto stránku, pane.",
    greeting: "Dobrý deň. Všetky systémy sú online. Ako vám môžem pomôcť?",
    help: "Hlasové ovládanie pripravené, pane. Skúste: 'otvor gmail', 'hľadaj počasie', 'ukáž odkazy' a potom 'klikni 5', 'roluj dole', 'nová karta', 'obnov', 'priblíž' — alebo sa ma spýtajte čokoľvek.",
    micNotEnabled: "Mikrofón ešte nie je povolený. Otvoril som jednorazovú kartu povolenia — kliknite tam na \"ENABLE MICROPHONE\" a vráťte sa.",
    micDenied: "Povolenie mikrofónu bolo zamietnuté.",
    micNotFound: "Nenašiel sa žiadny použiteľný mikrofón.",
    micEnabled: "Mikrofón povolený. Počúvanie je opäť online.",
    aiError: "Vyskytla sa chyba pri požiadavke na AI, pane."
  },
  cs: {
    yesSir: "Ano, pane?",
    opening: "Otevírám {0}, pane.",
    searching: "Hledám \"{0}\", pane.",
    navigating: "Přecházím na {0}, pane.",
    clicking: "Klikám na \"{0}\", pane.",
    time: "Aktuální čas je {0}, pane.",
    date: "Dnes je {0}.",
    status: "Všechny systémy v pořádku, pane. JARVIS v2.1 online. Puter AI: {0}. Model: {1}.",
    connected: "připojen",
    offline: "offline",
    model: "Aktuální AI model je {0}.",
    stop: "Samozřejmě, pane.",
    readFail: "Nepodařilo se mi přečíst tuto stránku, pane.",
    greeting: "Dobrý den. Všechny systémy jsou online. Jak vám mohu pomoci?",
    help: "Hlasové ovládání připraveno, pane. Zkuste: 'otevři gmail', 'hledej počasí', 'ukaž odkazy' a pak 'klikni 5', 'roluj dolů', 'nová karta', 'obnov', 'přiblíž' — nebo se mě na cokoli zeptejte.",
    micNotEnabled: "Mikrofon zatím není povolen. Otevřel jsem kartu povolení — klikněte tam na \"ENABLE MICROPHONE\" a vraťte se.",
    micDenied: "Povolení mikrofonu bylo zamítnuto.",
    micNotFound: "Nebyl nalezen žádný použitelný mikrofon.",
    micEnabled: "Mikrofon povolen. Poslech je opět online.",
    aiError: "Vyskytla se chyba při požadavku na AI, pane."
  },
  de: {
    yesSir: "Ja, Sir?",
    opening: "Öffne {0}, Sir.",
    searching: "Suche nach \"{0}\", Sir.",
    navigating: "Navigiere zu {0}, Sir.",
    clicking: "Klicke auf \"{0}\", Sir.",
    time: "Die aktuelle Uhrzeit ist {0}, Sir.",
    date: "Heute ist {0}.",
    status: "Alle Systeme nominal, Sir. JARVIS v2.1 online. Puter AI: {0}. Modell: {1}.",
    connected: "verbunden",
    offline: "offline",
    model: "Das aktuelle KI-Modell ist {0}.",
    stop: "Natürlich, Sir.",
    readFail: "Ich konnte diese Seite nicht lesen, Sir.",
    greeting: "Guten Tag. Alle Systeme sind online. Wie kann ich Ihnen helfen?",
    help: "Sprachsteuerung bereit, Sir. Versuchen Sie: 'öffne gmail', 'suche Wetter', 'zeige Links' und dann 'klicke 5', 'scrolle runter', 'neuer Tab', 'neu laden', 'zoomen' — oder fragen Sie mich einfach etwas.",
    micNotEnabled: "Das Mikrofon ist noch nicht aktiviert. Ich habe eine einmalige Berechtigungsseite geöffnet — klicken Sie dort auf \"ENABLE MICROPHONE\" und kommen Sie zurück.",
    micDenied: "Mikrofonberechtigung verweigert.",
    micNotFound: "Kein verwendbares Mikrofon gefunden.",
    micEnabled: "Mikrofon aktiviert. Das Zuhören ist wieder online."
  },
  fr: {
    yesSir: "Oui, monsieur ?",
    opening: "J'ouvre {0}, monsieur.",
    searching: "Je recherche \"{0}\", monsieur.",
    navigating: "Je vais sur {0}, monsieur.",
    clicking: "Je clique sur \"{0}\", monsieur.",
    time: "Il est actuellement {0}, monsieur.",
    date: "Aujourd'hui, c'est le {0}.",
    status: "Tous les systèmes sont opérationnels, monsieur. JARVIS v2.1 en ligne. Puter AI : {0}. Modèle : {1}.",
    connected: "connecté",
    offline: "hors ligne",
    model: "Le modèle IA actuel est {0}.",
    stop: "Bien sûr, monsieur.",
    readFail: "Je n'ai pas pu lire cette page, monsieur.",
    greeting: "Bonjour. Tous les systèmes sont en ligne. Comment puis-je vous aider ?",
    help: "Contrôle vocal prêt, monsieur. Essayez : 'ouvrir gmail', 'chercher la météo', 'afficher les liens' puis 'cliquer 5', 'défiler vers le bas', 'nouvel onglet', 'recharger', 'zoomer' — ou posez-moi simplement une question.",
    micNotEnabled: "Le microphone n'est pas encore activé. J'ai ouvert un onglet d'autorisation unique — cliquez sur \"ENABLE MICROPHONE\" là-bas puis revenez.",
    micDenied: "Autorisation du microphone refusée.",
    micNotFound: "Aucun microphone utilisable trouvé.",
    micEnabled: "Microphone activé. L'écoute est de nouveau en ligne."
  },
  es: {
    yesSir: "¿Sí, señor?",
    opening: "Abriendo {0}, señor.",
    searching: "Buscando \"{0}\", señor.",
    navigating: "Navegando a {0}, señor.",
    clicking: "Haciendo clic en \"{0}\", señor.",
    time: "La hora actual es {0}, señor.",
    date: "Hoy es {0}.",
    status: "Todos los sistemas en orden, señor. JARVIS v2.1 en línea. Puter AI: {0}. Modelo: {1}.",
    connected: "conectado",
    offline: "sin conexión",
    model: "El modelo de IA actual es {0}.",
    stop: "Por supuesto, señor.",
    readFail: "No pude leer esta página, señor.",
    greeting: "Buenos días. Todos los sistemas están en línea. ¿Cómo puedo ayudarle?",
    help: "Control por voz listo, señor. Pruebe: 'abrir gmail', 'buscar el tiempo', 'mostrar enlaces' y luego 'clic en 5', 'desplazar hacia abajo', 'nueva pestaña', 'recargar', 'acercar' — o simplemente pregúnteme cualquier cosa.",
    micNotEnabled: "El micrófono aún no está habilitado. Abrí una pestaña de permiso único — haga clic en \"ENABLE MICROPHONE\" allí y vuelva.",
    micDenied: "Permiso de micrófono denegado.",
    micNotFound: "No se encontró ningún micrófono utilizable.",
    micEnabled: "Micrófono habilitado. La escucha está de nuevo en línea."
  },
  it: {
    yesSir: "Sì, signore?",
    opening: "Apro {0}, signore.",
    searching: "Cerco \"{0}\", signore.",
    navigating: "Vado su {0}, signore.",
    clicking: "Clicco su \"{0}\", signore.",
    time: "L'ora attuale è {0}, signore.",
    date: "Oggi è il {0}.",
    status: "Tutti i sistemi in ordine, signore. JARVIS v2.1 online. Puter AI: {0}. Modello: {1}.",
    connected: "connesso",
    offline: "offline",
    model: "Il modello AI attuale è {0}.",
    stop: "Certo, signore.",
    readFail: "Non ho potuto leggere questa pagina, signore.",
    greeting: "Buongiorno. Tutti i sistemi sono online. Come posso aiutarla?",
    help: "Controllo vocale pronto, signore. Provi: 'apri gmail', 'cerca il meteo', 'mostra i link' e poi 'clicca 5', 'scorri in basso', 'nuova scheda', 'ricarica', 'zoom avanti' — o semplicemente mi chieda qualsiasi cosa.",
    micNotEnabled: "Il microfono non è ancora abilitato. Ho aperto una scheda di autorizzazione una tantum — clicchi su \"ENABLE MICROPHONE\" lì e torni.",
    micDenied: "Permesso del microfono negato.",
    micNotFound: "Nessun microfono utilizzabile trovato.",
    micEnabled: "Microfono abilitato. L'ascolto è di nuovo online."
  },
  pt: {
    yesSir: "Sim, senhor?",
    opening: "A abrir {0}, senhor.",
    searching: "A procurar \"{0}\", senhor.",
    navigating: "A navegar para {0}, senhor.",
    clicking: "A clicar em \"{0}\", senhor.",
    time: "A hora atual é {0}, senhor.",
    date: "Hoje é {0}.",
    status: "Todos os sistemas em ordem, senhor. JARVIS v2.1 online. Puter AI: {0}. Modelo: {1}.",
    connected: "ligado",
    offline: "offline",
    model: "O modelo de IA atual é {0}.",
    stop: "Claro, senhor.",
    readFail: "Não consegui ler esta página, senhor.",
    greeting: "Bom dia. Todos os sistemas estão online. Como posso ajudar?",
    help: "Controlo por voz pronto, senhor. Experimente: 'abrir gmail', 'procurar o tempo', 'mostrar links' e depois 'clicar em 5', 'rolar para baixo', 'novo separador', 'recarregar', 'aproximar' — ou simplesmente pergunte-me qualquer coisa.",
    micNotEnabled: "O microfone ainda não está ativado. Abri um separador de permissão única — clique em \"ENABLE MICROPHONE\" lá e volte.",
    micDenied: "Permissão do microfone negada.",
    micNotFound: "Nenhum microfone utilizável encontrado.",
    micEnabled: "Microfone ativado. A audição está novamente online."
  },
  pl: {
    yesSir: "Tak, sir?",
    opening: "Otwieram {0}, sir.",
    searching: "Szukam \"{0}\", sir.",
    navigating: "Przechodzę do {0}, sir.",
    clicking: "Klikam na \"{0}\", sir.",
    time: "Aktualna godzina to {0}, sir.",
    date: "Dziś jest {0}.",
    status: "Wszystkie systemy sprawne, sir. JARVIS v2.1 online. Puter AI: {0}. Model: {1}.",
    connected: "połączony",
    offline: "offline",
    model: "Obecny model AI to {0}.",
    stop: "Oczywiście, sir.",
    readFail: "Nie udało mi się przeczytać tej strony, sir.",
    greeting: "Dzień dobry. Wszystkie systemy są online. W czym mogę pomóc?",
    help: "Sterowanie głosowe gotowe, sir. Spróbuj: 'otwórz gmaila', 'szukaj pogody', 'pokaż linki', a potem 'kliknij 5', 'przewiń w dół', 'nowa karta', 'odśwież', 'przybliż' — albo po prostu zapytaj mnie o cokolwiek.",
    micNotEnabled: "Mikrofon nie jest jeszcze włączony. Otworzyłem jednorazową kartę uprawnień — kliknij tam \"ENABLE MICROPHONE\" i wróć.",
    micDenied: "Odmowa dostępu do mikrofonu.",
    micNotFound: "Nie znaleziono użytecznego mikrofonu.",
    micEnabled: "Mikrofon włączony. Słuchanie wraca do pracy."
  },
  hu: {
    yesSir: "Igen, uram?",
    opening: "Megnyitom: {0}, uram.",
    searching: "Keresem: \"{0}\", uram.",
    navigating: "Navigálok ide: {0}, uram.",
    clicking: "Kattintok: \"{0}\", uram.",
    time: "A pontos idő: {0}, uram.",
    date: "Ma {0} van.",
    status: "Minden rendszer rendben, uram. JARVIS v2.1 online. Puter AI: {0}. Modell: {1}.",
    connected: "csatlakoztatva",
    offline: "offline",
    model: "A jelenlegi AI-modell: {0}.",
    stop: "Természetesen, uram.",
    readFail: "Nem tudtam elolvasni ezt az oldalt, uram.",
    greeting: "Jó napot! Minden rendszer online. Miben segíthetek?",
    help: "Hangvezérlés kész, uram. Próbálja: 'gmail megnyitása', 'időjárás keresése', 'linkek mutatása', majd '5-re kattintás', 'görgess le', 'új lap', 'újratöltés', 'nagyítás' — vagy csak kérdezzen bármit.",
    micNotEnabled: "A mikrofon még nincs engedélyezve. Megnyitottam egy egyszeri engedélyezési lapot — kattintson ott az \"ENABLE MICROPHONE\" gombra, majd jöjjön vissza.",
    micDenied: "A mikrofon engedély megtagadva.",
    micNotFound: "Nem található használható mikrofon.",
    micEnabled: "Mikrofon engedélyezve. A hallgatás ismét online."
  },
  nl: {
    yesSir: "Ja, meneer?",
    opening: "Ik open {0}, meneer.",
    searching: "Ik zoek naar \"{0}\", meneer.",
    navigating: "Ik ga naar {0}, meneer.",
    clicking: "Ik klik op \"{0}\", meneer.",
    time: "De huidige tijd is {0}, meneer.",
    date: "Vandaag is het {0}.",
    status: "Alle systemen in orde, meneer. JARVIS v2.1 online. Puter AI: {0}. Model: {1}.",
    connected: "verbonden",
    offline: "offline",
    model: "Het huidige AI-model is {0}.",
    stop: "Natuurlijk, meneer.",
    readFail: "Ik kon deze pagina niet lezen, meneer.",
    greeting: "Goedendag. Alle systemen zijn online. Waarmee kan ik u helpen?",
    help: "Spraakbesturing klaar, meneer. Probeer: 'open gmail', 'zoek het weer', 'toon links' en dan 'klik op 5', 'scroll omlaag', 'nieuw tabblad', 'verversen', 'inzoomen' — of vraag me gewoon iets.",
    micNotEnabled: "De microfoon is nog niet ingeschakeld. Ik heb een eenmalig tabblad met toestemming geopend — klik daar op \"ENABLE MICROPHONE\" en kom terug.",
    micDenied: "Toestemming voor microfoon geweigerd.",
    micNotFound: "Geen bruikbare microfoon gevonden.",
    micEnabled: "Microfoon ingeschakeld. Luisteren is weer online."
  },
  ru: {
    yesSir: "Да, сэр?",
    opening: "Открываю {0}, сэр.",
    searching: "Ищу \"{0}\", сэр.",
    navigating: "Перехожу к {0}, сэр.",
    clicking: "Нажимаю на \"{0}\", сэр.",
    time: "Текущее время — {0}, сэр.",
    date: "Сегодня {0}.",
    status: "Все системы в норме, сэр. JARVIS v2.1 онлайн. Puter AI: {0}. Модель: {1}.",
    connected: "подключено",
    offline: "офлайн",
    model: "Текущая модель ИИ — {0}.",
    stop: "Конечно, сэр.",
    readFail: "Не удалось прочитать эту страницу, сэр.",
    greeting: "Добрый день. Все системы в сети. Чем могу помочь?",
    help: "Голосовое управление готово, сэр. Попробуйте: 'открой gmail', 'ищи погоду', 'покажи ссылки', затем 'кликни 5', 'прокрути вниз', 'новая вкладка', 'обновить', 'приблизить' — или просто спросите меня о чём угодно.",
    micNotEnabled: "Микрофон ещё не включён. Я открыл вкладку разрешения — нажмите там \"ENABLE MICROPHONE\" и вернитесь.",
    micDenied: "В доступе к микрофону отказано.",
    micNotFound: "Не найден подходящий микрофон.",
    micEnabled: "Микрофон включён. Слушание снова в сети."
  },
  ja: {
    yesSir: "はい、何でしょうか？",
    opening: "{0}を開きます。",
    searching: "「{0}」を検索しています。",
    navigating: "{0}に移動します。",
    clicking: "「{0}」をクリックします。",
    time: "現在の時刻は{0}です。",
    date: "今日は{0}です。",
    status: "全システム正常、JARVIS v2.1 オンライン。Puter AI: {0}。モデル: {1}。",
    connected: "接続済み",
    offline: "オフライン",
    model: "現在のAIモデルは{0}です。",
    stop: "かしこまりました。",
    readFail: "このページを読み取れませんでした。",
    greeting: "こんにちは。全システムがオンラインです。何かお手伝いできますか？",
    help: "音声操作の準備ができました。「gmailを開いて」「天気を検索して」「リンクを表示して」次に「5をクリック」「下にスクロール」「新しいタブ」「再読み込み」「ズームイン」— または何でも質問してください。",
    micNotEnabled: "マイクがまだ有効になっていません。許可ページを開きました — そこで「ENABLE MICROPHONE」をクリックして戻ってください。",
    micDenied: "マイクの許可が拒否されました。",
    micNotFound: "使用可能なマイクが見つかりません。",
    micEnabled: "マイクが有効になりました。リスニングが再開しました。"
  }
};

function T(key, ...args) {
  const lang = (S.settings.lang || 'en-US').split('-')[0].toLowerCase();
  let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  args.forEach((a, i) => { s = s.split('{' + i + '}').join(String(a)); });
  return s;
}

// ── App state ────────────────────────────────────────────
const S = {
  jarvisState: 'idle',      // idle | listening | thinking | speaking
  recognition: null,
  utterance:   null,
  puterReady:  false,
  puterUser:   null,
  history:     [],          // rolling conversation memory [{role, content}]
  wakeMode:    false,       // passively listening for the wake word
  wakeArmed:   false,       // true = next transcript is a command, not a hotword
  settings: {
    model:       'inclusionai/ling-3.0-flash:free',
    rate:        1.1,
    pitch:       1.0,
    lang:        'en-US',
    speakAI:     true,
    continuous:  false,
    wakeword:    'jarvis',
    wakeActivation: true,   // passively listen for the wake word and auto-arm
    indicator:   true,
    voice:       'Google US English',  // default: the US female voice the user likes
    listenWindow: 6,          // seconds JARVIS listens after the wake word
    recogLang:   'en-US',     // language used to HEAR commands (independent of voice lang)
    meter:       false,        // live mic-level meter (OFF by default — a 2nd capture can kill SR)
    micBoost:    true,         // far-field mic boost (AGC on, noise-suppression off, more SR alternatives)
  },
  _listenTimer: null,
};

// ── DOM refs ─────────────────────────────────────────────
const el = {
  root:         $('jarvisRoot'),
  // Auth
  authOverlay:  $('authOverlay'),
  authBtn:      $('authBtn'),
  authStatus:   $('authStatus'),
  authInfo:     $('authInfo'),
  authActionBtn:$('authActionBtn'),
  // Header
  stateLabel:   $('stateLabel'),
  statusPip:    $('statusPip'),
  puterBadge:   $('puterBadge'),
  // Stats
  svSys:        $('sv-sys'),
  svMic:        $('sv-mic'),
  svAi:         $('sv-ai'),
  svTts:        $('sv-tts'),
  // HUD
  reactorTxt:   $('reactorStateTxt'),
  micBtn:       $('micBtn'),
  micLabel:     $('micLabel'),
  lastHeard:    $('lastHeard'),
  // Chat
  chatFeed:     $('chatFeed'),
  chatInput:    $('chatInput'),
  chatSend:     $('chatSend'),
  chatMicBtn:   $('chatMicBtn'),
  // Log
  logFeed:      $('logFeed'),
  clearLogBtn:  $('clearLogBtn'),
  bootTs:       $('bootTs'),
  // Settings
  modelList:    $('modelList'),
  rateSlider:   $('rateSlider'),
  rateOut:      $('rateOut'),
  pitchSlider:  $('pitchSlider'),
  pitchOut:     $('pitchOut'),
  langSel:      $('langSel'),
  tglSpeak:     $('tglSpeak'),
  tglContinuous:$('tglContinuous'),
  wakewordInput:$('wakewordInput'),
  tglWakeActivation: $('tglWakeActivation'),
  tglIndicator: $('tglIndicator'),
  saveCfgBtn:   $('saveCfgBtn'),
  voiceTrigger: $('voiceTrigger'),
  voiceTriggerLabel: $('voiceTriggerLabel'),
  voiceDrop:    $('voiceDrop'),
  voicePanel:   $('voicePanel'),
  voiceSearch:  $('voiceSearch'),
  voiceList:    $('voiceList'),
  recogSel:     $('recogSel'),
  listenSlider: $('listenSlider'),
  listenOut:    $('listenOut'),
  stageStrip:   $('stageStrip'),
};

// ── Sci-fi UI sounds (WebAudio, no assets, quiet) ───────────────────
let _sfxCtx = null;
function sfx(freq = 660, dur = 0.06, type = 'sine', vol = 0.02, slideTo = 0) {
  try {
    if (!_sfxCtx) _sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_sfxCtx.state === 'suspended') _sfxCtx.resume();
    const t = _sfxCtx.currentTime;
    const osc = _sfxCtx.createOscillator();
    const g = _sfxCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    osc.connect(g).connect(_sfxCtx.destination);
    osc.start(t); osc.stop(t + dur + 0.03);
  } catch (_) {}
}

function clickSfx(el) {
  if (!el || !el.closest) return;
  if (el.closest('.vdd-opt') || el.closest('.vdd-trigger')) return; // dropdown plays its own tones
  if (el.closest('.tab-btn'))       return sfx(520, 0.05, 'triangle', 0.022, 760);
  if (el.closest('.chat-send'))     return sfx(840, 0.05, 'sine', 0.028, 1200);
  if (el.closest('.chat-mic-btn'))  return sfx(320, 0.08, 'sawtooth', 0.02, 140);
  if (el.closest('.mic-btn'))       return sfx(240, 0.1, 'sawtooth', 0.024, 80);
  if (el.closest('.log-btn'))       return sfx(700, 0.04, 'triangle', 0.02, 900);
  if (el.closest('.cmd-chip'))      return sfx(600, 0.04, 'triangle', 0.018, 850);
  if (el.closest('.model-row'))     return sfx(470, 0.05, 'sine', 0.018, 620);
  if (el.closest('.voice-test-btn')) return sfx(760, 0.09, 'sine', 0.03, 980);
  if (el.closest('.auth-action-btn')) return sfx(430, 0.06, 'sine', 0.02, 260);
  if (el.closest('.save-cfg-btn'))  return sfx(660, 0.05, 'sine', 0.024, 440);
  sfx(600, 0.045, 'sine', 0.02, 820);
}

function initSfx() {
  document.addEventListener('click', (e) => clickSfx(e.target), true);
}

document.addEventListener('DOMContentLoaded', async () => {
  el.bootTs.textContent = ts();
  loadSettings();
  initTabs();
  initMicBtn();
  initChat();
  initLog();
  initSettings();
  initSfx();
  refreshVoices();
  drawTickMarks();
  loadPuterSDK();   // start loading the 364KB SDK in the background — UI renders instantly
  initPuterAuth();
  setState('idle');
  log('info', 'JARVIS v2.1 boot sequence complete');

});

// ═══════════════════════════════════════════════════════════
//  WAKE-WORD LISTENING MODE
// ═══════════════════════════════════════════════════════════
function enableWakeMode(on) {
  S.wakeMode = !!on;
  S.wakeArmed = false;
  S.wakeFatalRetries = 0;
  clearTimeout(S._listenTimer);
  clearInterval(S._watchdog);
  S._watchdog = null;
  if (on) {
    el.root?.classList.add('wake-listening');
    el.micLabel.textContent = 'STANDBY';
    log('info', `Wake mode ON — say "${S.settings.wakeword}" to activate.`);
    if (S.jarvisState === 'idle') startListening(false);
    startWatchdog();
  } else {
    el.root?.classList.remove('wake-listening');
    log('info', 'Wake mode OFF');
    if (S.jarvisState === 'listening') stopListening();
  }
}

// Wake word heard → arm JARVIS for one command. He listens for
// S.settings.listenWindow seconds; silence disarms back to STANDBY.
function armWake() {
  S.wakeArmed = true;
  el.root?.classList.remove('wake-listening');
  setState('listening');
  clearTimeout(S._listenTimer);
  S._listenTimer = setTimeout(() => {
    if (!S.wakeArmed) return;
    log('info', 'No command heard — back to standby.');
    disarmWake();
  }, (S.settings.listenWindow || 6) * 1000);

  // Short audible acknowledgement in the SELECTED language/voice (incl.
  // Google Translate voices). beginSpeech() mutes the mic so JARVIS never
  // hears his own "Yes, sir?"; endSpeech() (inside speakGtts/speakNative)
  // restarts the mic and returns to the LISTENING window for the command.
  try {
    const av = pickVoice();
    if (av && av.type === 'gtts') speakGtts(T('yesSir'), av.lang);
    else speakNative(T('yesSir'));
  } catch (_) {}
}

// Self-healing watchdog: Chrome occasionally closes the offscreen audio
// document (or recognition dies) while the panel still thinks it is passively
// listening. Every few seconds we ping the offscreen module and restart it the
// moment it stops answering — so wake-word listening never silently dies.
function startWatchdog() {
  clearInterval(S._watchdog);
  S._watchdog = setInterval(async () => {
    if (!S.wakeMode || _starting || S.jarvisState === 'speaking') return;
    let alive = false;
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'JARVIS_SR_PING' });
      alive = !!(resp && (resp.recognizing === true || resp.shouldRun === true));
    } catch (_) { alive = false; }
    if (!alive) {
      log('warn', 'Passive listener stopped — restarting automatically…');
      S.wakeArmed = false;
      startListening(false);
    }
  }, 6000);
}

function disarmWake() {
  if (!S.wakeArmed) return;
  S.wakeArmed = false;
  clearTimeout(S._listenTimer);
  if (S.wakeMode) {
    el.root?.classList.add('wake-listening');
    setState('idle');
    el.micLabel.textContent = 'STANDBY';
  }
}

// Fuzzy wake-word detection — tolerates misheard hotwords ("jarvís", "dzarvis"...).
function wakeWordHit(transcript) {
  const tokens = normalizeText(transcript).split(' ');
  const ww = normalizeText(S.settings.wakeword).trim() || 'jarvis';
  const wwTok = ww.split(' ');
  for (let i = 0; i < tokens.length; i++) {
    const c = wordClose(tokens[i], wwTok[0]);
    if (c === 0 || (wwTok[0].length >= 4 && c <= 1) || (wwTok[0].length >= 6 && c <= 2)) {
      return { after: tokens.slice(i + wwTok.length).join(' ').trim() };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
//  STATE MACHINE
// ═══════════════════════════════════════════════════════════
const STATE_META = {
  idle:      { label: 'IDLE',       sys: 'NOMINAL', mic: 'OFF',    ai: 'READY',   tts: 'IDLE' },
  listening: { label: 'LISTENING',  sys: 'ACTIVE',  mic: 'ACTIVE', ai: 'STANDBY', tts: 'IDLE' },
  thinking:  { label: 'PROCESSING', sys: 'ACTIVE',  mic: 'PAUSED', ai: 'WORKING', tts: 'IDLE' },
  speaking:  { label: 'SPEAKING',   sys: 'ACTIVE',  mic: 'PAUSED', ai: 'DONE',    tts: 'ACTIVE' },
};

function setState(s) {
  S.jarvisState = s;
  el.root.dataset.state = s;
  const m = STATE_META[s] || STATE_META.idle;
  el.stateLabel.textContent  = m.label;
  el.reactorTxt.textContent  = m.label;
  el.svSys.textContent       = m.sys;
  el.svMic.textContent       = m.mic;
  el.svAi.textContent        = m.ai;
  el.svTts.textContent       = m.tts;

  // Execution-stage stepper: HEAR → DECODE/EXECUTE → SPEAK
  if (el.stageStrip) {
    const stages = el.stageStrip.querySelectorAll('.stage');
    stages.forEach((st) => st.classList.remove('active'));
    if (s === 'listening') stages[0]?.classList.add('active');
    else if (s === 'thinking') { stages[1]?.classList.add('active'); stages[2]?.classList.add('active'); }
    else if (s === 'speaking') stages[3]?.classList.add('active');
  }
}

// ═══════════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════════
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  PUTER.JS AUTHENTICATION — token-based (reliable inside the extension)
// ═══════════════════════════════════════════════════════════
// puter.auth.signIn() popup inside a chrome-extension:// page does not return
// the token reliably, which is why "AI error: unauthorized" appears. Instead
// we let the user sign in on puter.com in a real tab, read the auth token from
// there (via the background service worker) and inject it into the extension's
// puter instance with puter.setAuthToken(token). The token is stored in
// chrome.storage so the user only has to sign in once.

const TOKEN_STORE_KEY = 'jarvisPuterToken';

function puterAvailable() {
  return typeof puter !== 'undefined' && !!puter?.auth;
}

function applyToken(token) {
  if (typeof puter === 'undefined' || !token) return false;
  try {
    // Root puter.setAuthToken propagates the token to ALL submodules (incl. ai)
    // and persists it to localStorage. puter.auth.setAuthToken would only set the auth module.
    if (typeof puter.setAuthToken === 'function') puter.setAuthToken(token);
    else if (puter.auth?.setAuthToken) puter.auth.setAuthToken(token);
    return true;
  } catch (e) {
    log('error', `setAuthToken failed: ${e?.message || e}`);
    return false;
  }
}

function saveToken(token) {
  return new Promise((res) => chrome.storage.local.set({ [TOKEN_STORE_KEY]: token }, res));
}
function loadStoredToken() {
  return new Promise((res) => chrome.storage.local.get(TOKEN_STORE_KEY, (r) => res(r?.[TOKEN_STORE_KEY] || null)));
}
function clearToken() {
  return new Promise((res) => chrome.storage.local.remove(TOKEN_STORE_KEY, res));
}

async function verifyUser() {
  if (!puterAvailable()) return null;
  try {
    if (!puter.auth.isSignedIn()) return null;
    const user = await puter.auth.getUser();
    // Reject temporary / guest users — they cannot use puter.ai.chat and would
    // otherwise silently sign the user in as a guest, hiding the real login UI.
    if (!user) return null;
    if (user.is_temp === true) return null;
    if (typeof user.username === 'string' && /^temp_/i.test(user.username)) return null;
    return user;
  } catch (_) {
    return null;
  }
}

async function initPuterAuth() {
  await loadPuterSDK();
  hideAuthOverlay();

  if (!puterAvailable()) {
    log('error', 'Puter.js failed to load.');
    updatePuterUI(false, null);
  } else {
    // 1) restore token stored in the extension
    const stored = await loadStoredToken();
    if (stored) applyToken(stored);

    // 2) verify the user (rejects temp / guest sessions)
    let user = await withTimeout(verifyUser(), 2500, null);

    // If the stored token belonged to a temp/guest user, drop it so we do not
    // keep applying a token that cannot use puter.ai.chat.
    if (!user && stored) {
      try { puter.auth.signOut(); } catch (_) {}
      await clearToken();
    }

    // 3) if no valid user yet, silently try to grab a token from an open
    //    puter.com tab (background rejects tabs without `logged_in_users`).
    if (!user) {
      const token = await withTimeout(requestToken('PUTER_GET_TOKEN'), 3000, null);
      if (token) {
        applyToken(token);
        user = await verifyUser();
        if (user) await saveToken(token);
        else {
          try { puter.auth.signOut(); } catch (_) {}
          await clearToken();
        }
      }
    }

    if (user) onPuterSignedIn(user);
    else updatePuterUI(false, null);
  }

  el.authActionBtn?.addEventListener('click', () => onAuthButton(el.authActionBtn));
  el.authBtn?.addEventListener('click', () => onAuthButton(el.authBtn));
}

async function onAuthButton(btn) {
  if (S.puterReady) {
    // Sign out
    try { puter.auth.signOut(); } catch (_) {}
    await clearToken();
    onPuterSignedOut();
    return;
  }
  await doConnect(btn);
}

// ── Lazy Puter.js SDK loader ───────────────────────────────────────
// puter.js is ~360 KB; loading it as a blocking script in popup.html made
// the whole side panel feel slow to open. It is now injected asynchronously —
// the panel renders instantly and the AI stack comes online moments later.
let _puterLoading = null;
function loadPuterSDK() {
  if (typeof puter !== 'undefined') return Promise.resolve(true);
  if (_puterLoading) return _puterLoading;
  _puterLoading = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'puter.js';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => { log('error', 'Puter.js failed to load — check your connection.'); resolve(false); };
    document.head.appendChild(s);
  });
  return _puterLoading;
}

// Resolve with the fallback value if the promise does not settle in ms —
// the boot sequence must never hang on a slow or unreachable puter.com.
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((r) => setTimeout(() => r(fallback), ms))
  ]);
}

function requestToken(type) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (res) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(res?.token || null);
    });
  });
}

// Returns true if the connection succeeded.
async function doConnect(btn) {
  if (!puterAvailable()) {
    log('error', 'Puter.js is not available.');
    return false;
  }
  const prevLabel = btn?.textContent;
  if (btn) { btn.textContent = 'CONNECTING…'; btn.disabled = true; }
  log('info', 'Opening puter.com — sign-in continues in that tab…');
  addMsg('jarvis', 'JARVIS', 'Opening puter.com, sir — sign in there (or you may already be signed in). I will connect the moment your token is available. You can leave the tab open.');

  try {
    const token = await requestToken('PUTER_CONNECT');
    if (!token) {
      log('error', 'Could not retrieve Puter token (sign-in not completed).');
      addMsg('err', 'JARVIS', 'Sign-in was not completed. Please try again, sir.');
      updatePuterUI(false, null);
      return false;
    }
    applyToken(token);
    const user = await verifyUser();
    if (user) {
      await saveToken(token);
      onPuterSignedIn(user);
      return true;
    }
    // Token exists but user is a temp/guest — drop it so we do not keep a bad
    // token around, and prompt the user to actually sign in.
    try { puter.auth.signOut(); } catch (_) {}
    await clearToken();
    log('error', 'Sign-in did not complete (guest session detected).');
    addMsg('err', 'JARVIS', 'That looks like a guest session, sir. Please sign in to your Puter account and try again.');
    updatePuterUI(false, null);
    return false;
  } catch (e) {
    log('error', `Connection failed: ${e?.message || e}`);
    updatePuterUI(false, null);
    return false;
  } finally {
    if (btn) { btn.disabled = false; if (!S.puterReady && prevLabel) btn.textContent = prevLabel; }
  }
}

function onPuterSignedIn(user) {
  S.puterReady = true;
  S.puterUser  = user;
  updatePuterUI(true, user);
  log('success', `Puter connected as: ${user?.username || 'user'}`);
}

function onPuterSignedOut() {
  S.puterReady = false;
  S.puterUser  = null;
  updatePuterUI(false, null);
  log('info', 'Puter signed out');
}

function updatePuterUI(online, user) {
  if (el.puterBadge) {
    if (online) {
      const uname = user?.username || 'online';
      el.puterBadge.textContent = `AI: ${uname.slice(0, 8).toUpperCase()}`;
      el.puterBadge.title = `Puter AI online — signed in as ${uname}`;
      el.puterBadge.classList.add('online');
    } else {
      el.puterBadge.textContent = 'AI: READY';
      el.puterBadge.title = 'Puter AI not connected — click CONNECT in Settings';
      el.puterBadge.classList.remove('online');
    }
  }
  if (el.authInfo) el.authInfo.textContent = online ? `@${user?.username || 'connected'}` : 'Not connected';
  if (el.authActionBtn) {
    el.authActionBtn.textContent = online ? 'SIGN OUT' : 'CONNECT';
    el.authActionBtn.className = `auth-action-btn${online ? ' signout' : ''}`;
    el.authActionBtn.disabled = false;
  }
}

function showAuthOverlay() {
  el.authOverlay?.classList.remove('hidden');
}
function hideAuthOverlay() {
  el.authOverlay?.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════
//  VOICE RECOGNITION (runs in the offscreen document, not in the popup)
// ═══════════════════════════════════════════════════════════
// Chrome extension action popups cannot reliably capture the microphone,
// regardless of whether permission was already granted — this is a Chromium
// limitation, not a settings issue. SpeechRecognition therefore runs in a
// hidden offscreen document (offscreen.js) and the popup only sends it
// start/stop commands and receives results back via chrome.runtime messages.
let _chatMicActive = false;

function initMicBtn() {
  el.micBtn.addEventListener('click', toggleMic);
}

function toggleMic() {
  if (S.jarvisState === 'listening') {
    stopListening();
  } else if (S.jarvisState === 'idle') {
    if (S.wakeMode) {
      // Hot mic is already passive — promote it to an active listening window.
      armWake();
      return;
    }
    startListening(false);
  }
}

// A one-time microphone permission must come from a visible tab (neither the
// offscreen document nor the side panel can show the native prompt). The tab is
// opened through the background worker, which guarantees exactly ONE tab ever
// exists — earlier builds spawned a new tab for every failed attempt.
let _micTabRequested = false;
function openMicPermissionTab(reason) {
  if (_micTabRequested) {
    log('warn', 'Microphone permission tab is already open — finish it there.');
    return;
  }
  _micTabRequested = true;
  addMsg('err', 'JARVIS', T('micNotEnabled'));
  log('warn', `Microphone not granted (${reason || 'no permission'}) — opening permission tab`);
  chrome.runtime.sendMessage({ type: 'JARVIS_OPEN_MIC_TAB' }).catch(() => {});
}

async function micPermissionState() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'microphone' });
      return status.state; // 'granted' | 'denied' | 'prompt'
    }
  } catch (_) { /* unsupported */ }
  return 'unknown';
}

let _starting = false;

async function startListening(isChatMic) {
  if (_starting) return;
  _starting = true;
  try {
    const state = await micPermissionState();
    if (state === 'denied') {
      // Hard denial — the user must re-enable the mic in the browser/OS.
      openMicPermissionTab(state);
      return;
    }
    // NOTE: 'prompt' is intentionally NOT blocked here. Chrome's side panel
    // almost always reports 'prompt' even when the mic is already granted, and
    // blocking on it made the manual mic button appear dead. We start and let
    // the offscreen document surface any real error (which opens the tab).

    _chatMicActive = !!isChatMic;
    log('info', 'Starting microphone…');

    const ready = await chrome.runtime.sendMessage({ type: 'JARVIS_ENSURE_OFFSCREEN' });
    if (!ready?.ok) {
      log('error', `Offscreen audio module failed: ${ready?.error || 'unknown error'}`);
      resetMicUI();
      return;
    }
    await chrome.runtime.sendMessage({
      type: 'JARVIS_SR_START',
      lang: S.settings.recogLang || 'en-US',
      continuous: S.settings.continuous || S.wakeMode,
      meter: S.settings.meter === true,
      boost: S.settings.micBoost !== false
    });
  } catch (e) {
    log('error', `Could not start microphone: ${e.message || e}`);
    resetMicUI();
  } finally {
    _starting = false;
  }
}

function stopListening(resetState = true) {
  chrome.runtime.sendMessage({ type: 'JARVIS_SR_STOP' }).catch(() => {});
  S.wakeArmed = false;
  clearTimeout(S._listenTimer);
  resetMicUI(resetState);
  // Keep the passive hot-mic alive after a manual stop so wake mode still works.
  if (S.wakeMode && S.settings.wakeActivation) {
    setTimeout(() => startListening(false), 300);
  }
}

function resetMicUI(resetState = true) {
  el.micBtn.classList.remove('active');
  el.micLabel.textContent = (S.wakeMode && !S.wakeArmed) ? 'STANDBY' : 'ACTIVATE';
  el.chatMicBtn.classList.remove('active');
  if (resetState && S.jarvisState === 'listening') setState('idle');
}

function showMicLevel(on) {
  const wrap = $('micLevelWrap');
  if (wrap) wrap.style.display = on ? 'flex' : 'none';
}


// Messages from offscreen.js (runs independently of whether the popup is open)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'JARVIS_SR_STATE') {
    if (message.state === 'listening') {
      if (S.wakeMode && !S.wakeArmed) {
        // Passive hot-mic: just waiting for the wake word — keep HUD calm.
        el.micLabel.textContent = 'STANDBY';
        return;
      }
      setState('listening');
      S.wakeFatalRetries = 0;
      el.micBtn.classList.add('active');
      el.micLabel.textContent = 'LISTENING…';
      if (_chatMicActive) el.chatMicBtn.classList.add('active');
      showMicLevel(S.settings.meter === true);
      log('info', 'Microphone activated');
    } else {
      if (S.wakeArmed) return; // keep the armed LISTENING UI until the window closes
      showMicLevel(false);
      resetMicUI();
    }
  } else if (message.type === 'JARVIS_MIC_LEVEL') {
    // Live mic input volume (0..1) from the offscreen audio analyser.
    const lvl = Math.min(1, Math.max(0, Number(message.level) || 0));
    const bar = $('micLevelBar'), num = $('micLevelNum');
    if (bar) bar.style.width = `${Math.round(lvl * 100)}%`;
    if (num) num.textContent = String(Math.round(lvl * 100));
  } else if (message.type === 'JARVIS_SR_INTERIM') {
    // Live (unfinished) transcript — show it and keep the listen window open.
    const t = (message.text || '').trim();
    if (!t) return;
    el.lastHeard.textContent = `"${t}…"`;
    if (S.wakeArmed) {
      clearTimeout(S._listenTimer);
      S._listenTimer = setTimeout(disarmWake, (S.settings.listenWindow || 6) * 1000);
    }
  } else if (message.type === 'JARVIS_SR_RESULT') {
    // Chrome returns several alternatives — the top one is often wrong
    // ("Jeremy's" instead of "Jarvis"), so we try them all.
    const alts = (Array.isArray(message.alts) && message.alts.length)
      ? message.alts.map((t) => String(t || '').trim()).filter(Boolean)
      : [String(message.text || '').trim()];
    const transcript = alts[0] || '';
    if (!transcript) return;
    el.lastHeard.textContent = `"${transcript}"`;
    log('info', `Voice: "${transcript}"`);

    // Wake-word activation mode: mic runs passively, only transcripts that
    // start with (or contain) the wake word trigger command processing.
    if (S.wakeMode && !S.wakeArmed) {
      let hit = null;
      for (const a of alts) { const h = wakeWordHit(a); if (h) { hit = h; break; } }
      if (!hit) return; // not the hotword — keep listening silently.
      log('info', 'Wake word detected');
      const after = hit.after;
      if (after) {
        // "Jarvis, open youtube" → run the command right away.
        handleInput(after);
      } else {
        // Just "Jarvis" on its own → arm for the next utterance.
        addMsg('jarvis', 'JARVIS', T('yesSir'));
        armWake();
      }
      return;
    }

    // Normal path (mic tapped manually, or wake mode already armed).
    if (S.wakeMode) {
      S.wakeArmed = false;
      clearTimeout(S._listenTimer);
      el.root?.classList.add('wake-listening');
      el.micLabel.textContent = 'STANDBY';
    }
    if (!S.settings.continuous && !S.wakeMode) stopListening(false);

    // Prefer the alternative that actually matches a local command.
    const best = alts.find((a) => matchCommand(normalizeText(a))) || transcript;
    handleInput(best);
  } else if (message.type === 'JARVIS_SR_ERROR') {
    log('error', `Speech error: ${message.error}`);
    resetMicUI();
    if (message.fatal) {
      // Fatal → the offscreen document already stopped. Don't leave passive
      // listening dead forever: the watchdog retries a few times (the mic or
      // OS may free up), then pauses voice control with a clear message.
      S.wakeFatalRetries = (S.wakeFatalRetries || 0) + 1;
      if (S.settings.wakeActivation && S.wakeFatalRetries <= 6) {
        log('warn', 'Listener failed (' + message.error + ') — will retry automatically.');
      } else {
        S.wakeMode = false;
        el.root?.classList.remove('wake-listening');
        addMsg('err', 'JARVIS', 'Voice control paused after repeated microphone failures. Tap the mic button to restart it.');
      }
    }
    if (message.error === 'not-allowed' || message.error === 'service-not-allowed') {
      addMsg('err', 'JARVIS', T('micDenied'));
      openMicPermissionTab(message.error);
    } else if (message.error === 'audio-capture') {
      addMsg('err', 'JARVIS', T('micNotFound'));
    }
  } else if (message.type === 'JARVIS_MIC_READY') {
    // The permission tab reported success → allow a fresh start and resume.
    _micTabRequested = false;
    log('info', 'Microphone permission granted — restarting listener');
    addMsg('jarvis', 'JARVIS', T('micEnabled'));
    if (S.settings.wakeActivation) {
      enableWakeMode(true);
    } else if (S.jarvisState === 'idle') {
      startListening(false);
    }
  }
});


// ═══════════════════════════════════════════════════════════
//  CHAT INPUT
// ═══════════════════════════════════════════════════════════
function initChat() {
  el.chatSend.addEventListener('click', submitChat);
  el.chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChat(); }
  });
  el.chatMicBtn.addEventListener('click', () => {
    if (S.jarvisState === 'listening') {
      stopListening();
    } else if (S.jarvisState === 'idle') {
      if (S.wakeMode) { armWake(); return; }
      startListening(true);
    }
  });
}

function submitChat() {
  const text = el.chatInput.value.trim();
  if (!text) return;
  el.chatInput.value = '';
  handleInput(text);
}

// ═══════════════════════════════════════════════════════════
//  MASTER INPUT ROUTER
// ═══════════════════════════════════════════════════════════
async function handleInput(raw) {
  const text = raw.trim();
  if (!text) return;

  // Strip wakeword prefix
  const ww = S.settings.wakeword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleaned = text.replace(new RegExp(`^${ww}[,\\.!\\s]+`, 'i'), '').trim() || text;

  addMsg('user', 'YOU', text);

  const cmd = matchCommand(cleaned.toLowerCase());
  if (cmd) {
    log('cmd', `Local command: ${cmd.id}`);
    await runCommand(cmd, cleaned);
  } else {
    await queryAI(cleaned);
  }
}

// ═══════════════════════════════════════════════════════════
//  LOCAL COMMAND MATCHING
// ═══════════════════════════════════════════════════════════
const CMDS = [
  // Sites (fast shortcuts → exact destination)
  { id:'yt',        re:/\b(open\s+)?(youtube|yt)\b/i,       type:'url', url:'https://youtube.com' },
  { id:'google',    re:/\bopen\s+google\b/i,                 type:'url', url:'https://google.com' },
  { id:'gmail',     re:/\bopen\s+gmail\b/i,                  type:'url', url:'https://mail.google.com/mail/u/0/' },
  { id:'drive',     re:/\bopen\s+(google\s+)?drive\b/i,      type:'url', url:'https://drive.google.com' },
  { id:'calendar',  re:/\bopen\s+(google\s+)?calendar\b/i,   type:'url', url:'https://calendar.google.com' },
  { id:'maps',      re:/\bopen\s+(google\s+)?maps\b/i,       type:'url', url:'https://maps.google.com' },
  { id:'translate', re:/\bopen\s+(google\s+)?translate\b/i,  type:'url', url:'https://translate.google.com' },
  { id:'github',    re:/\bopen\s+github\b/i,                 type:'url', url:'https://github.com' },
  { id:'twitter',   re:/\bopen\s+(twitter|x\.com)\b/i,       type:'url', url:'https://x.com' },
  { id:'reddit',    re:/\bopen\s+reddit\b/i,                 type:'url', url:'https://reddit.com' },
  { id:'netflix',   re:/\bopen\s+netflix\b/i,                type:'url', url:'https://netflix.com' },
  { id:'spotify',   re:/\bopen\s+spotify\b/i,                type:'url', url:'https://open.spotify.com' },
  { id:'twitch',    re:/\bopen\s+twitch\b/i,                 type:'url', url:'https://twitch.tv' },
  { id:'linkedin',  re:/\bopen\s+linkedin\b/i,               type:'url', url:'https://linkedin.com/feed/' },
  { id:'instagram', re:/\bopen\s+instagram\b/i,              type:'url', url:'https://instagram.com' },
  { id:'facebook',  re:/\bopen\s+facebook\b/i,               type:'url', url:'https://facebook.com' },
  { id:'whatsapp',  re:/\bopen\s+whatsapp\b/i,               type:'url', url:'https://web.whatsapp.com' },
  { id:'amazon',    re:/\bopen\s+amazon\b/i,                 type:'url', url:'https://amazon.com' },
  { id:'wikipedia', re:/\bopen\s+wikipedia\b/i,              type:'url', url:'https://wikipedia.org' },
  { id:'chatgpt',   re:/\bopen\s+(chatgpt|chat\s*gpt)\b/i,   type:'url', url:'https://chat.openai.com' },
  { id:'puter',     re:/\bopen\s+puter\b/i,                  type:'url', url:'https://puter.com' },

  // Browser internal pages
  { id:'history',   re:/\bopen\s+history\b/i,                type:'bg', cmd:'open_browser_page', arg:{url:'chrome://history'} },
  { id:'downloads', re:/\bopen\s+downloads?\b/i,             type:'bg', cmd:'open_browser_page', arg:{url:'chrome://downloads'} },
  { id:'bmarks',    re:/\bopen\s+bookmarks?\b/i,             type:'bg', cmd:'open_browser_page', arg:{url:'chrome://bookmarks'} },
  { id:'exts',      re:/\bopen\s+extensions?\b/i,            type:'bg', cmd:'open_browser_page', arg:{url:'chrome://extensions'} },
  { id:'bsettings', re:/\bopen\s+(browser\s+)?settings\b/i,  type:'bg', cmd:'open_browser_page', arg:{url:'chrome://settings'} },

  // Search directly on Google / on the web
  { id:'search',    re:/\b(?:search|google|look\s+up)\s+(?:for\s+)?(.+)/i, type:'search' },

  // Numbered link click (before generic navigate so "open link 5" works)
  { id:'click_num', re:/\b(?:click|open|select|press|choose|hit)\s+(?:link\s+|number\s+|#\s*)?(\d{1,3})\b/i, type:'hint' },

  // Dynamic navigation (after specific site shortcuts)
  { id:'navigate',  re:/\b(?:open|go\s+to|navigate\s+to|visit)\s+(.+?)(?:\s+(?:in\s+new\s+tab|on\s+new\s+tab))?$/i, type:'navigate' },

  // Link-hint mode (hands-free clicking of anything on the page)
  { id:'hints_on',  re:/\b(show|list|enable)\s+(links|hints|numbers)\b/i, type:'bg', cmd:'link_hints_show' },
  { id:'hints_off', re:/\b(hide|clear|disable)\s+(links|hints|numbers)\b/i, type:'bg', cmd:'link_hints_hide' },

  // Read / summarize the page with AI
  { id:'read',      re:/\b(read|summari[sz]e)\b.*\b(page|article|this|it|screen)?\b/i, type:'read' },

  // Tab management (numbers before generic)
  { id:'mute_tab',  re:/\bmute\s+(this\s+)?tab\b/i,          type:'bg', cmd:'mute_tab' },
  { id:'switch_n',  re:/\b(?:switch|go|move)\s+to\s+tab\s+(\d+)\b/i, type:'tabnum', cmd:'switch_tab' },
  { id:'close_n',   re:/\bclose\s+tab\s+(\d+)\b/i,           type:'tabnum', cmd:'close_tab_n' },
  { id:'dup_tab',   re:/\bduplicate\s+(this\s+)?tab\b/i,     type:'bg', cmd:'duplicate_tab' },
  { id:'pin_tab',   re:/\b(pin|unpin)\s+(this\s+)?tab\b/i,   type:'bg', cmd:'pin_tab' },
  { id:'reopen',    re:/\b(reopen|restore)\s+(closed\s+)?tab\b/i, type:'bg', cmd:'reopen_tab' },
  { id:'new_win',   re:/\bnew\s+window\b/i,                  type:'bg', cmd:'new_window' },
  { id:'incognito', re:/\b(incognito|private)\s+(window|mode|tab)?\b/i, type:'bg', cmd:'incognito' },
  { id:'new_tab',   re:/\bnew\s+tab\b/i,                     type:'bg', cmd:'new_tab' },
  { id:'close_tab', re:/\bclose\s+(this\s+)?tab\b/i,         type:'bg', cmd:'close_tab' },
  { id:'next_tab',  re:/\bnext\s+tab\b/i,                    type:'bg', cmd:'next_tab' },
  { id:'prev_tab',  re:/\b(prev(ious)?\s+tab|last\s+tab)\b/i, type:'bg', cmd:'prev_tab' },
  { id:'list_tabs', re:/\blist\s+tabs\b/i,                   type:'bg', cmd:'list_tabs' },

  // Media control
  { id:'m_play',    re:/\b(play|resume)\b/i,                 type:'bg', cmd:'media_play' },
  { id:'m_pause',   re:/\b(pause|stop\s+video)\b/i,          type:'bg', cmd:'media_pause' },
  { id:'m_unmute',  re:/\bunmute\b/i,                        type:'bg', cmd:'media_unmute' },
  { id:'m_mute',    re:/\bmute\b/i,                          type:'bg', cmd:'media_mute' },
  { id:'m_faster',  re:/\b(speed\s+up|faster|playback\s+faster)\b/i, type:'bg', cmd:'media_faster' },
  { id:'m_slower',  re:/\b(slow\s+down|slower)\b/i,          type:'bg', cmd:'media_slower' },

  // Navigation
  { id:'go_back',   re:/\b(go\s+back|back)\b/i,              type:'bg', cmd:'go_back'   },
  { id:'go_fwd',    re:/\bgo\s+forward\b/i,                  type:'bg', cmd:'go_forward'},
  { id:'reload',    re:/\b(reload|refresh)\s*(page|tab)?\b/i, type:'bg', cmd:'reload'},

  // Scroll
  { id:'s_down',    re:/\bscroll\s+down\b/i,                 type:'bg', cmd:'scroll_down'   },
  { id:'s_up',      re:/\bscroll\s+up\b/i,                   type:'bg', cmd:'scroll_up'     },
  { id:'s_top',     re:/\bscroll\s+(to\s+)?top\b/i,          type:'bg', cmd:'scroll_top'    },
  { id:'s_bot',     re:/\bscroll\s+(to\s+)?(bottom|end)\b/i, type:'bg', cmd:'scroll_bottom'},
  // Scroll/jump to a specific text (after the fixed-direction scrolls above)
  { id:'scroll_to', re:/\b(?:scroll|jump)\s+to\s+(?:the\s+)?(?:text\s+)?(.+)/i, type:'scroll_to' },

  // Zoom
  { id:'z_in',     re:/\bzoom\s+in\b/i,                      type:'bg', cmd:'zoom_in'   },
  { id:'z_out',    re:/\bzoom\s+out\b/i,                     type:'bg', cmd:'zoom_out'  },
  { id:'z_reset',  re:/\bzoom\s+reset\b/i,                   type:'bg', cmd:'zoom_reset'},
  { id:'fscreen',  re:/\b(full\s?screen)\b/i,                type:'bg', cmd:'fullscreen'},

  // Type / submit / click by text (put type/submit before generic click-text)
  { id:'type',     re:/\btype\s+(.+)/i,                      type:'type_text' },
  { id:'submit',   re:/\b(submit|press\s+enter|hit\s+enter|confirm)\b/i, type:'bg', cmd:'press_enter' },
  { id:'clicktxt', re:/\b(?:click|press|tap|select|choose)\s+(?:on\s+)?(.+)/i, type:'click_text' },

  // Find on page
  { id:'find',     re:/\bfind\s+(.+)$/i,                     type:'find' },

  // Bookmark / screenshot
  { id:'bookmark', re:/\b(bookmark|save\s+page)\b/i,         type:'bg', cmd:'bookmark_page'},
  { id:'screenshot', re:/\btake\s+(a\s+)?screenshot\b/i,     type:'bg', cmd:'screenshot'},

  // System info (local)
  { id:'time',     re:/\b(what\s+(time|is\s+it)|current\s+time|time\s+now)\b/i, type:'local', fn: cmdTime },
  { id:'date',     re:/\b(what('s|\s+is)\s+(the\s+)?date|today('s|\s+is)?\s+date)\b/i, type:'local', fn: cmdDate },
  { id:'status',   re:/\b(status\s+report|system\s+status)\b/i, type:'local', fn: cmdStatus },
  { id:'model',    re:/\b(what\s+model|which\s+(ai\s+)?model)\b/i, type:'local', fn: cmdModel },
  { id:'help',     re:/\b(help|what\s+can\s+you\s+do|commands|list\s+commands)\b/i, type:'local', fn: cmdHelp },
  { id:'stop',     re:/\b(stop\s+(talking|speaking)|shut\s+up|silence)\b/i, type:'local', fn: cmdStop },
];

// Fuzzy keyword phrases per command id (used as fallback when the regex misses
// due to speech-recognition errors). Every phrase is a word sequence in order.
const CMD_KW = {
  yt:        [['youtube'], ['open', 'youtube']],
  google:    [['open', 'google']],
  gmail:     [['open', 'gmail']],
  drive:     [['open', 'drive']],
  calendar:  [['open', 'calendar']],
  maps:      [['open', 'maps']],
  translate: [['open', 'translate']],
  github:    [['open', 'github']],
  twitter:   [['open', 'twitter']],
  reddit:    [['open', 'reddit']],
  netflix:   [['open', 'netflix']],
  spotify:   [['open', 'spotify']],
  twitch:    [['open', 'twitch']],
  linkedin:  [['open', 'linkedin']],
  instagram: [['open', 'instagram']],
  facebook:  [['open', 'facebook']],
  whatsapp:  [['open', 'whatsapp']],
  amazon:    [['open', 'amazon']],
  wikipedia: [['open', 'wikipedia']],
  chatgpt:   [['open', 'chatgpt'], ['chat', 'gpt']],
  puter:     [['open', 'puter']],
  history:   [['open', 'history']],
  downloads: [['open', 'downloads']],
  bmarks:    [['open', 'bookmarks']],
  exts:      [['open', 'extensions']],
  bsettings: [['open', 'settings'], ['browser', 'settings']],
  search:    [['search'], ['look', 'up'], ['google']],
  click_num: [['click'], ['press'], ['choose'], ['select'], ['hit']],
  navigate:  [['open'], ['go', 'to'], ['navigate', 'to'], ['visit']],
  hints_on:  [['show', 'links'], ['show', 'hints'], ['show', 'numbers'], ['enable', 'numbers']],
  hints_off: [['hide', 'links'], ['hide', 'hints'], ['clear', 'numbers']],
  read:      [['read'], ['summarize'], ['summarise']],
  mute_tab:  [['mute', 'tab']],
  switch_n:  [['switch', 'to', 'tab'], ['go', 'to', 'tab']],
  close_n:   [['close', 'tab']],
  dup_tab:   [['duplicate', 'tab']],
  pin_tab:   [['pin', 'tab'], ['unpin', 'tab']],
  reopen:    [['reopen', 'tab'], ['restore', 'tab']],
  new_win:   [['new', 'window']],
  incognito: [['incognito'], ['private', 'window']],
  new_tab:   [['new', 'tab']],
  close_tab: [['close', 'tab'], ['close', 'this', 'tab']],
  next_tab:  [['next', 'tab']],
  prev_tab:  [['previous', 'tab'], ['prev', 'tab'], ['last', 'tab']],
  list_tabs: [['list', 'tabs']],
  m_play:    [['play'], ['resume']],
  m_pause:   [['pause'], ['stop', 'video']],
  m_unmute:  [['unmute']],
  m_mute:    [['mute']],
  m_faster:  [['speed', 'up'], ['faster']],
  m_slower:  [['slow', 'down'], ['slower']],
  go_back:   [['go', 'back'], ['back']],
  go_fwd:    [['go', 'forward']],
  reload:    [['reload'], ['refresh']],
  s_down:    [['scroll', 'down']],
  s_up:      [['scroll', 'up']],
  s_top:     [['scroll', 'top'], ['scroll', 'to', 'top']],
  s_bot:     [['scroll', 'bottom'], ['scroll', 'to', 'bottom'], ['scroll', 'end']],
  scroll_to: [['scroll', 'to'], ['jump', 'to']],
  z_in:      [['zoom', 'in']],
  z_out:     [['zoom', 'out']],
  z_reset:   [['zoom', 'reset']],
  fscreen:   [['fullscreen'], ['full', 'screen']],
  type:      [['type']],
  submit:    [['submit'], ['press', 'enter'], ['hit', 'enter'], ['confirm']],
  clicktxt:  [['click'], ['press'], ['tap'], ['select'], ['choose']],
  find:      [['find']],
  bookmark:  [['bookmark'], ['save', 'page']],
  screenshot: [['take', 'screenshot'], ['screenshot']],
  time:      [['what', 'time'], ['current', 'time'], ['time', 'now']],
  date:      [['what', 'date'], ['today', 'date']],
  status:    [['status', 'report'], ['system', 'status'], ['status']],
  model:     [['what', 'model'], ['which', 'model']],
  help:      [['help'], ['what', 'can', 'you', 'do'], ['list', 'commands']],
  stop:      [['stop', 'talking'], ['stop', 'speaking'], ['shut', 'up'], ['silence']],
};

function matchCommand(txt) {
  const n = normalizeText(txt);
  const tokens = n.split(' ');

  // 1) Exact regex pass on the normalized text (fast path, keeps capture groups)
  for (const c of CMDS) {
    const m = c.re ? n.match(c.re) : null;
    if (m) {
      const numStr = (m[1] && /^\d+$/.test(m[1])) ? m[1] : null;
      return {
        ...c, match: m,
        param: m[1] ? m[1].trim() : '',
        number: numStr !== null ? parseInt(numStr, 10) : null,
      };
    }
  }

  // 2) Fuzzy keyword fallback — tolerates misheard words ("opem jutyb" → open youtube)
  let best = null;
  for (const c of CMDS) {
    const phrases = CMD_KW[c.id];
    if (!phrases) continue;
    for (const phrase of phrases) {
      const f = fuzzyPhrase(tokens, phrase);
      if (!f) continue;
      const rest = tokens.slice(f.lastIndex).join(' ');
      if (!best || f.cost < best.cost) {
        const num = (rest.match(/\d{1,3}/) || [])[0] || null;
        best = { ...c, fuzzy: true, cost: f.cost, param: rest, number: num ? parseInt(num, 10) : null };
      }
    }
  }
  return best;
}

// ── Recognition helpers (robust matching for imperfect speech) ──────────
// Word-level aliases fix common mishearings, esp. with non-English
// recognition (Slovak „otvor" → open, „jutyub" → youtube, „dzarvis" → jarvis).
const ALIASES = {
  // ── Slovak recognition helpers (still map to English commands) ──
  otvor: 'open', otvorte: 'open', otvorit: 'open', otvoris: 'open',
  nova: 'new', novu: 'new', novy: 'new',
  karta: 'tab', kartu: 'tab', karty: 'tab',
  zatvor: 'close', zavri: 'close', zavrite: 'close',
  hladaj: 'search', vyhladaj: 'search',
  roluj: 'scroll', scrolluj: 'scroll',
  dole: 'down', dolu: 'down',
  hore: 'up', nahor: 'up',
  obnov: 'reload', obnovit: 'reload',
  spat: 'back', vrat: 'back', vratit: 'back',
  vpred: 'forward',
  hraj: 'play', prehraj: 'play',
  pauza: 'pause', pozastav: 'pause',
  stis: 'mute', stlmi: 'mute',
  pomoc: 'help',
  ukaz: 'show', linky: 'links', cisla: 'numbers', skry: 'hide',
  jutyub: 'youtube', jutyb: 'youtube', yutub: 'youtube', youtub: 'youtube',
  dzarvis: 'jarvis', jarviz: 'jarvis',

  // ── English STT error fixes (Chrome/Google hears these wrong) ──
  // Wake word "jarvis" heard as …
  jeremys: 'jarvis', jeremy: 'jarvis', jeremis: 'jarvis', jerry: 'jarvis',
  jerrys: 'jarvis', jervis: 'jarvis', jarvus: 'jarvis', yarvys: 'jarvis',
  gervis: 'jarvis', djarvis: 'jarvis', jarvee: 'jarvis', jarvie: 'jarvis',
  // Common mishearings of command words
  opem: 'open', opend: 'open', opean: 'open', oppen: 'open', openn: 'open',
  gogle: 'google', gugle: 'google', googel: 'google', gugul: 'google',
  youtoob: 'youtube', yutube: 'youtube', youtubbe: 'youtube',
  twiter: 'twitter', twittah: 'twitter',
  redit: 'reddit', reditt: 'reddit',
  netfliks: 'netflix', netflics: 'netflix',
  spotyfy: 'spotify', spotefy: 'spotify', spotifai: 'spotify',
  jimail: 'gmail', gmeil: 'gmail',
  watsup: 'whatsapp', wattsapp: 'whatsapp',
  setings: 'settings', settins: 'settings',
  histri: 'history', histry: 'history',
  downloades: 'downloads', downloadz: 'downloads',
  bukmarks: 'bookmarks', bookmarks: 'bookmarks',
  extenshins: 'extensions', extesnions: 'extensions',
  srol: 'scroll', skrol: 'scroll', scrol: 'scroll',
  paus: 'pause', paws: 'pause',
  pley: 'play',
  moot: 'mute',
  halp: 'help', hep: 'help',
  relode: 'reload', reloads: 'reload',
  screnshot: 'screenshot', skreenshot: 'screenshot',
  fulskrin: 'fullscreen', fullscrin: 'fullscreen',
  incegnito: 'incognito', incogneto: 'incognito',
  duplicet: 'duplicate', dooplicate: 'duplicate',
  nexst: 'next', neks: 'next',
  previus: 'previous', prevyus: 'previous',
  forwad: 'forward', forard: 'forward',
  bakk: 'back', backk: 'back',
  finde: 'find', faind: 'find',
  scrolldown: 'scroll down', scrollen: 'scroll',
  crome: 'chrome', chome: 'chrome',
  twich: 'twitch', witcher: 'twitch',
  linkdin: 'linkedin', linkeden: 'linkedin',
  instagramm: 'instagram',
  feisbuk: 'facebook', facebuk: 'facebook',
  emazon: 'amazon', wickipedia: 'wikipedia', wikipedya: 'wikipedia',
  translat: 'translate', translatee: 'translate',
  calendr: 'calendar', calender: 'calendar',
  driv: 'drive', drivee: 'drive',
  githab: 'github', gitub: 'github',
  tabes: 'tab', tabz: 'tab',
  windo: 'window',
  neww: 'new', nuw: 'new',
  closs: 'close', cloze: 'close',
  refres: 'refresh', refrech: 'refresh',
  submitt: 'submit', sumbit: 'submit',
  typpe: 'type', tipe: 'type',
  helpp: 'help',
  stautus: 'status',
  modeles: 'model',
  comand: 'command', comandos: 'commands',

  // ── More English mishearings (Chrome en-US STT) ──
  gearvis: 'jarvis', jarvisz: 'jarvis', jarviz: 'jarvis', jarvez: 'jarvis',
  jarvee: 'jarvis', jarvie: 'jarvis', yerry: 'jarvis', yarvis: 'jarvis', jarvuz: 'jarvis',
  openy: 'open', opn: 'open', openn: 'open', openg: 'open', oppen: 'open',
  googel: 'google', googol: 'google', gooogle: 'google', gogole: 'google',
  yotube: 'youtube', utube: 'youtube', jootub: 'youtube',
  gimail: 'gmail', gmil: 'gmail',
  transleit: 'translate', translet: 'translate',
  wickipedia: 'wikipedia', wikapedia: 'wikipedia', wikipidia: 'wikipedia',
  facbook: 'facebook', fetbuk: 'facebook', fecbook: 'facebook',
  instegram: 'instagram', insta: 'instagram',
  watsap: 'whatsapp', wassap: 'whatsapp',
  amason: 'amazon', amazen: 'amazon',
  netflex: 'netflix', netflixx: 'netflix',
  twitsh: 'twitch', twicht: 'twitch',
  reditt: 'reddit', redddit: 'reddit',
  settins: 'settings', setin: 'settings',
  histery: 'history', histroy: 'history',
  downlods: 'downloads', downloadz: 'downloads',
  extinsions: 'extensions', extnesions: 'extensions',
  screanshot: 'screenshot', fulscreen: 'fullscreen', fullscren: 'fullscreen',
  incogneto: 'incognito', inkognito: 'incognito',
  nex: 'next', nekst: 'next', next: 'next',
  prevyos: 'previous', previo: 'previous',
  foreward: 'forward', forwed: 'forward',
  reloaded: 'reload', reloade: 'reload',
  scrool: 'scroll', scrawl: 'scroll',
  pawse: 'pause', pozse: 'pause',
  plaay: 'play', plei: 'play', plae: 'play',
  mewt: 'mute', muute: 'mute',
  unmewt: 'unmute', unmoot: 'unmute',
  loder: 'louder', looder: 'louder', louderr: 'louder',
  quieder: 'quieter', quieterr: 'quieter',
  typee: 'type', tyep: 'type', typ: 'type',
  submet: 'submit', sumbit: 'submit', submited: 'submit',
  hepl: 'help', halp: 'help',
  statuses: 'status', statis: 'status',
  modele: 'model', modell: 'model',
  commans: 'commands',

  // ── Czech command words (recognition language cs-CZ) ──
  otevrit: 'open', otevri: 'open', otevreny: 'open', otevru: 'open',
  novy: 'new', nova: 'new', nove: 'new',
  karta: 'tab', kartu: 'tab', zalozka: 'tab',
  zavrit: 'close', zavreny: 'close',
  hledat: 'search', hledej: 'search', vyhledej: 'search', vyhledat: 'search',
  posun: 'scroll', posunout: 'scroll', dolu: 'down', nahoru: 'up',
  prehrat: 'play',
  pozastavit: 'pause', pozastav: 'pause',
  ztlumit: 'mute', ztlum: 'mute', ztichit: 'mute',
  napoveda: 'help',
  zpet: 'back', zpatky: 'back', vpred: 'forward',
  obnovit: 'reload', obnov: 'reload',
  precti: 'read', precte: 'read', nahrat: 'read',

  // ── German command words (recognition language de-DE) ──
  offnen: 'open', oeffnen: 'open', oeffne: 'open', aufmachen: 'open',
  neue: 'new', neu: 'new',
  karte: 'tab', registerkarte: 'tab',
  schliessen: 'close', schliess: 'close', zumachen: 'close',
  suchen: 'search', such: 'search', suche: 'search',
  scrollen: 'scroll', runter: 'down', hoch: 'up',
  abspielen: 'play', spielen: 'play', spiel: 'play',
  pausieren: 'pause', anhalten: 'pause',
  stumm: 'mute', stummschalten: 'mute', lautlos: 'mute',
  hilfe: 'help', hilf: 'help',
  zuruck: 'back', vor: 'forward', vorwaerts: 'forward',
  aktualisieren: 'reload', neuladen: 'reload',
  lesen: 'read', lies: 'read', vorlesen: 'read',

  // ── Spanish / French command words ──
  abrir: 'open', abre: 'open', ouvrir: 'open', ouvre: 'open',
  nuevo: 'new', nueva: 'new', nouveau: 'new', nouvelle: 'new',
  pestana: 'tab', onglet: 'tab',
  cerrar: 'close', cierra: 'close', fermer: 'close', ferme: 'close',
  buscar: 'search', busca: 'search', chercher: 'search', cherche: 'search',
  desplazar: 'scroll', bajar: 'down', subir: 'up', abajo: 'down', arriba: 'up',
  reproducir: 'play', reproduce: 'play', jouer: 'play',
  pausar: 'pause', pausa: 'pause',
  silenciar: 'mute', silencio: 'mute',
  ayuda: 'help', aide: 'help',
  atras: 'back', volver: 'back', adelante: 'forward',
  recargar: 'reload', refrescar: 'reload', actualiser: 'reload',
  leer: 'read', lee: 'read', lire: 'read',
};

// Spoken numbers → digits ("click seven" → "click 7").
const NUM_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15',
  sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
  thirty: '30', forty: '40', fifty: '50',
};
const FILLER_RE = /\b(please|pls|can you|could you|would you|hey|ok|okay|um|uh|erm|now|sir|mi|prosim|prosím|ako|moze|môže)\b/g;

function normalizeText(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(FILLER_RE, ' ')
    .split(' ').map((w) => NUM_WORDS[w] || ALIASES[w] || w).join(' ')
    .replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

// Distance between a heard word and a command keyword (Infinity = no match).
function wordClose(word, kw) {
  if (word === kw) return 0;
  const d = levenshtein(word, kw);
  const maxD = kw.length <= 3 ? 1 : (kw.length <= 6 ? 1 : 2);
  if (d <= maxD) return d;
  // Prefix tolerance ("youtub" vs "youtube") for longer words.
  if (word.length >= 4 && kw.length >= 4 && Math.abs(word.length - kw.length) <= 2 &&
      (kw.startsWith(word) || word.startsWith(kw))) return Math.abs(word.length - kw.length);
  return Infinity;
}

// Greedy in-order fuzzy search of a keyword phrase inside the heard tokens.
function fuzzyPhrase(tokens, phrase) {
  let idx = 0, cost = 0;
  for (const kw of phrase) {
    let bestI = -1, bestC = Infinity;
    for (let i = idx; i < tokens.length; i++) {
      const c = wordClose(tokens[i], kw);
      if (c < bestC) { bestC = c; bestI = i; if (c === 0) break; }
    }
    if (bestI === -1 || bestC === Infinity) return null;
    cost += bestC;
    idx = bestI + 1;
  }
  return { cost, lastIndex: idx };
}

// ── Local fns ─────────────────────────────────────────────
function cmdTime()   { jarvisReply(T('time', new Date().toLocaleTimeString(S.settings.lang, { hour: '2-digit', minute: '2-digit' }))); }
function cmdDate()   { jarvisReply(T('date', new Date().toLocaleDateString(S.settings.lang, { weekday:'long', year:'numeric', month:'long', day:'numeric' }))); }
function cmdStatus() { jarvisReply(T('status', S.puterReady ? T('connected') : T('offline'), S.settings.model)); }
function cmdModel()  { jarvisReply(T('model', S.settings.model)); }
function cmdStop()   { stopGtts(); window.speechSynthesis.cancel(); setState('idle'); jarvisReply(T('stop'), false); }function cmdHelp() {
  jarvisReply(T('help'), false);
}

// Read / summarize the current page with AI.
async function cmdReadPage(mode) {
  setState('thinking');
  const res = await sendBg('get_readable_text', {});
  if (!res.success || !res.result) {
    setState('idle');
    addMsg('err', 'JARVIS', T('readFail'));
    return;
  }
  const verb = /summari/i.test(mode) ? 'Summarize' : 'Read and briefly explain';
  await queryAI(`${verb} the following page content for me:\n\n${res.result}`);
}

// ─────────────────────────────────────────────────────────
//  COMMAND EXECUTION
// ─────────────────────────────────────────────────────────
async function runCommand(cmd, originalText) {
  if (cmd.type === 'local') { cmd.fn(); return; }

  if (cmd.type === 'read') { await cmdReadPage(cmd.param || originalText); return; }

  if (cmd.type === 'url') {
    await sendBg('open_url', { url: cmd.url });
    jarvisReply(T('opening', cmd.id.replace(/_/g, ' ')));
    return;
  }

  if (cmd.type === 'search') {
    const q = cmd.param || '';
    await sendBg('open_url', { url: `https://www.google.com/search?q=${encodeURIComponent(q)}` });
    jarvisReply(T('searching', q));
    return;
  }

  if (cmd.type === 'navigate') {
    const query = cmd.param || '';
    let url = query;
    if (!/^https?:\/\//i.test(url)) {
      if (/^[\w-]+\.(com|org|net|io|co|dev|app|ai|gov|edu)(\/.*)?\s*$/.test(url)) {
        url = `https://${url}`;
      } else {
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }
    await sendBg('open_url', { url });
    jarvisReply(T('navigating', query));
    return;
  }

  if (cmd.type === 'find') {
    const term = cmd.param || '';
    await sendBg('find_text', { text: term });
    jarvisReply(T('searching', term));
    return;
  }

  if (cmd.type === 'click_text') {
    await bgAction('click_text', { text: cmd.param }, T('clicking', cmd.param));
    return;
  }

  if (cmd.type === 'scroll_to') {
    await bgAction('scroll_to_text', { text: cmd.param }, `Jumping to "${cmd.param}", sir.`);
    return;
  }

  if (cmd.type === 'type_text') {
    await bgAction('type_text', { text: cmd.param }, `Typed, sir.`);
    return;
  }

  if (cmd.type === 'hint') {
    await bgAction('click_hint', { num: cmd.number }, `Activating link ${cmd.number}, sir.`);
    return;
  }

  if (cmd.type === 'tabnum') {
    await bgAction(cmd.cmd, { num: cmd.number }, null);
    return;
  }

  if (cmd.type === 'bg') {
    await bgAction(cmd.cmd, cmd.arg || {}, null);
  }
}

// Runs a background command, speaks a reply, handles errors + page indicator.
async function bgAction(command, data, spokenOverride) {
  setState('thinking');
  try {
    const res = await sendBg(command, data);
    if (!res.success) throw new Error(res.error || 'Command failed');
    const response = spokenOverride || buildReply(command, res.result);
    jarvisReply(response);
    log('success', `${command}: done`);
    if (el.micBtn) { el.micBtn.classList.add('cmd-flash'); setTimeout(() => el.micBtn.classList.remove('cmd-flash'), 600); }
    if (S.settings.indicator) notifyPage(command.replace(/_/g,' ').toUpperCase());
  } catch (e) {
    setState('idle');
    const msg = e.message || String(e);
    addMsg('err', 'JARVIS', `Command error: ${msg}`);
    log('error', `${command} failed: ${msg}`);
  }
}

function buildReply(cmd, result) {
  const map = {
    new_tab:       'New tab opened.',
    close_tab:     'Tab closed.',
    go_back:       'Going back.',
    go_forward:    'Going forward.',
    reload:        'Page reloaded.',
    scroll_down:   'Scrolling down.',
    scroll_up:     'Scrolling up.',
    scroll_top:    'Scrolled to top.',
    scroll_bottom: 'Scrolled to bottom.',
    zoom_in:       'Zoomed in.',
    zoom_out:      'Zoomed out.',
    zoom_reset:    'Zoom reset to 100 percent.',
    next_tab:      'Switched to next tab.',
    prev_tab:      'Switched to previous tab.',
    bookmark_page: 'Page bookmarked.',
    screenshot:    'Screenshot captured.',
    list_tabs:     `Current tabs: ${result}`,
  };
  return map[cmd] || String(result || 'Done.');
}

// ─────────────────────────────────────────────────────────
//  BACKGROUND MESSAGE
// ─────────────────────────────────────────────────────────
function sendBg(command, data) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'EXECUTE_COMMAND', command, data }, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(res || { success: false, error: 'No response' });
      }
    });
  });
}

// ─────────────────────────────────────────────────────────
//  PUTER.JS AI QUERY
// ─────────────────────────────────────────────────────────
async function queryAI(prompt) {
  if (!puterAvailable()) {
    addMsg('err', 'JARVIS', 'Puter.js failed to load — check your internet connection and try again.');
    log('error', 'AI query blocked — puter.js not loaded');
    return;
  }

  // If we are not connected, start the connect flow (opens puter.com to sign in).
  if (!S.puterReady) {
    log('warn', 'AI request requires a Puter connection — starting CONNECT.');
    const ok = await doConnect(el.authActionBtn);
    if (!ok) {
      addMsg('err', 'JARVIS', 'Not connected to Puter AI. Click CONNECT and sign in, sir.');
      return;
    }
  }

  setState('thinking');
  log('ai', `Querying ${S.settings.model}…`);

  const typingId = addTyping();

  const LANG_NAMES = {
    'en-US': 'English', 'en-GB': 'English (UK)', 'sk-SK': 'Slovak', 'cs-CZ': 'Czech',
    'de-DE': 'German', 'fr-FR': 'French', 'es-ES': 'Spanish', 'it-IT': 'Italian',
    'pt-PT': 'Portuguese', 'pl-PL': 'Polish', 'hu-HU': 'Hungarian', 'nl-NL': 'Dutch',
    'ru-RU': 'Russian', 'ja-JP': 'Japanese'
  };
  const speakLang = S.settings.lang || 'en-US';
  const langName = LANG_NAMES[speakLang] || speakLang;
  const systemPrompt =
    'You are JARVIS, Tony Stark\'s ultra-intelligent AI assistant. ' +
    'Be concise, polite, and precise. Keep answers under 3 sentences unless code or lists are needed. ' +
    'Address the user as "sir" once per reply. Never break character. ' +
    'Reply in ' + langName + ' (' + speakLang + ') — always write your entire answer in that language, matching the user\'s language. If the user writes or speaks in another language, switch to it.';

  // Keep short-term conversation memory (last ~8 turns) so JARVIS stays in context.
  S.history.push({ role: 'user', content: prompt });
  if (S.history.length > 16) S.history = S.history.slice(-16);

  try {
    const result = await puter.ai.chat(
      [
        { role: 'system', content: systemPrompt },
        ...S.history
      ],
      { model: S.settings.model }
    );

    removeTyping(typingId);

    const text = extractPuterText(result).trim();
    if (!text) throw new Error('Empty response from AI.');

    S.history.push({ role: 'assistant', content: text });
    log('ai', `Response: "${text.slice(0, 70)}${text.length > 70 ? '…' : ''}"`);
    jarvisReply(text);

  } catch (e) {
    removeTyping(typingId);
    setState('idle');
    S.history.pop(); // drop the user turn that failed
    const errMsg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));

    // Token expired / invalid → clear it and prompt to reconnect.
    if (/unauthor|401|permission|token|not.*sign/i.test(errMsg)) {
      await clearToken();
      onPuterSignedOut();
      addMsg('err', 'JARVIS', 'Your Puter session expired. Click CONNECT and sign in again, sir.');
      log('error', `AI auth error: ${errMsg}`);
      return;
    }

    addMsg('err', 'JARVIS', `AI error: ${errMsg}`);
    log('error', `AI query failed: ${errMsg}`);
    speak(T('aiError'));
  }
}

// Puter's response shape varies by provider: OpenAI-style models return a
// plain string in message.content, Claude-style models return an array of
// content blocks ([{type:'text', text:'...'}]).
function extractPuterText(result) {
  if (typeof result === 'string') return result;
  const content = result?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((b) => b.text || '').join('');
  if (result?.text) return result.text;
  if (result?.choices?.[0]?.message?.content) return result.choices[0].message.content;
  return JSON.stringify(result);
}

// ─────────────────────────────────────────────────────────
//  JARVIS REPLY (chat + TTS)
// ─────────────────────────────────────────────────────────
function jarvisReply(text, doSpeak = true) {
  addMsg('jarvis', 'JARVIS', text);
  if (doSpeak && S.settings.speakAI) {
    speak(text);
  } else {
    setState('idle');
  }
}

// ─────────────────────────────────────────────────────────
//  TEXT-TO-SPEECH
// ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────
//  TEXT-TO-SPEECH (language-aware voice selection)
// ─────────────────────────────────────────────────────────
let voicesCache = [];

let _voicesTimer = null;
function refreshVoices() {
  clearTimeout(_voicesTimer);
  _voicesTimer = setTimeout(() => {
    try { voicesCache = window.speechSynthesis.getVoices() || []; } catch (_) { voicesCache = []; }
    populateVoiceList();
  }, 150);
}

// Rebuild the custom voice dropdown: AUTO, installed voices grouped by
// language, then Google Translate TTS voices (Slovak, Czech, German …).
let _voiceOpts = [];   // [{ value, label, group, star }]

function populateVoiceList() {
  if (!el.voiceList) return;
  const lang = S.settings.lang || 'en-US';
  const base = lang.split('-')[0].toLowerCase();
  const list = voicesCache.length ? voicesCache : (window.speechSynthesis.getVoices() || []);
  _voiceOpts = [];

  _voiceOpts.push({ value: '', label: 'AUTO — best for ' + lang.toUpperCase(), group: '' });

  const sorted = [...list].sort((a, b) => (a.lang || '').localeCompare(b.lang || '') || a.name.localeCompare(b.name));
  const groups = new Map();
  for (const v of sorted) {
    const l = (v.lang || '??').split('-')[0].toLowerCase();
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(v);
  }
  const langOrder = [...groups.keys()].sort((a, b) => {
    if (a === base) return -1;
    if (b === base) return 1;
    return a.localeCompare(b);
  });
  const seen = new Set();
  for (const l of langOrder) {
    for (const v of groups.get(l)) {
      const key = v.name + '|' + v.lang;
      if (seen.has(key)) continue; seen.add(key);
      _voiceOpts.push({
        value: v.name,
        label: (v.lang || '??') + ' · ' + v.name + (v.localService ? '' : ' (online)'),
        group: l,
        star: l === base
      });
    }
  }

  // Google Translate TTS — online voices for every language (incl. Slovak/Czech).
  const GTTS = [
    ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['sk-SK', 'Slovak'], ['cs-CZ', 'Czech'],
    ['de-DE', 'German'], ['fr-FR', 'French'], ['es-ES', 'Spanish'], ['it-IT', 'Italian'],
    ['pt-PT', 'Portuguese'], ['pl-PL', 'Polish'], ['hu-HU', 'Hungarian'], ['nl-NL', 'Dutch'],
    ['ru-RU', 'Russian'], ['ja-JP', 'Japanese'],
  ];
  for (let k = 0; k < GTTS.length; k++) {
    _voiceOpts.push({ value: 'gtts:' + GTTS[k][0], label: GTTS[k][0] + ' · Google Translate · ' + GTTS[k][1], group: 'gtts' });
  }

  renderVoiceList('');
  updateVoiceTrigger();

  // Hint: no native voice for the selected language → Google Translate used.
  const hint = $('voiceHint');
  if (hint) {
    const hasNative = list.some((v) => (v.lang || '').toLowerCase().split('-')[0] === base);
    hint.style.display = hasNative ? 'none' : 'block';
    hint.textContent = hasNative
      ? ''
      : 'No ' + lang + ' voice is installed on this device — JARVIS will use the Google Translate voice for ' + lang + '. Pick any "Google Translate" entry to choose the exact voice.';
  }
}

function renderVoiceList(filter) {
  if (!el.voiceList) return;
  const q = (filter || '').trim().toLowerCase();
  const cur = S.settings.voice || '';
  const frag = document.createDocumentFragment();
  let lastGroup = null;
  for (const o of _voiceOpts) {
    if (q && o.label.toLowerCase().indexOf(q) === -1) continue;
    if (o.group !== lastGroup) {
      if (o.group) {
        const hdr = document.createElement('div');
        hdr.className = 'vdd-hdr';
        hdr.textContent = o.group === 'gtts' ? 'GOOGLE TRANSLATE · ONLINE' : o.group.toUpperCase() + (o.star ? ' ★' : '');
        frag.appendChild(hdr);
      }
      lastGroup = o.group;
    }
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'vdd-opt' + (o.value === cur ? ' sel' : '');
    row.textContent = o.label;
    row.dataset.val = o.value;
    frag.appendChild(row);
  }
  el.voiceList.innerHTML = '';
  el.voiceList.appendChild(frag);
}

function updateVoiceTrigger() {
  if (!el.voiceTriggerLabel) return;
  const cur = S.settings.voice || '';
  const found = _voiceOpts.find((o) => o.value === cur);
  el.voiceTriggerLabel.textContent = found ? found.label : ('AUTO — best for ' + (S.settings.lang || 'en-US').toUpperCase());
}

function initVoiceDropdown() {
  if (!el.voiceTrigger) return;
  el.voiceTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = el.voiceDrop.classList.toggle('open');   // 'open' must sit on #voiceDrop (.vdd.open .vdd-panel)
    if (open) {
      el.voiceSearch.value = '';
      renderVoiceList('');
      el.voiceSearch.focus();
      sfx(880, 0.05, 'sine', 0.025, 1300);
    } else {
      sfx(440, 0.04, 'sine', 0.02, 300);
    }
  });
  el.voiceSearch.addEventListener('input', () => renderVoiceList(el.voiceSearch.value));
  el.voiceList.addEventListener('click', (e) => {
    const row = e.target.closest('.vdd-opt');
    if (!row) return;
    S.settings.voice = row.dataset.val || '';
    updateVoiceTrigger();
    el.voiceDrop.classList.remove('open');
    sfx(980, 0.06, 'sine', 0.03, 1500);
    log('info', 'TTS voice → ' + (row.dataset.val ? row.textContent : 'AUTO'));
  });
  document.addEventListener('click', (e) => {
    if (el.voiceDrop.classList.contains('open') && !el.voiceDrop.contains(e.target)) {
      el.voiceDrop.classList.remove('open');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.voiceDrop.classList.contains('open')) el.voiceDrop.classList.remove('open');
  });
}

// Pick the voice engine: explicit native voice / Google-Translate voice, or
// AUTO = best native voice for the language. If a non-English language has no
// installed native voice (e.g. Slovak/Czech), fall back to Google Translate so
// JARVIS stops answering in English by default.
// Pick the voice engine: explicit native voice / Google-Translate voice, or
// AUTO = best native voice for the language. English is the priority and the
// default; other languages are optional secondary languages.
function pickVoice() {
  const lang = S.settings.lang || 'en-US';
  const base = lang.split('-')[0].toLowerCase();
  const voices = voicesCache.length ? voicesCache : (window.speechSynthesis.getVoices() || []);
  const pref = S.settings.voice || '';

  if (pref.startsWith('gtts:')) return { type: 'gtts', lang: pref.slice(5) };

  // A saved native voice is only honored when it actually matches the selected
  // language. Otherwise (e.g. the English voice left over from before switching
  // to Slovak) it would force JARVIS to answer in English — ignore it.
  if (pref) {
    const pv = voices.find((v) => v.name === pref);
    if (pv && pv.lang && pv.lang.toLowerCase().split('-')[0] === base) {
      return { type: 'native', voice: pv };
    }
  }

  const preferName = /Google|Microsoft|Natural|Neural|Premium|Enhanced|Online/i;
  const usFemale = /google us english|zira|samantha|female|aria|jenny|michelle|emma|natural|siri/i;
  const native = (base === 'en'
      ? voices.find((v) => /^en/i.test(v.lang) && usFemale.test(v.name))
      : null)
      || voices.find((v) => v.lang && v.lang.toLowerCase().split('-')[0] === base && preferName.test(v.name))
      || voices.find((v) => v.lang && v.lang.toLowerCase().split('-')[0] === base);
  if (native) return { type: 'native', voice: native };

  // No installed voice for this language — never fall back to an English voice;
  // use Google Translate's fluent online voice (Slovak, Czech, German…).
  if (base !== 'en') return { type: 'gtts', lang };
  return voices.find((v) => /^en/i.test(v.lang) && preferName.test(v.name))
      || voices.find((v) => /^en/i.test(v.lang))
      || null;
}

let gttsAudio = [];    // active Google-Translate audio elements (chunked replies)
let gttsSession = 0;   // bumped on every stop — invalidates stale chunk chains

function stopGtts() {
  gttsSession++;
  for (const a of gttsAudio) { try { a.pause(); a.removeAttribute('src'); } catch (_) {} }
  gttsAudio = [];
}

// Split long text into <=max-char chunks (Google TTS accepts ~200 chars/request).
// Chunks break at sentence boundaries first, then at word boundaries — never
// mid-word — so Slovak/Czech/etc. speech flows naturally instead of sounding
// like stitched-together individual words.
function chunkText(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];
  const sents = clean.split(/(?<=[.!?…])\s+/);
  const out = [];
  let cur = '';
  for (const s of sents) {
    const piece = (cur + ' ' + s).trim();
    if (piece.length > max && cur) { out.push(cur.trim()); cur = s; }
    else cur = piece;
    while (cur.length > max) {
      const cut = cur.lastIndexOf(' ', max);
      if (cut <= 0) { out.push(cur.slice(0, max)); cur = cur.slice(max); }   // single over-long word
      else { out.push(cur.slice(0, cut).trim()); cur = cur.slice(cut + 1); } // word boundary
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ── Mic muting while JARVIS talks ─────────────────────────
// SpeechRecognition keeps running during TTS, so without this JARVIS would
// hear his own voice and register its last syllable (e.g. "s" of "Yes, sir?")
// as a command. We pause recognition before speaking and restart it after,
// returning the HUD to STANDBY once the reply is done.
function beginSpeech() {
  if (S.jarvisState === 'listening' || S.wakeMode) {
    chrome.runtime.sendMessage({ type: 'JARVIS_SR_STOP' }).catch(() => {});
  }
}
function endSpeech() {
  if (S.wakeArmed) {
    // We are inside the armed listen window (ack after the wake word): resume
    // the mic so the user's command is heard.
    setState('listening');
    el.micLabel.textContent = 'LISTENING…';
    setTimeout(() => startListening(false), 200);
  } else if (S.wakeMode) {
    // Normal reply in wake mode → back to STANDBY + passive hot-mic.
    S.wakeArmed = false;
    clearTimeout(S._listenTimer);
    el.root?.classList.add('wake-listening');
    setState('idle');
    el.micLabel.textContent = 'STANDBY';
    setTimeout(() => startListening(false), 300);
  } else if (S.jarvisState === 'speaking') {
    setState('idle');
  }
}

// Google Translate TTS — free online voices for ~100 languages (Slovak, Czech…).
// The next chunk is preloaded while the current one plays (no dead air), and if
// the online engine is unreachable JARVIS falls back to an installed native
// voice in the same language.
function speakGtts(text, langTag, onDone) {
  stopGtts();
  beginSpeech();
  const mySession = gttsSession;
  setState('speaking');
  const tl = String(langTag || S.settings.lang || 'en-US').split('-')[0];
  const chunks = chunkText(text, 170);
  if (!chunks.length) {
    if (onDone) { try { onDone(); } catch (_) {} }
    endSpeech();
    return;
  }
  const gurl = (q) => 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl='
    + encodeURIComponent(tl) + '&q=' + encodeURIComponent(q);
  let i = 0, played = 0, finished = false;
  let preloadAudio = null;

  const finish = () => {
    if (finished) return; finished = true;
    if (preloadAudio) { try { preloadAudio.pause(); preloadAudio.removeAttribute('src'); } catch (_) {} preloadAudio = null; }
    gttsAudio = [];
    if (onDone) { const cb = onDone; onDone = null; try { cb(); } catch (_) {} }
    endSpeech();
  };

  const advance = (ok) => {
    if (finished || mySession !== gttsSession) return;
    if (ok) played++;
    i++;
    if (i >= chunks.length) {
      if (!played) {
        // Google TTS unreachable — fall back to an installed native voice.
        const nv = pickVoice();
        if (nv && nv.type === 'native') { speakNative(text, onDone); return; }
      }
      finish();
      return;
    }
    playChunk(i);
  };

  const playChunk = (idx) => {
    if (mySession !== gttsSession) { finish(); return; }
    const a = preloadAudio || new Audio(gurl(chunks[idx]));
    preloadAudio = null;
    a.playbackRate = Math.min(Math.max(S.settings.rate || 1.1, 0.5), 2);
    // Warm up the next chunk while this one plays → no dead air between chunks.
    if (idx + 1 < chunks.length) {
      try { preloadAudio = new Audio(gurl(chunks[idx + 1])); preloadAudio.preload = 'auto'; } catch (_) {}
    }
    gttsAudio.push(a);
    a.onended = () => advance(true);
    a.onerror = () => advance(false);
    a.play().then(() => {}).catch(() => advance(false));
  };

  playChunk(0);
}

// Native Web Speech synthesis using the language-aware voice — used by speak()
// and as the fallback when Google Translate TTS is unreachable.
function speakNative(text, onDone) {
  if (!text || !window.speechSynthesis) {
    if (onDone) { try { onDone(); } catch (_) {} }
    endSpeech();
    return;
  }
  window.speechSynthesis.cancel();
  beginSpeech();
  setState('speaking');
  const v = pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  u.rate  = S.settings.rate;
  u.pitch = S.settings.pitch;
  u.lang  = S.settings.lang;
  if (v && v.type === 'native') u.voice = v.voice;

  // Chrome bug: long utterances can freeze — nudge the queue while speaking.
  const keepAlive = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10000);

  const done = () => {
    clearInterval(keepAlive);
    if (onDone) { const cb = onDone; onDone = null; try { cb(); } catch (_) {} }
    endSpeech();
  };
  u.onend   = done;
  u.onerror = done;

  S.utterance = u;
  window.speechSynthesis.speak(u);
}

function speak(text) {
  if (!text) { endSpeech(); return; }
  stopGtts();
  const v = pickVoice();
  if (v && v.type === 'gtts') { speakGtts(text, v.lang); return; }
  speakNative(text);
}

// Voices load asynchronously — refresh our cache + dropdown whenever they change.
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

// ─────────────────────────────────────────────────────────
//  CHAT MESSAGES
// ─────────────────────────────────────────────────────────
function addMsg(type, sender, text) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${type}`;

  const lbl = document.createElement('div');
  lbl.className = 'msg-label';
  lbl.textContent = sender;

  const bub = document.createElement('div');
  bub.className = 'msg-bubble';
  bub.textContent = text;

  wrap.appendChild(lbl);
  wrap.appendChild(bub);
  el.chatFeed.appendChild(wrap);
  while (el.chatFeed.children.length > 120) el.chatFeed.firstElementChild.remove();
  el.chatFeed.scrollTop = el.chatFeed.scrollHeight;

  // Switch to chat tab to show the response
  if (type === 'jarvis' || type === 'err') {
    // only auto-switch if current tab is HUD
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab?.dataset.tab === 'hud') {
      // don't switch — user may be watching the HUD
    }
  }
  return wrap;
}

let _typingSeq = 0;
function addTyping() {
  const id = `typing-${++_typingSeq}`;
  const wrap = document.createElement('div');
  wrap.className = 'msg jarvis';
  wrap.id = id;

  const lbl = document.createElement('div');
  lbl.className = 'msg-label';
  lbl.textContent = 'JARVIS';

  const bub = document.createElement('div');
  bub.className = 'msg-bubble';
  bub.innerHTML = '<span class="typing-dots"><i></i><i></i><i></i></span>';

  wrap.appendChild(lbl);
  wrap.appendChild(bub);
  el.chatFeed.appendChild(wrap);
  el.chatFeed.scrollTop = el.chatFeed.scrollHeight;
  return id;
}
function removeTyping(id) {
  const el2 = document.getElementById(id);
  if (el2) el2.remove();
}

// ─────────────────────────────────────────────────────────
//  SYSTEM LOG
// ─────────────────────────────────────────────────────────
function initLog() {
  el.clearLogBtn.addEventListener('click', () => {
    el.logFeed.innerHTML = '';
    log('info', 'Log cleared');
  });
}

function log(type, msg) {
  const row = document.createElement('div');
  row.className = `log-row ${type}`;

  const tEl = document.createElement('span');
  tEl.className = 'log-ts';
  tEl.textContent = ts();

  const mEl = document.createElement('span');
  mEl.className = 'log-msg';
  mEl.textContent = msg;

  row.appendChild(tEl);
  row.appendChild(mEl);
  el.logFeed.appendChild(row);

  // Keep log capped at 200 entries
  const rows = el.logFeed.querySelectorAll('.log-row');
  if (rows.length > 200) rows[0].remove();

  el.logFeed.scrollTop = el.logFeed.scrollHeight;
}

// ─────────────────────────────────────────────────────────
//  SETTINGS
// ─────────────────────────────────────────────────────────
function loadSettings() {
  chrome.storage.local.get('jarvisV2Settings', ({ jarvisV2Settings }) => {
    if (jarvisV2Settings) Object.assign(S.settings, jarvisV2Settings);
    applySettingsUI();
    // Auto-arm wake-word listening only AFTER the persisted settings are in
    // place (so the saved language/wakeword are honored) — the user never has
    // to click the mic to start using JARVIS.
    if (S.settings.wakeActivation) {
    // Auto-arm only when the mic is not hard-denied — otherwise a permission
    // tab would pop open right after every panel open. A manual tap always works.
      setTimeout(async () => {
        const st = await micPermissionState();
        if (st !== 'denied') enableWakeMode(true);
        else log('info', 'Microphone is blocked — enable it in the browser, then wake mode starts.');
      }, 400);
    }
  });
}

function applySettingsUI() {
  const { model, rate, pitch, lang, speakAI, continuous, wakeword, wakeActivation, indicator } = S.settings;

  const knownVals = Array.from(document.querySelectorAll('.model-row[data-val]'))
    .map(r => r.dataset.val)
    .filter(v => v !== '__custom__');
  const isCustom = !knownVals.includes(model);
  const customInput = $('customModelInput');

  document.querySelectorAll('.model-row').forEach(row => {
    const active = isCustom ? row.dataset.val === '__custom__' : row.dataset.val === model;
    row.classList.toggle('active', active);
    const inp = row.querySelector('input');
    if (inp) inp.checked = active;
  });
  if (customInput) {
    customInput.style.display = isCustom ? 'block' : 'none';
    if (isCustom) customInput.value = model;
  }

  el.rateSlider.value      = rate;
  el.rateOut.textContent   = `${rate}×`;
  el.pitchSlider.value     = pitch;
  el.pitchOut.textContent  = String(pitch);
  el.langSel.value         = lang;
  if (el.recogSel) el.recogSel.value = S.settings.recogLang || 'en-US';
  updateVoiceTrigger();
  if (el.listenSlider) {
    el.listenSlider.value = S.settings.listenWindow || 6;
    if (el.listenOut) el.listenOut.textContent = `${el.listenSlider.value}s`;
  }
  el.tglSpeak.checked      = speakAI;
  el.tglContinuous.checked = continuous;
  el.wakewordInput.value   = wakeword;
  if (el.tglWakeActivation) el.tglWakeActivation.checked = wakeActivation;
  el.tglIndicator.checked  = indicator;

  // Localize the greeting bubble shown on boot
  const greetBubble = document.querySelector('.chat-feed .msg.jarvis .msg-bubble');
  if (greetBubble) greetBubble.textContent = T('greeting');

  updateRangeTrack(el.rateSlider);
  updateRangeTrack(el.pitchSlider);
  if (el.listenSlider) updateRangeTrack(el.listenSlider);
}

function initSettings() {
  // Model selection
  const customInput = $('customModelInput');

  el.modelList.querySelectorAll('.model-row').forEach(row => {
    row.addEventListener('click', () => {
      el.modelList.querySelectorAll('.model-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      const inp = row.querySelector('input');
      if (inp) inp.checked = true;

      if (row.dataset.val === '__custom__') {
        customInput.style.display = 'block';
        customInput.focus();
        S.settings.model = customInput.value.trim() || S.settings.model;
      } else {
        customInput.style.display = 'none';
        S.settings.model = row.dataset.val;
      }
      log('info', `AI model → ${S.settings.model}`);
    });
  });

  customInput?.addEventListener('input', () => {
    S.settings.model = customInput.value.trim();
  });
  customInput?.addEventListener('change', () => {
    log('info', `AI model → ${S.settings.model}`);
  });

  // Sliders
  el.rateSlider.addEventListener('input', () => {
    S.settings.rate = parseFloat(el.rateSlider.value);
    el.rateOut.textContent = `${S.settings.rate}×`;
    updateRangeTrack(el.rateSlider);
  });
  el.pitchSlider.addEventListener('input', () => {
    S.settings.pitch = parseFloat(el.pitchSlider.value);
    el.pitchOut.textContent = String(S.settings.pitch);
    updateRangeTrack(el.pitchSlider);
  });

  // Select — language (rebuilds the TTS voice list for that language)
  el.langSel.addEventListener('change', () => {
    S.settings.lang = el.langSel.value;
    refreshVoices();
    log('info', `Language → ${S.settings.lang}`);
  });

  // Voice selection (TTS) — '' means AUTO (best voice for the selected language)
  // Voice selection (TTS) — custom sci-fi dropdown ('' = AUTO)
  initVoiceDropdown();

  // Recognition language — the language JARVIS HEARS commands in. Independent
  // of the voice language, so you can keep English recognition (most accurate
  // for commands) while JARVIS speaks Slovak/Czech/etc.
  if (el.recogSel) {
    el.recogSel.addEventListener('change', () => {
      S.settings.recogLang = el.recogSel.value || 'en-US';
      log('info', 'Recognition language → ' + S.settings.recogLang);
      // Restart recognition with the new language if the mic is live.
      if (S.jarvisState === 'listening' || S.wakeMode) {
        chrome.runtime.sendMessage({ type: 'JARVIS_SR_STOP' }).catch(() => {});
        setTimeout(() => startListening(false), 250);
      }
    });
  }

  // Preview the selected voice with a quick sample line
  const voiceTestBtn = $('voiceTestBtn');
  if (voiceTestBtn) {
    voiceTestBtn.addEventListener('click', () => {
      speak(T('greeting'));
      log('info', 'Voice preview played');
    });
  }

  // Listen window — how long JARVIS keeps listening after the wake word
  el.listenSlider.addEventListener('input', () => {
    S.settings.listenWindow = parseInt(el.listenSlider.value, 10);
    el.listenOut.textContent = `${S.settings.listenWindow}s`;
    updateRangeTrack(el.listenSlider);
  });

  // Toggles
  el.tglSpeak.addEventListener('change', ()     => { S.settings.speakAI    = el.tglSpeak.checked; });
  el.tglContinuous.addEventListener('change', () => { S.settings.continuous = el.tglContinuous.checked; });
  el.tglIndicator.addEventListener('change', ()  => { S.settings.indicator  = el.tglIndicator.checked; });
  if (el.tglWakeActivation) {
    el.tglWakeActivation.addEventListener('change', () => {
      S.settings.wakeActivation = el.tglWakeActivation.checked;
      enableWakeMode(S.settings.wakeActivation);
      chrome.storage.local.set({ jarvisV2Settings: S.settings });
    });
  }
  el.wakewordInput.addEventListener('change', () => {
    S.settings.wakeword = el.wakewordInput.value.trim().toLowerCase() || 'jarvis';
  });

  // Save
  el.saveCfgBtn.addEventListener('click', () => {
    chrome.storage.local.set({ jarvisV2Settings: S.settings }, () => {
      el.saveCfgBtn.textContent = '✓ SAVED';
      log('success', 'Configuration saved');
      setTimeout(() => { el.saveCfgBtn.textContent = 'SAVE CONFIGURATION'; }, 2000);
    });
  });
}

function updateRangeTrack(input) {
  const min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.background =
    `linear-gradient(90deg, var(--c-cyan) ${pct}%, rgba(0,243,255,.15) ${pct}%)`;
}

// ─────────────────────────────────────────────────────────
//  SVG TICK MARKS
// ─────────────────────────────────────────────────────────
function drawTickMarks() {
  const svg = $('tickSvg');
  if (!svg) return;
  const cx = 110, cy = 110, r = 106, total = 48;
  const NS = 'http://www.w3.org/2000/svg';

  for (let i = 0; i < total; i++) {
    const major = i % 12 === 0;
    const med   = i % 4  === 0;
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const len   = major ? 12 : (med ? 7 : 4);
    const stroke = major ? '#00f3ff' : (med ? 'rgba(0,243,255,.5)' : 'rgba(0,243,255,.25)');
    const sw     = major ? 1.8 : (med ? 1 : 0.7);

    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', (cx + r * Math.cos(angle)).toFixed(2));
    line.setAttribute('y1', (cy + r * Math.sin(angle)).toFixed(2));
    line.setAttribute('x2', (cx + (r - len) * Math.cos(angle)).toFixed(2));
    line.setAttribute('y2', (cy + (r - len) * Math.sin(angle)).toFixed(2));
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', sw);
    svg.appendChild(line);
  }
}

// ─────────────────────────────────────────────────────────
//  PAGE INDICATOR (via content script)
// ─────────────────────────────────────────────────────────
async function notifyPage(text) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_INDICATOR', text }).catch(() => {});
    }
  } catch (_) {}
}
