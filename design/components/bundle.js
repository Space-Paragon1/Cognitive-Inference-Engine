/* @ds-bundle: {"format":4,"namespace":"CLR","components":[{"name":"LoadGauge"},{"name":"ContextPill"},{"name":"Breakdown"},{"name":"ConnectionStatus"},{"name":"StatTile"},{"name":"DirectiveCard"},{"name":"TaskRow"},{"name":"DifficultyChip"},{"name":"Timer"},{"name":"MiniPlayer"},{"name":"PlaybackControls"},{"name":"ChartStyle"},{"name":"Slider"},{"name":"Toggle"},{"name":"Button"},{"name":"TextField"},{"name":"SegmentedControl"},{"name":"TabBar"},{"name":"Sidebar"},{"name":"BottomSheet"},{"name":"Toast"},{"name":"Banner"},{"name":"EmptyState"},{"name":"Skeleton"},{"name":"SourceCard"}]} */
/* Cognitive Load Router — preview renderers.
   Each function returns an HTML string styled by bundle.css. They exist so every
   preview and screen mock draws from one source; in the app, build the same
   markup as React components with CSS Modules (see components/index.d.ts). */
(function () {
  'use strict';
  var uid = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function p(d) { return '<path d="' + d + '"/>'; }
  function cls() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  /* ---------- Icons: Lucide names, drawn inline for previews (use lucide-react in the app) ---------- */
  var WAVE = 'c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1';
  var GEAR = 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z';
  var SHIELD = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';
  var I = {
    'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'waves': p('M2 6' + WAVE) + p('M2 12' + WAVE) + p('M2 18' + WAVE),
    'repeat': p('m17 2 4 4-4 4') + p('M3 11v-1a4 4 0 0 1 4-4h14') + p('m7 22-4-4 4-4') + p('M21 13v1a4 4 0 0 1-4 4H3'),
    'battery-low': '<rect x="2" y="7" width="16" height="10" rx="2"/>' + p('M22 11v2') + p('M6 11v2'),
    'leaf': p('M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z') + p('M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'),
    'circle-dashed': '<circle cx="12" cy="12" r="10" stroke-dasharray="3.2 3"/>',
    'coffee': p('M10 2v2') + p('M14 2v2') + p('M6 2v2') + p('M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1'),
    'bell': p('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9') + p('M10.3 21a1.94 1.94 0 0 0 3.4 0'),
    'bell-off': p('M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5') + p('M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7') + p('M10.3 21a1.94 1.94 0 0 0 3.4 0') + p('m2 2 20 20'),
    'shield-check': p(SHIELD) + p('m9 12 2 2 4-4'),
    'shield': p(SHIELD),
    'list-todo': '<rect x="3" y="5" width="6" height="6" rx="1"/>' + p('m3 17 2 2 4-4') + p('M13 6h8') + p('M13 12h8') + p('M13 18h8'),
    'list-checks': p('m3 17 2 2 4-4') + p('m3 7 2 2 4-4') + p('M13 6h8') + p('M13 12h8') + p('M13 18h8'),
    'timer': p('M10 2h4') + p('M12 14l3-3') + '<circle cx="12" cy="14" r="8"/>',
    'chevrons-down': p('m7 6 5 5 5-5') + p('m7 13 5 5 5-5'),
    'mountain': p('m8 3 4 8 5-5 5 15H2L8 3z'),
    'gauge': p('m12 14 4-4') + p('M3.34 19a10 10 0 1 1 17.32 0'),
    'history': p('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8') + p('M3 3v5h5') + p('M12 7v5l4 2'),
    'bar-chart': p('M3 3v18h18') + p('M18 17V9') + p('M13 17V5') + p('M8 17v-3'),
    'settings': p(GEAR) + '<circle cx="12" cy="12" r="3"/>',
    'ellipsis': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    'more-vertical': '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    'play': '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
    'pause': '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    'square': '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/>',
    'skip-back': p('M19 20 9 12l10-8v16z') + p('M5 19V5'),
    'skip-forward': p('M5 4l10 8-10 8V4z') + p('M19 5v14'),
    'chevron-left': p('m15 18-6-6 6-6'), 'chevron-right': p('m9 18 6-6-6-6'), 'chevron-down': p('m6 9 6 6 6-6'), 'chevron-up': p('m18 15-6-6-6 6'),
    'arrow-left': p('m12 19-7-7 7-7') + p('M19 12H5'),
    'arrow-right': p('M5 12h14') + p('m12 5 7 7-7 7'), 'arrow-up': p('m5 12 7-7 7 7') + p('M12 19V5'), 'arrow-down': p('M12 5v14') + p('m19 12-7 7-7-7'),
    'arrow-up-down': p('m21 16-4 4-4-4') + p('M17 20V4') + p('m3 8 4-4 4 4') + p('M7 4v16'),
    'plus': p('M5 12h14') + p('M12 5v14'), 'x': p('M18 6 6 18') + p('m6 6 12 12'), 'check': p('M20 6 9 17l-5-5'),
    'check-circle': '<circle cx="12" cy="12" r="10"/>' + p('m9 12 2 2 4-4'),
    'copy': '<rect x="8" y="8" width="14" height="14" rx="2"/>' + p('M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'),
    'qr-code': '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/>' + p('M21 16h-3a2 2 0 0 0-2 2v3') + p('M21 21v.01') + p('M12 7v3a2 2 0 0 1-2 2H7') + p('M3 12h.01') + p('M12 3h.01') + p('M12 16v.01') + p('M16 12h1') + p('M21 12v.01') + p('M12 21v-1'),
    'wifi': p('M12 20h.01') + p('M2 8.82a15 15 0 0 1 20 0') + p('M5 12.86a10 10 0 0 1 14 0') + p('M8.5 16.43a5 5 0 0 1 7 0'),
    'wifi-off': p('M12 20h.01') + p('M8.5 16.43a5 5 0 0 1 7 0') + p('M2 8.82a15 15 0 0 1 4.17-2.65') + p('M10.66 5c4.01-.36 8.14.9 11.34 3.76') + p('M16.85 11.25a10 10 0 0 1 2.22 1.68') + p('M5 13a10 10 0 0 1 5.24-2.76') + p('m2 2 20 20'),
    'refresh': p('M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8') + p('M21 3v5h-5') + p('M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16') + p('M8 16H3v5'),
    'download': p('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4') + p('m7 10 5 5 5-5') + p('M12 15V3'),
    'trash': p('M3 6h18') + p('M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6') + p('M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2') + p('M10 11v6') + p('M14 11v6'),
    'eye': p('M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0') + '<circle cx="12" cy="12" r="3"/>',
    'eye-off': p('M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68') + p('M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61') + p('M14.12 14.12a3 3 0 1 1-4.24-4.24') + p('m2 2 20 20'),
    'mail': '<rect x="2" y="4" width="20" height="16" rx="2"/>' + p('m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'),
    'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/>' + p('M7 11V7a5 5 0 0 1 10 0v4'),
    'globe': '<circle cx="12" cy="12" r="10"/>' + p('M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20') + p('M2 12h20'),
    'code': p('m18 16 4-4-4-4') + p('m6 8-4 4 4 4') + p('m14.5 4-5 16'),
    'monitor': '<rect x="2" y="3" width="20" height="14" rx="2"/>' + p('M8 21h8') + p('M12 17v4'),
    'graduation-cap': p('M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z') + p('M22 10v6') + p('M6 12.5V16a6 3 0 0 0 12 0v-3.5'),
    'smartphone': '<rect x="5" y="2" width="14" height="20" rx="2"/>' + p('M12 18h.01'),
    'info': '<circle cx="12" cy="12" r="10"/>' + p('M12 16v-4') + p('M12 8h.01'),
    'alert-circle': '<circle cx="12" cy="12" r="10"/>' + p('M12 8v4') + p('M12 16h.01'),
    'sun': '<circle cx="12" cy="12" r="4"/>' + p('M12 2v2') + p('M12 20v2') + p('m4.93 4.93 1.41 1.41') + p('m17.66 17.66 1.41 1.41') + p('M2 12h2') + p('M20 12h2') + p('m6.34 17.66-1.41 1.41') + p('m19.07 4.93-1.41 1.41'),
    'moon': p('M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'),
    'book-open': p('M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z') + p('M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'),
    'clock': '<circle cx="12" cy="12" r="10"/>' + p('M12 6v6l4 2'),
    'hash': p('M4 9h16') + p('M4 15h16') + p('M10 3 8 21') + p('M16 3l-2 18'),
    'log-out': p('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4') + p('m16 17 5-5-5-5') + p('M21 12H9'),
    'user': p('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2') + '<circle cx="12" cy="7" r="4"/>',
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="2"/>' + p('M16 2v4') + p('M8 2v4') + p('M3 10h18'),
    'trending-up': p('M22 7 13.5 15.5 8.5 10.5 2 17') + p('M16 7h6v6'),
    'trending-down': p('M22 17 13.5 8.5 8.5 13.5 2 7') + p('M16 17h6v-6'),
    'wind': p('M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2') + p('M9.6 4.6A2 2 0 1 1 11 8H2') + p('M12.6 19.4A2 2 0 1 0 14 16H2'),
    'pen-line': p('M12 20h9') + p('M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'),
    'external-link': p('M15 3h6v6') + p('M10 14 21 3') + p('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'),
    'menu': p('M4 12h16') + p('M4 6h16') + p('M4 18h16'),
    'filter': p('M22 3H2l8 9.46V19l4 2v-8.54L22 3z'),
    'loader': p('M21 12a9 9 0 1 1-6.219-8.56'),
    'battery': '<rect x="2" y="7" width="16" height="10" rx="2"/>' + p('M22 11v2') + '<rect x="4.5" y="9.5" width="9" height="5" rx="1" fill="currentColor" stroke="none"/>',
    'signal': p('M2 20h.01') + p('M7 20v-4') + p('M12 20v-8') + p('M17 20V8'),
    'grip': '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    'zap-off': p('M10.5 4.5 12 2l-1 8h7l-2.5 3.5') + p('M14.5 18 12 22l1-8H6l2.5-3.5') + p('m2 2 20 20'),
    'help': '<circle cx="12" cy="12" r="10"/>' + p('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3') + p('M12 17h.01'),
    'sliders': p('M4 21v-7') + p('M4 10V3') + p('M12 21v-9') + p('M12 8V3') + p('M20 21v-5') + p('M20 12V3') + p('M2 14h4') + p('M10 8h4') + p('M18 16h4')
  };
  function icon(name, size, extra) {
    size = size || 20;
    return '<svg class="clr-icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra ? ' ' + extra : '') + '>' + (I[name] || I['circle-dashed']) + '</svg>';
  }

  /* Brand mark — the app icon's node graph (frontend/android ic_launcher_foreground.xml), tinted with tokens. */
  function Logo(size) {
    size = size || 28;
    return '<svg width="' + size + '" height="' + size + '" viewBox="14 14 80 80" aria-hidden="true"><g fill="none" stroke="var(--accent)" stroke-opacity=".55" stroke-width="3.5" stroke-linecap="round"><path d="M54 47V31M47 54H31M61 54h16M49 59 37 72M59 59l12 13"/></g><g fill="var(--accent)"><circle cx="54" cy="54" r="7"/><circle cx="54" cy="25" r="5"/><circle cx="25" cy="54" r="5"/><circle cx="83" cy="54" r="5"/><circle cx="33" cy="77" r="5"/><circle cx="75" cy="77" r="5"/></g></svg>';
  }

  /* ---------- Vocabulary ---------- */
  var CTX = {
    deep_focus:   { label: 'Deep focus',   icon: 'target',        blurb: 'Little switching, steady effort. This is your flow zone.' },
    shallow_work: { label: 'Shallow work', icon: 'waves',         blurb: 'Your attention is spread across tabs. Good for lighter tasks.' },
    stuck:        { label: 'Stuck',        icon: 'repeat',        blurb: 'The same errors keep coming back. A fresh angle might help.' },
    fatigue:      { label: 'Fatigue',      icon: 'battery-low',   blurb: 'Load has stayed high for a long stretch. Resting counts as progress.' },
    recovering:   { label: 'Recovering',   icon: 'leaf',          blurb: 'Load is easing after a hard stretch. Ease back in gently.' },
    unknown:      { label: 'Warming up',   icon: 'circle-dashed', blurb: 'Still learning how you work today. Give it a minute or two.' }
  };
  var CTX_ORDER = ['deep_focus', 'shallow_work', 'stuck', 'fatigue', 'recovering', 'unknown'];
  var DIRECTIVES = {
    recommend_break:        { label: 'Take a break',             icon: 'coffee',        tone: 'rest' },
    suppress_notifications: { label: 'Notifications silenced',   icon: 'bell-off',      tone: 'accent' },
    block_distracting_tabs: { label: 'Distracting tabs blocked', icon: 'shield-check',  tone: 'accent' },
    suggest_task:           { label: 'Suggested task',           icon: 'list-todo',     tone: 'accent' },
    shorten_focus_interval: { label: 'Shorter focus session',    icon: 'timer',         tone: 'ctx:fatigue' },
    delay_hard_tasks:       { label: 'Hard tasks deferred',      icon: 'chevrons-down', tone: 'ctx:shallow_work' },
    schedule_hard_task:     { label: 'Good time for hard work',  icon: 'mountain',      tone: 'ctx:deep_focus' },
    allow_notifications:    { label: 'Notifications OK',         icon: 'bell',          tone: 'positive' }
  };
  function toneAttr(t) { return t && t.indexOf('ctx:') === 0 ? 'data-ctx="' + t.slice(4) + '"' : 'data-tone="' + (t || 'accent') + '"'; }
  var DIFF = { easy: { label: 'Easy', n: 1 }, medium: { label: 'Medium', n: 2 }, hard: { label: 'Hard', n: 3 }, review: { label: 'Review', n: 0 } };
  var BREAKDOWN = {
    intrinsic:  { label: 'Intrinsic',  token: '--load-intrinsic',  desc: 'How hard the task itself is: errors and uneven typing.' },
    extraneous: { label: 'Extraneous', token: '--load-extraneous', desc: 'Distraction and switching between tabs and windows.' },
    germane:    { label: 'Germane',    token: '--load-germane',    desc: 'Productive effort: the sustained work that builds understanding.' }
  };

  /* ---------- Sample data (from the brief) ---------- */
  var sample = {
    state: { load: 0.62, context: 'deep_focus', confidence: 0.8, breakdown: { intrinsic: 0.41, extraneous: 0.22, germane: 0.58 } },
    directives: [
      { type: 'suppress_notifications', reason: 'Protecting your deep-focus window.', meta: 'Since 9:42 pm', action: 'Pause' },
      { type: 'block_distracting_tabs', reason: 'Cutting extraneous load while you are in the zone.', meta: '3 sites · since 9:42 pm', action: 'Edit' }
    ],
    tasks: [
      { id: 't1', title: 'Linear Algebra problem set 4', difficulty: 'hard', minutes: 50, tags: ['math'] },
      { id: 't2', title: 'CS 201 lab: linked lists', difficulty: 'medium', minutes: 40, tags: ['cs201'] },
      { id: 't3', title: 'Review lecture 7 notes', difficulty: 'review', minutes: 20, tags: [] },
      { id: 't4', title: 'Reply to group project thread', difficulty: 'easy', minutes: 10, tags: [] }
    ],
    today: { focus: '1 h 48 m', avgLoad: 54, sessions: 3, dist: { deep_focus: .46, shallow_work: .24, stuck: .07, fatigue: .05, recovering: .12, unknown: .06 } },
    week: [
      { d: 'Mon', h: 2.1, load: 49, sessions: 3, peak: 81, top: 'deep_focus', dist: { deep_focus: .48, shallow_work: .26, stuck: .08, fatigue: .04, recovering: .1, unknown: .04 } },
      { d: 'Tue', h: 0.9, load: 58, sessions: 2, peak: 88, top: 'stuck', dist: { deep_focus: .22, shallow_work: .28, stuck: .27, fatigue: .1, recovering: .09, unknown: .04 } },
      { d: 'Wed', h: 3.4, load: 52, sessions: 4, peak: 79, top: 'deep_focus', dist: { deep_focus: .61, shallow_work: .17, stuck: .05, fatigue: .04, recovering: .1, unknown: .03 } },
      { d: 'Thu', h: 1.7, load: 55, sessions: 3, peak: 86, top: 'shallow_work', dist: { deep_focus: .36, shallow_work: .34, stuck: .1, fatigue: .08, recovering: .08, unknown: .04 } },
      { d: 'Fri', h: 2.6, load: 50, sessions: 3, peak: 80, top: 'deep_focus', dist: { deep_focus: .52, shallow_work: .22, stuck: .06, fatigue: .06, recovering: .1, unknown: .04 } },
      { d: 'Sat', h: 0.4, load: 41, sessions: 1, peak: 62, top: 'shallow_work', dist: { deep_focus: .2, shallow_work: .45, stuck: .05, fatigue: .02, recovering: .18, unknown: .1 } },
      { d: 'Sun', h: 1.2, load: 47, sessions: 2, peak: 74, top: 'deep_focus', dist: { deep_focus: .42, shallow_work: .3, stuck: .06, fatigue: .03, recovering: .14, unknown: .05 } }
    ],
    pomodoro: { phase: 'work', remaining: 684, total: 1500, sessions: 2 }
  };

  /* Deterministic load series for charts and replay. */
  function rng(seed) { var s = seed || 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function series(n, seed, plan) {
    var r = rng(seed || 11), out = [], v = 0.38;
    plan = plan || [['unknown', .06, .35], ['shallow_work', .18, .5], ['deep_focus', .34, .6], ['stuck', .12, .8], ['recovering', .1, .45], ['deep_focus', .2, .62]];
    var idx = 0, acc = 0;
    for (var i = 0; i < n; i++) {
      while (idx < plan.length - 1 && i >= (acc + plan[idx][1]) * n) { acc += plan[idx][1]; idx++; }
      var target = plan[idx][2];
      v += (target - v) * 0.12 + (r() - 0.5) * 0.05;
      v = Math.max(0.08, Math.min(0.97, v));
      out.push({ v: v, ctx: plan[idx][0] });
    }
    return out;
  }

  /* ---------- Small parts ---------- */
  function Button(o) {
    o = o || {};
    var v = o.variant || 'primary';
    var c = cls('clr-btn', 'clr-btn--' + v, o.size && 'clr-btn--' + o.size, o.block && 'clr-btn--block', o.iconOnly && 'clr-btn--icon', o.round && 'clr-btn--round', o.loading && 'is-loading', o.cls);
    var inner = o.loading ? '<span class="clr-spinner" aria-hidden="true"></span>' + esc(o.loadingLabel || o.label) :
      (o.icon ? icon(o.icon, o.size === 'sm' ? 16 : o.size === 'lg' ? 20 : 18) : '') + (o.iconOnly ? '<span class="clr-sr">' + esc(o.label) + '</span>' : esc(o.label || '')) + (o.iconRight ? icon(o.iconRight, 18) : '');
    return '<button type="button" class="' + c + '"' + (o.disabled ? ' disabled' : '') + (o.loading ? ' aria-busy="true"' : '') + (o.pressed != null ? ' aria-pressed="' + !!o.pressed + '"' : '') + (o.style ? ' style="' + o.style + '"' : '') + '>' + inner + '</button>';
  }
  function ContextPill(o) {
    o = o || {}; var k = o.context || 'deep_focus', c = CTX[k];
    var sz = o.size === 'sm' ? 14 : o.size === 'lg' ? 18 : 16;
    return '<span class="' + cls('clr-ctx', o.size && 'clr-ctx--' + o.size, o.plain && 'clr-ctx--plain', o.uncertain && 'clr-ctx--uncertain') + '" data-ctx="' + k + '">' + icon(c.icon, sz) + esc(o.label || c.label) + '</span>';
  }
  function Badge(text, tone, ic) { return '<span class="clr-badge" ' + toneAttr(tone) + '>' + (ic ? icon(ic, 12) : '') + esc(text) + '</span>'; }
  function Tag(t) { return '<span class="clr-tag">' + icon('hash', 11) + esc(t) + '</span>'; }
  function DifficultyChip(o) {
    var d = DIFF[(o && o.level) || o] || DIFF.medium, lvl = (o && o.level) || o;
    var glyph = d.n ? '<span class="clr-diff__bars" aria-hidden="true"><i class="' + (d.n >= 1 ? 'is-on' : '') + '"></i><i class="' + (d.n >= 2 ? 'is-on' : '') + '"></i><i class="' + (d.n >= 3 ? 'is-on' : '') + '"></i></span>' : icon('book-open', 13);
    return '<span class="clr-diff' + (lvl === 'hard' ? ' clr-diff--hard' : '') + '">' + glyph + d.label + '</span>';
  }
  function Toggle(o) {
    o = o || {};
    var t = '<button type="button" role="switch" class="clr-toggle" aria-checked="' + !!o.on + '"' + (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + (o.disabled ? ' disabled' : '') + '><span class="clr-toggle__thumb">' + icon('check', 14, 'stroke-width="3"') + '</span></button>';
    if (!o.row) return t;
    return '<div class="clr-toggle-row"><div class="clr-toggle-row__text"><span class="clr-toggle-row__label">' + esc(o.label) + '</span>' + (o.desc ? '<span class="clr-toggle-row__desc">' + esc(o.desc) + '</span>' : '') + '</div>' + t + '</div>';
  }
  function TextField(o) {
    o = o || {};
    var st = o.error ? 'is-error' : o.valid ? 'is-valid' : '';
    var lead = o.icon ? icon(o.icon, 18) : '';
    var trail = o.trailing ? '<button type="button" class="clr-input-btn" aria-label="' + esc(o.trailingLabel || 'Show password') + '">' + icon(o.trailing, 18) + '</button>' : '';
    var help = o.error ? '<span class="clr-field__help" role="alert">' + icon('alert-circle', 16) + esc(o.error) + '</span>' :
      o.valid ? '<span class="clr-field__help">' + icon('check-circle', 16) + esc(o.valid) + '</span>' : o.help ? '<span class="clr-field__help">' + esc(o.help) + '</span>' : '';
    var input = o.textarea ? '<textarea class="clr-input clr-textarea" placeholder="' + esc(o.placeholder) + '">' + esc(o.value) + '</textarea>' :
      '<input class="' + cls('clr-input', lead && 'clr-input--lead', trail && 'clr-input--trail') + '" type="' + (o.type || 'text') + '" value="' + esc(o.value) + '" placeholder="' + esc(o.placeholder) + '"' + (o.error ? ' aria-invalid="true"' : '') + (o.focus ? ' style="border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)"' : '') + '>';
    return '<label class="' + cls('clr-field', st) + '"><span class="clr-field__label">' + esc(o.label) + (o.aside || '') + '</span><span class="clr-input-wrap">' + lead + input + trail + '</span>' + help + (o.extra || '') + '</label>';
  }
  function Segmented(o) {
    return '<div class="' + cls('clr-seg', o.size === 'sm' && 'clr-seg--sm') + '" role="group"' + (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + '>' + o.options.map(function (x) {
      return '<button type="button" aria-pressed="' + (x === o.value) + '" class="' + (o.num ? 'clr-num' : '') + '">' + esc(x) + '</button>';
    }).join('') + '</div>';
  }
  function FilterChip(o) {
    var c = o.context ? CTX[o.context] : null;
    return '<button type="button" class="clr-chip"' + (o.context ? ' data-ctx="' + o.context + '"' : ' data-tone="accent"') + ' aria-pressed="' + !!o.selected + '">' + (o.selected && !c ? icon('check', 16) : c ? icon(c.icon, 16) : '') + esc(o.label || (c && c.label)) + (o.count != null ? '<span class="clr-chip__count clr-num">' + o.count + '</span>' : '') + '</button>';
  }

  /* ---------- Gauge ---------- */
  function arc(v) { return (75 * Math.max(0, Math.min(1, v))).toFixed(2) + ' 100'; }
  function gaugeLabel(s) { return 'Load ' + Math.round(s.load * 100) + ' percent, ' + CTX[s.context].label.toLowerCase() + '. Confidence ' + Math.round(s.confidence * 100) + ' percent.'; }
  function LoadGauge(o) {
    o = Object.assign({ load: .62, context: 'deep_focus', confidence: .8, size: 280, ticks: true, foot: true, thresholds: [.7, .85] }, o || {});
    var id = 'clrg' + (++uid), unc = o.confidence < .5, sw = 12, pct = Math.round(o.load * 100);
    var circ = function (c, extra) { return '<circle class="' + c + '" cx="100" cy="100" r="84" fill="none" pathLength="100" transform="rotate(135 100 100)" stroke-linecap="round" ' + extra + '/>'; };
    var ticks = '';
    if (o.ticks) o.thresholds.forEach(function (t) {
      var a = (135 + 270 * t) * Math.PI / 180, r1 = 84 + sw / 2 + 5, r2 = r1 + 7;
      ticks += '<line class="clr-gauge__tick" x1="' + (100 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (100 + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (100 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (100 + r2 * Math.sin(a)).toFixed(1) + '"/>';
    });
    var svg = '<svg viewBox="0 0 200 200" aria-hidden="true"><defs><mask id="' + id + '">' + circ('clr-gauge__mask', 'stroke="#fff" stroke-width="' + (sw + 6) + '" stroke-dasharray="' + arc(o.load) + '"') + '</mask></defs>' +
      circ('clr-gauge__track', 'stroke-width="' + sw + '" stroke-dasharray="75 100"') +
      circ('clr-gauge__halo', 'stroke-width="' + (sw + 10) + '" stroke-dasharray="' + arc(o.load) + '"') +
      circ('clr-gauge__arc', 'stroke-width="' + sw + '" stroke-dasharray="' + arc(o.load) + '"') +
      circ('clr-gauge__dots', 'stroke-width="' + (sw * .7) + '" stroke-dasharray="0.001 3.2" mask="url(#' + id + ')"') + ticks + '</svg>';
    var center = o.empty ? '<div class="clr-gauge__center"><div class="clr-gauge__num" style="color:var(--ink-subtle)"><span data-num>–</span></div><div class="clr-gauge__cap">no data yet</div></div>' : '<div class="clr-gauge__center"><div class="clr-gauge__num clr-num"><span data-num>' + (unc ? '≈' : '') + pct + '</span><small>%</small></div><div class="clr-gauge__cap">' + (unc ? 'rough estimate' : 'load') + '</div></div>';
    var foot = o.foot ? '<div class="clr-gauge__foot" data-foot>' + ContextPill({ context: o.context, size: o.size < 220 ? 'sm' : null, uncertain: unc }) + '</div>' : '';
    return '<div class="clr-gauge' + (unc ? ' is-uncertain' : '') + '" data-ctx="' + o.context + '" style="--g:' + o.size + 'px;width:' + o.size + 'px;height:' + o.size + 'px" role="img" aria-label="' + (o.empty ? 'No load data yet. Connect a source.' : gaugeLabel(o)) + '">' + svg + center + foot + '</div>';
  }
  function MiniGauge(o) {
    o = Object.assign({ load: .62, context: 'deep_focus', size: 44, num: true, confidence: .8 }, o || {});
    var d = (Math.max(0, Math.min(1, o.load)) * 100).toFixed(1) + ' 100', unc = o.confidence < .5;
    var sw = o.size <= 24 ? 4 : 5;
    return '<span class="clr-gauge clr-gauge--mini" data-ctx="' + o.context + '" style="--g:' + o.size + 'px;width:' + o.size + 'px;height:' + o.size + 'px" role="img" aria-label="' + gaugeLabel(Object.assign({ confidence: .8 }, o)) + '"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="clr-gauge__track" cx="24" cy="24" r="20" fill="none" stroke-width="' + sw + '"/><circle class="clr-gauge__arc" cx="24" cy="24" r="20" fill="none" stroke-width="' + sw + '" pathLength="100" stroke-dasharray="' + d + '" stroke-linecap="round" transform="rotate(-90 24 24)"' + (unc ? ' style="stroke-dasharray:1 6;opacity:.8"' : '') + '/></svg>' +
      (o.num ? '<span class="clr-gauge__center"><span class="clr-gauge__num clr-num">' + Math.round(o.load * 100) + '</span></span>' : '') + '</span>';
  }
  function LoadPill(o) {
    o = Object.assign({ load: .62, context: 'deep_focus' }, o || {});
    return '<span class="clr-loadpill clr-num" data-ctx="' + o.context + '" role="status" aria-label="' + gaugeLabel(Object.assign({ confidence: .8 }, o)) + '">' + MiniGauge({ load: o.load, context: o.context, size: 22, num: false, confidence: o.confidence }) + Math.round(o.load * 100) + '%' + icon(CTX[o.context].icon, 16) + '</span>';
  }
  function Confidence(c) {
    var n = Math.round(c * 5), bars = '';
    for (var i = 0; i < 5; i++) bars += '<i class="' + (i < n ? 'is-on' : '') + '"></i>';
    return '<span class="clr-confidence"><span class="clr-confidence__bars" aria-hidden="true">' + bars + '</span><span>Confidence <b class="clr-num" style="color:var(--ink)">' + Math.round(c * 100) + '%</b>' + (c < .5 ? ' · still learning' : '') + '</span></span>';
  }
  function Breakdown(o) {
    o = Object.assign({}, sample.state.breakdown, o || {});
    return '<div class="clr-breakdown' + (o.compact ? ' clr-breakdown--compact' : '') + '">' + ['intrinsic', 'extraneous', 'germane'].map(function (k) {
      var b = BREAKDOWN[k], v = Math.round(o[k] * 100);
      return '<div class="clr-breakdown__row" style="--bar:var(' + b.token + ')"><span class="clr-breakdown__name"><i></i>' + b.label + '</span><span class="clr-breakdown__val clr-num">' + v + '%</span><span class="clr-breakdown__bar" role="img" aria-label="' + b.label + ' ' + v + ' percent"><span style="width:' + v + '%"></span></span><span class="clr-breakdown__desc">' + b.desc + '</span></div>';
    }).join('') + '</div>';
  }

  /* ---------- Connection ---------- */
  var SOURCES = { browser: { label: 'Browser', icon: 'globe', desc: 'Tab switches and scrolling. Never page text.' }, vscode: { label: 'VS Code', icon: 'code', desc: 'Compile errors and typing rhythm. Never what you type.' }, desktop: { label: 'Desktop agent', icon: 'monitor', desc: 'Window changes and idle time.' }, lms: { label: 'LMS', icon: 'graduation-cap', desc: 'Canvas, Moodle or Blackboard activity.' } };
  function ConnectionStatus(o) {
    o = o || {}; var s = o.status || 'live';
    var map = { live: ['Live', 'positive'], reconnecting: ['Reconnecting…', 'caution'], offline: ['Offline', ''] };
    var badge = '<span class="clr-conn clr-conn--' + s + '" ' + (map[s][1] ? 'data-tone="' + map[s][1] + '"' : '') + ' role="status">' + (s === 'reconnecting' ? '<span class="clr-spinner" style="width:10px;height:10px;border-width:1.5px" aria-hidden="true"></span>' : s === 'offline' ? icon('wifi-off', 14) : '<span class="clr-conn__dot" aria-hidden="true"></span>') + map[s][0] + '</span>';
    if (!o.sources) return badge;
    var on = o.on || ['browser', 'vscode'];
    return '<div class="clr-row" style="gap:12px">' + badge + '<span class="clr-sources">' + (o.sources === true ? ['browser', 'vscode', 'desktop', 'lms'] : o.sources).map(function (k) {
      var off = on.indexOf(k) < 0;
      return '<span class="clr-source-mini' + (off ? ' is-off' : '') + '"><b aria-hidden="true"></b>' + SOURCES[k].label + (off ? '<span class="clr-sr"> not connected</span>' : '') + '</span>';
    }).join('') + '</span></div>';
  }

  /* ---------- Stats ---------- */
  function StatTile(o) {
    return '<div class="' + cls('clr-stat', o.plain && 'clr-stat--plain') + '"><span class="clr-stat__label">' + (o.icon ? icon(o.icon, 16) : '') + esc(o.label) + '</span><span class="clr-stat__value clr-num">' + o.value + (o.unit ? '<small>' + esc(o.unit) + '</small>' : '') + '</span>' + (o.sub ? '<span class="clr-stat__sub">' + (o.trend ? icon(o.trend === 'up' ? 'trending-up' : 'trending-down', 14) : '') + o.sub + '</span>' : '') + '</div>';
  }
  function ContextBar(o) {
    var d = (o && o.dist) || sample.today.dist, keys = CTX_ORDER.filter(function (k) { return d[k] > 0; });
    var bar = '<div class="clr-ctxbar" role="img" aria-label="' + keys.map(function (k) { return CTX[k].label + ' ' + Math.round(d[k] * 100) + ' percent'; }).join(', ') + '">' + keys.map(function (k) { return '<span data-ctx="' + k + '" style="flex:' + d[k] + '"></span>'; }).join('') + '</div>';
    if (o && o.legend === false) return bar;
    return bar + '<div class="clr-legend">' + keys.map(function (k) { return '<span data-ctx="' + k + '">' + icon(CTX[k].icon, 14) + CTX[k].label + ' <b class="clr-num">' + Math.round(d[k] * 100) + '%</b></span>'; }).join('') + '</div>';
  }

  /* ---------- Directives ---------- */
  function DirectiveCard(o) {
    var d = DIRECTIVES[o.type];
    return '<div class="clr-directive' + (o.isNew ? ' is-new' : '') + '" ' + toneAttr(d.tone) + '><span class="clr-directive__icon">' + icon(d.icon, 20) + '</span><div><p class="clr-directive__title">' + esc(o.label || d.label) + '</p><p class="clr-directive__reason">' + esc(o.reason) + (o.meta ? ' <span class="clr-directive__meta">· ' + esc(o.meta) + '</span>' : '') + '</p></div>' + (o.action ? Button({ label: o.action, variant: 'ghost', size: 'sm' }) : '') + '</div>';
  }
  function DirectivesFeed(o) {
    o = o || {}; var items = o.items || sample.directives;
    var body = items.length ? '<div class="clr-feed" aria-live="polite">' + items.map(DirectiveCard).join('') + '</div>' :
      EmptyState({ icon: 'check-circle', tone: 'positive', title: 'All clear', body: 'Nothing needs adjusting right now. CLR will step in if your load changes.', compact: true });
    return (o.bare ? '' : '<div class="clr-card">') + '<div class="clr-card__head"><h3 class="clr-card__title">What CLR is doing</h3><span class="clr-card__meta">' + (items.length ? items.length + ' active' : '') + '</span></div>' + body + (o.bare ? '' : '</div>');
  }

  /* ---------- Tasks ---------- */
  function TaskRow(o) {
    var meta = DifficultyChip(o.difficulty) + '<span class="clr-meta clr-num">' + icon('clock', 14) + o.minutes + ' min</span>' + (o.tags || []).map(Tag).join('');
    var side = (o.moved ? '<span class="clr-task__moved clr-num" title="Moved ' + (o.moved > 0 ? 'up' : 'down') + '">' + icon(o.moved > 0 ? 'arrow-up' : 'arrow-down', 12) + Math.abs(o.moved) + '</span>' : '') +
      (o.recommended && o.start !== false ? Button({ label: 'Start', icon: 'play', size: 'sm', variant: 'primary' }) : '') +
      '<button type="button" class="clr-btn clr-btn--ghost clr-btn--icon clr-btn--sm" aria-label="More options for ' + esc(o.title) + '">' + icon('more-vertical', 18) + '</button>';
    return '<div class="' + cls('clr-task', o.recommended && 'clr-task--rec', o.done && 'is-done', o.ghost && 'is-ghost') + '"' + (o.style ? ' style="' + o.style + '"' : '') + '><button type="button" class="clr-task__check" aria-label="Mark ' + esc(o.title) + ' done">' + icon('check', 14, 'stroke-width="3"') + '</button><div style="min-width:0">' + (o.recommended ? '<span class="clr-task__flag">' + icon('arrow-right', 13, 'stroke-width="2.5"') + 'Best fit right now</span>' : '') + '<p class="clr-task__title">' + esc(o.title) + '</p><div class="clr-task__meta">' + meta + '</div></div><div class="clr-task__side">' + side + '</div></div>';
  }
  /* Order tasks the way the engine does: easy first when load is high, hard first when low. */
  function orderTasks(tasks, load, high) {
    high = high || .7;
    var rank = load >= high ? { easy: 0, review: 1, medium: 2, hard: 3 } : load < .4 ? { hard: 0, medium: 1, review: 2, easy: 3 } : { medium: 0, hard: 1, review: 2, easy: 3 };
    return tasks.slice().sort(function (a, b) { return rank[a.difficulty] - rank[b.difficulty]; });
  }

  /* ---------- Timer ---------- */
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function SessionDots(done, total, now) {
    total = total || 4; var h = '';
    for (var i = 0; i < total; i++) h += '<i class="' + (i < done ? 'is-done' : i === done && now !== false ? 'is-now' : '') + '"></i>';
    return '<span class="clr-dots" role="img" aria-label="' + done + ' of ' + total + ' sessions done before your long break">' + h + '<span class="clr-dots__label clr-num" aria-hidden="true">' + done + ' of ' + total + '</span></span>';
  }
  var PHASE = { idle: 'Ready', work: 'Focus', short_break: 'Short break', long_break: 'Long break' };
  function Timer(o) {
    o = Object.assign({ phase: 'work', remaining: 684, total: 1500, sessions: 2, size: 280, why: true, load: .62, controls: true }, o || {});
    var brk = o.phase === 'short_break' || o.phase === 'long_break', frac = o.total ? (o.total - o.remaining) / o.total : 0, r = 92;
    var ring = '<div class="clr-timer__ring" style="width:' + o.size + 'px;height:' + o.size + 'px"><svg width="' + o.size + '" height="' + o.size + '" viewBox="0 0 200 200" aria-hidden="true"><circle class="clr-timer__track" cx="100" cy="100" r="' + r + '" fill="none" stroke-width="6"/><circle class="clr-timer__arc" cx="100" cy="100" r="' + r + '" fill="none" stroke-width="6" pathLength="100" stroke-dasharray="' + (100 * (1 - frac)).toFixed(2) + ' 100" stroke-linecap="round" transform="rotate(-90 100 100)"/></svg>' +
      '<div class="clr-timer__center"><span class="clr-timer__phase">' + icon(brk ? 'coffee' : 'timer', 16) + PHASE[o.phase] + '</span><span class="clr-timer__time clr-num" role="timer" aria-label="' + mmss(o.remaining) + ' remaining"' + (o.size < 240 ? ' style="font-size:52px;line-height:52px"' : '') + '>' + mmss(o.remaining) + '</span><span class="clr-timer__of clr-num">of ' + Math.round(o.total / 60) + ' min</span></div></div>';
    var why = o.why ? '<div class="clr-why">' + icon('info', 18) + '<span>' + (o.whyText || '<b>' + Math.round(o.total / 60) + ' min</b> because your load is ' + (o.load >= .85 ? 'showing fatigue' : o.load >= .7 ? 'high' : o.load < .4 ? 'low' : 'in your normal range') + ' (' + Math.round(o.load * 100) + '%).') + '</span></div>' : '';
    var ctr = o.controls ? '<div class="clr-timer__controls">' + Button({ label: 'Stop', icon: 'square', variant: brk ? 'rest-ghost' : 'secondary', iconOnly: true, round: true }) +
      '<button type="button" class="clr-play" style="width:64px;height:64px' + (brk ? ';background:var(--rest-accent);color:var(--rest-surface)' : '') + '" aria-label="Pause">' + icon('pause', 24) + '</button>' +
      Button({ label: 'Skip to next phase', icon: 'skip-forward', variant: brk ? 'rest-ghost' : 'secondary', iconOnly: true, round: true }) + '</div>' : '';
    return '<div class="clr-timer' + (brk ? ' clr-timer--break' : '') + '">' + ring + (o.phase === 'idle' ? '' : SessionDots(o.sessions, 4)) + ctr + why + '</div>';
  }
  function MiniPlayer(o) {
    o = Object.assign({ phase: 'work', remaining: 684, total: 1500, label: null }, o || {});
    var brk = o.phase === 'short_break' || o.phase === 'long_break', frac = (o.total - o.remaining) / o.total;
    return '<div class="clr-mini' + (brk ? ' clr-mini--break' : '') + '" role="region" aria-label="Running timer">' + MiniGauge({ load: 1 - frac, context: brk ? 'recovering' : 'deep_focus', size: 32, num: false }).replace('data-ctx="deep_focus"', 'data-tone="accent"') +
      '<span class="clr-mini__text"><span class="clr-mini__phase">' + (o.label || (brk ? PHASE[o.phase] : 'Pomodoro · Focus')) + '</span><span class="clr-mini__time clr-num">' + mmss(o.remaining) + ' left</span></span>' +
      '<button type="button" class="clr-btn clr-btn--ghost clr-btn--icon" aria-label="Pause" style="color:var(--ink)">' + icon('pause', 20) + '</button>' + (o.expand !== false ? '<button type="button" class="clr-btn clr-btn--ghost clr-btn--icon" aria-label="Open timer">' + icon('chevron-up', 20) + '</button>' : '') +
      '<span class="clr-mini__bar" style="width:' + (frac * 100).toFixed(1) + '%"></span></div>';
  }

  /* ---------- Playback ---------- */
  function PlaybackControls(o) {
    o = Object.assign({ playing: false, speed: '2×', pos: 724, dur: 2850 }, o || {});
    var f = o.pos / o.dur * 100;
    var b = function (ic, l) { return '<button type="button" class="clr-btn clr-btn--ghost clr-btn--icon" aria-label="' + l + '">' + icon(ic, 20) + '</button>'; };
    return '<div class="clr-playback"><div class="clr-scrub" role="slider" aria-label="Playback position" aria-valuetext="' + mmss(o.pos) + ' of ' + mmss(o.dur) + '" tabindex="0"><span class="clr-scrub__rail"></span><span class="clr-scrub__fill" style="width:' + f + '%"></span><span class="clr-scrub__thumb" style="left:' + f + '%"></span></div>' +
      '<div class="clr-playback__row"><div class="clr-playback__btns">' + b('skip-back', 'Jump to start') + b('chevron-left', 'Step back') +
      '<button type="button" class="clr-play" aria-label="' + (o.playing ? 'Pause' : 'Play') + '">' + icon(o.playing ? 'pause' : 'play', 22) + '</button>' + b('chevron-right', 'Step forward') + b('skip-forward', 'Jump to end') + '</div>' +
      '<span class="clr-playback__time clr-num"><b>' + mmss(o.pos) + '</b> / ' + mmss(o.dur) + '</span>' + Segmented({ options: ['1×', '2×', '5×', '10×'], value: o.speed, size: 'sm', label: 'Playback speed', num: true }) + '</div></div>';
  }

  /* ---------- Charts (static SVG mocks of the Recharts spec) ---------- */
  function LoadChart(o) {
    o = Object.assign({ w: 640, h: 220, points: series(120), thresholds: [[.7, 'High load'], [.85, 'Fatigue']], playhead: null, xLabels: ['−5 min', '−4', '−3', '−2', '−1', 'now'], area: true }, o || {});
    var L = 40, R = 8, T = 10, B = 26, W = o.w - L - R, H = o.h - T - B, n = o.points.length;
    var X = function (i) { return L + (i / (n - 1)) * W; }, Y = function (v) { return T + (1 - v) * H; };
    var g = '';
    [0, .25, .5, .75, 1].forEach(function (v) { g += '<line class="grid" x1="' + L + '" x2="' + (L + W) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>' + (v % .5 === 0 ? '<text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v * 100 + '%</text>' : ''); });
    o.thresholds.forEach(function (t) { g += '<line class="thr" x1="' + L + '" x2="' + (L + W) + '" y1="' + Y(t[0]) + '" y2="' + Y(t[0]) + '"/><text class="thr-label" x="' + (L + W) + '" y="' + (Y(t[0]) - 5) + '" text-anchor="end">' + t[1] + ' ' + Math.round(t[0] * 100) + '%</text>'; });
    var segs = [], cur = null;
    o.points.forEach(function (pt, i) { if (!cur || cur.ctx !== pt.ctx) { if (cur) cur.pts.push(i); cur = { ctx: pt.ctx, pts: cur ? [i - 1, i] : [i] }; segs.push(cur); } else cur.pts.push(i); });
    var lim = o.playhead != null ? o.playhead : n - 1;
    segs.forEach(function (s) {
      var idx = s.pts.filter(function (i) { return i <= lim; }); if (idx.length < 2) return;
      var d = idx.map(function (i, k) { return (k ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(o.points[i].v).toFixed(1); }).join('');
      if (o.area) g += '<path class="area" data-ctx="' + s.ctx + '" style="fill:var(--c-chart)" d="' + d + 'L' + X(idx[idx.length - 1]).toFixed(1) + ' ' + Y(0) + 'L' + X(idx[0]).toFixed(1) + ' ' + Y(0) + 'Z"/>';
      g += '<path class="line" data-ctx="' + s.ctx + '" style="stroke:var(--c-chart)" d="' + d + '"/>';
    });
    if (o.playhead != null) {
      g += '<path class="line" style="stroke:var(--line-strong);stroke-dasharray:2 4;opacity:.6" d="' + o.points.map(function (pt, i) { return i < lim ? '' : (i === lim ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(pt.v).toFixed(1); }).join('') + '"/>';
      g += '<line class="playhead" x1="' + X(lim) + '" x2="' + X(lim) + '" y1="' + T + '" y2="' + (T + H) + '"/><circle class="playhead-dot" cx="' + X(lim) + '" cy="' + Y(o.points[lim].v) + '" r="5"/>';
    } else {
      g += '<circle class="playhead-dot" cx="' + X(n - 1) + '" cy="' + Y(o.points[n - 1].v) + '" r="4" style="fill:var(--ink)"/>';
    }
    o.xLabels.forEach(function (t, i) { g += '<text x="' + (L + i / (o.xLabels.length - 1) * W) + '" y="' + (o.h - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === o.xLabels.length - 1 ? 'end' : 'middle') + '">' + t + '</text>'; });
    return '<div class="clr-chart" style="width:' + o.w + 'px"><svg width="' + o.w + '" height="' + o.h + '" role="img" aria-label="' + (o.aria || 'Load over time, coloured by context') + '">' + g + '</svg>' + (o.tooltip || '') + '</div>';
  }
  function BarChart(o) {
    o = Object.assign({ w: 560, h: 220, data: sample.week.map(function (x) { return { label: x.d, value: x.h }; }), max: 4, unit: 'h', best: 'Wed' }, o || {});
    var L = 34, B = 26, T = 22, W = o.w - L, H = o.h - B - T, n = o.data.length, bw = Math.min(40, W / n * .56), g = '';
    [0, 1, 2, 3, 4].forEach(function (v) { var y = T + H - v / o.max * H; g += '<line class="grid" x1="' + L + '" x2="' + o.w + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + v + o.unit + '</text>'; });
    o.data.forEach(function (d, i) {
      var cx = L + (i + .5) * W / n, bh = d.value / o.max * H, y = T + H - bh, best = d.label === o.best, r = Math.min(4, bh / 2);
      g += '<path class="bar" style="fill:' + (best ? 'var(--accent)' : 'var(--heat-2)') + '" d="M' + (cx - bw / 2) + ' ' + (T + H) + 'V' + (y + r) + 'Q' + (cx - bw / 2) + ' ' + y + ' ' + (cx - bw / 2 + r) + ' ' + y + 'H' + (cx + bw / 2 - r) + 'Q' + (cx + bw / 2) + ' ' + y + ' ' + (cx + bw / 2) + ' ' + (y + r) + 'V' + (T + H) + 'Z"><title>' + d.label + ': ' + d.value + ' ' + o.unit + '</title></path>';
      if (best) g += '<text class="best-label" x="' + cx + '" y="' + (y - 8) + '" text-anchor="middle">' + d.value + ' h · best</text>';
      g += '<text x="' + cx + '" y="' + (o.h - 6) + '" text-anchor="middle"' + (best ? ' style="fill:var(--ink);font-weight:600"' : '') + '>' + d.label + '</text>';
    });
    return '<div class="clr-chart"><svg width="' + o.w + '" height="' + o.h + '" role="img" aria-label="Daily focus time this week. Best day Wednesday, 3.4 hours.">' + g + '</svg></div>';
  }
  function StackedBars(o) {
    o = Object.assign({ w: 560, h: 220, data: sample.week }, o || {});
    var L = 34, B = 26, T = 6, W = o.w - L, H = o.h - B - T, n = o.data.length, bw = Math.min(40, W / n * .56), g = '';
    [0, .5, 1].forEach(function (v) { var y = T + H - v * H; g += '<text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + v * 100 + '%</text>'; });
    o.data.forEach(function (d, i) {
      var cx = L + (i + .5) * W / n, y = T + H;
      CTX_ORDER.forEach(function (k) {
        var v = d.dist[k] || 0; if (!v) return; var hh = v * H - 2;
        y -= v * H; g += '<rect data-ctx="' + k + '" style="fill:var(--c-chart)" x="' + (cx - bw / 2) + '" y="' + (y + 1).toFixed(1) + '" width="' + bw + '" height="' + Math.max(1, hh).toFixed(1) + '" rx="3"><title>' + d.d + ' · ' + CTX[k].label + ' ' + Math.round(v * 100) + '%</title></rect>';
      });
      g += '<text x="' + cx + '" y="' + (o.h - 6) + '" text-anchor="middle">' + d.d + '</text>';
    });
    return '<div class="clr-chart"><svg width="' + o.w + '" height="' + o.h + '" role="img" aria-label="Context mix per day this week">' + g + '</svg></div>';
  }
  function Heatmap(o) {
    o = Object.assign({ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], from: 7, to: 23, cell: 22 }, o || {});
    var r = rng(5), cols = o.to - o.from, h = '<div class="clr-heat" style="grid-template-columns:36px repeat(' + cols + ',' + o.cell + 'px)"><span></span>';
    for (var c = 0; c < cols; c++) { var hr = o.from + c; h += '<span style="text-align:center">' + (c % 3 === 0 ? (hr > 12 ? hr - 12 : hr) + (hr >= 12 ? 'p' : 'a') : '') + '</span>'; }
    o.days.forEach(function (d, di) {
      h += '<span style="align-self:center">' + d + '</span>';
      for (var c = 0; c < cols; c++) {
        var hr = o.from + c, base = (hr >= 9 && hr <= 11 ? 3.2 : hr >= 14 && hr <= 16 ? 2.2 : hr >= 20 && hr <= 22 ? 2.4 : 0.6) - (di >= 5 ? 1.4 : 0) - (di === 1 ? .8 : 0) + (di === 2 ? .7 : 0);
        var v = Math.max(0, Math.min(4, Math.round(base + (r() - .5) * 1.6)));
        var peak = di === 2 && hr === 10;
        h += '<span class="clr-heat__cell' + (peak ? ' is-peak' : '') + '" style="background:var(--heat-' + v + ')" title="' + d + ' ' + hr + ':00"></span>';
      }
    });
    h += '</div><div class="clr-heat__scale" style="margin-top:12px">Less <i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i> More focus</div>';
    return '<div role="img" aria-label="Focus by day and hour. Best: weekdays 9 to 11 am.">' + h + '</div>';
  }
  function Tooltip(o) { return '<div class="clr-tooltip clr-num" style="left:' + o.x + 'px;top:' + o.y + 'px"><span>' + esc(o.time) + '</span><b>Load ' + o.load + '%</b><span data-ctx="' + o.context + '">' + icon(CTX[o.context].icon, 12) + CTX[o.context].label + '</span></div>'; }

  /* ---------- Feedback ---------- */
  function Banner(o) {
    return '<div class="' + cls('clr-banner', o.neutral && 'clr-banner--neutral') + '" ' + (o.context ? 'data-ctx="' + o.context + '"' : o.tone ? 'data-tone="' + o.tone + '"' : '') + ' role="status">' + icon(o.icon || 'info', 20) + '<div class="clr-banner__text">' + (o.title ? '<b>' + esc(o.title) + '</b> ' : '') + (o.body ? '<span>' + esc(o.body) + '</span>' : '') + '</div>' + (o.action ? Button({ label: o.action, variant: 'ghost', size: 'sm', style: 'color:var(--ink)' }) : '') + (o.close ? '<button type="button" class="clr-btn clr-btn--ghost clr-btn--icon clr-btn--sm" aria-label="Dismiss">' + icon('x', 16) + '</button>' : '') + '</div>';
  }
  function Toast(o) {
    var c = o.context ? CTX[o.context] : null;
    return '<div class="clr-toast" role="status" ' + (o.context ? 'data-ctx="' + o.context + '"' : 'data-tone="' + (o.tone || 'accent') + '"') + '><span class="clr-toast__icon">' + icon(o.icon || (c && c.icon) || 'info', 18) + '</span><div><p class="clr-toast__title">' + esc(o.title) + '</p><p class="clr-toast__body">' + esc(o.body) + '</p>' + (o.actions ? '<div class="clr-toast__actions">' + o.actions.map(function (a, i) { return Button({ label: a, variant: 'ghost', size: 'sm', style: i === 0 ? 'color:var(--accent)' : '' }); }).join('') + '</div>' : '') + '</div><button type="button" class="clr-toast__close" aria-label="Dismiss">' + icon('x', 18) + '</button></div>';
  }
  function AndroidNotification(o) {
    return '<div class="clr-anotif"><div class="clr-anotif__head"><span class="clr-anotif__app">' + icon(o.icon || 'gauge', 12) + '</span>Cognitive Load Router · ' + esc(o.time || 'now') + '</div><p class="clr-anotif__title">' + esc(o.title) + '</p><p class="clr-anotif__body">' + esc(o.body) + '</p>' + (o.progress != null ? '<div class="clr-anotif__progress"><i style="width:' + o.progress + '%"></i></div>' : '') + (o.actions ? '<div class="clr-anotif__actions">' + o.actions.map(function (a) { return '<span>' + esc(a) + '</span>'; }).join('') + '</div>' : '') + '</div>';
  }
  function EmptyState(o) {
    return '<div class="clr-empty" ' + (o.context ? 'data-ctx="' + o.context + '"' : 'data-tone="' + (o.tone || 'accent') + '"') + (o.compact ? ' style="padding:20px 12px"' : '') + '><div class="clr-empty__art" aria-hidden="true"' + (o.compact ? ' style="width:56px;height:56px"' : '') + '><span>' + icon(o.icon || 'info', o.compact ? 24 : 30) + '</span></div><p class="clr-empty__title">' + esc(o.title) + '</p><p class="clr-empty__body">' + esc(o.body) + '</p>' + (o.actions ? '<div class="clr-empty__actions">' + o.actions.join('') + '</div>' : '') + '</div>';
  }
  function Skel(w, h, r, extra) { return '<span class="clr-skel" style="width:' + (typeof w === 'number' ? w + 'px' : w) + ';height:' + h + 'px;border-radius:' + (r == null ? 6 : r) + 'px' + (extra ? ';' + extra : '') + '" aria-hidden="true"></span>'; }

  /* ---------- Sources ---------- */
  function SourceCard(o) {
    var s = SOURCES[o.kind], st = o.state || 'idle', state;
    if (st === 'connected') state = '<div class="clr-row" style="justify-content:space-between"><span class="clr-source__status" role="status"><b aria-hidden="true"></b>Connected · last seen <span class="clr-num">' + esc(o.lastSeen || '12s') + '</span> ago</span>' + Button({ label: 'Disconnect', variant: 'ghost', size: 'sm' }) + '</div>';
    else if (st === 'waiting') state = '<div class="clr-code clr-num" aria-label="Pairing code ' + esc((o.code || 'K7Q-4M2').split('').join(' ')) + '">' + esc(o.code || 'K7Q-4M2') + '<span class="clr-row" style="gap:2px">' + Button({ label: 'Copy code', icon: 'copy', variant: 'ghost', iconOnly: true }) + Button({ label: 'Show QR code', icon: 'qr-code', variant: 'ghost', iconOnly: true }) + '</span></div><div class="clr-row" style="justify-content:space-between"><span class="clr-waiting"><span class="clr-spinner" aria-hidden="true"></span>Waiting for ' + s.label + '… code expires in <span class="clr-num">4:32</span></span>' + Button({ label: 'Cancel', variant: 'ghost', size: 'sm' }) + '</div>';
    else state = '<div>' + Button({ label: 'Connect', variant: o.primary ? 'primary' : 'secondary', size: 'sm', iconRight: 'arrow-right' }) + '</div>';
    return '<div class="clr-source' + (st === 'connected' ? ' is-connected' : '') + '"' + (o.style ? ' style="' + o.style + '"' : '') + '><span class="clr-source__icon">' + icon(s.icon, 22) + '</span><div><p class="clr-source__name">' + s.label + (o.recommended ? Badge('Recommended', 'accent') : '') + (o.optional ? '<span class="clr-caption">Optional</span>' : '') + '</p><p class="clr-source__desc">' + esc(o.desc || s.desc) + '</p></div><div class="clr-source__state">' + state + '</div></div>';
  }

  /* ---------- Slider ---------- */
  function Slider(o) {
    o = Object.assign({ min: 0, max: 100, unit: '', step: 1 }, o);
    var f = function (v) { return ((v - o.min) / (o.max - o.min) * 100).toFixed(2) + '%'; };
    var changed = o.value !== o.def;
    var blocked = o.blockBelow != null ? '<span class="clr-slider__blocked" style="left:0;width:' + f(o.blockBelow) + '"></span>' : '';
    return '<div class="clr-slider"><div class="clr-slider__top"><span class="clr-slider__label">' + esc(o.label) + '</span><span class="clr-slider__value clr-num">' + o.value + esc(o.unit) + '</span></div>' +
      '<div class="clr-slider__track" role="slider" tabindex="0" aria-label="' + esc(o.label) + '" aria-valuemin="' + o.min + '" aria-valuemax="' + o.max + '" aria-valuenow="' + o.value + '" aria-valuetext="' + o.value + esc(o.unit) + '"><span class="clr-slider__rail"></span><span class="clr-slider__fill" style="width:' + f(o.value) + '"></span>' + blocked + '<span class="clr-slider__default" style="left:' + f(o.def) + '" title="Default"></span><span class="clr-slider__thumb" style="left:' + f(o.value) + '"></span></div>' +
      '<div class="clr-slider__scale clr-num"><span>' + o.min + esc(o.unit) + '</span><span>' + o.max + esc(o.unit) + '</span></div>' +
      '<div class="clr-slider__foot"><span>' + (o.help ? esc(o.help) + ' ' : '') + '<span class="clr-subtle clr-num">Default ' + o.def + esc(o.unit) + '</span></span>' + (changed ? '<button type="button" class="clr-link">Reset to default</button>' : '') + '</div></div>';
  }

  /* ---------- Navigation ---------- */
  var NAV = [['now', 'Now', 'gauge'], ['focus', 'Focus', 'timer'], ['tasks', 'Tasks', 'list-checks'], ['history', 'History', 'history'], ['insights', 'Insights', 'bar-chart'], ['settings', 'Settings', 'settings']];
  function Sidebar(o) {
    o = Object.assign({}, o || {});
    o.active = o.active || 'now'; o.state = o.state || sample.state; o.status = o.status || 'live';
    var s = o.state, c = CTX[s.context], off = o.status !== 'live';
    var live = o.status === 'nodata' ? '<div class="clr-livecard" data-ctx="unknown">' + MiniGauge({ load: 0, context: 'unknown', size: 44, num: false }) + '<div class="clr-livecard__text"><span class="clr-livecard__ctx" style="color:var(--ink-muted)">No data yet</span><span class="clr-livecard__meta">Connect a source to start</span></div></div>' :
      '<div class="clr-livecard" data-ctx="' + s.context + '"' + (off ? ' style="opacity:.6"' : '') + '>' + MiniGauge({ load: s.load, context: s.context, size: 44, confidence: s.confidence }) + '<div class="clr-livecard__text"><span class="clr-livecard__ctx">' + icon(c.icon, 16) + c.label + '</span><span class="clr-livecard__meta">' + (off ? icon('wifi-off', 12) + (o.status === 'reconnecting' ? 'Reconnecting…' : 'Offline · last 9:58 pm') : '<b aria-hidden="true"></b>Live · 2 sources') + '</span></div></div>';
    return '<aside class="clr-sidebar" aria-label="Main"><div class="clr-brand">' + Logo(28) + 'Cognitive Load Router</div>' + live +
      '<nav class="clr-nav">' + NAV.map(function (n) { return '<a href="#" ' + (n[0] === o.active ? 'aria-current="page"' : '') + '>' + icon(n[2], 20) + n[1] + (n[0] === 'tasks' ? '<span class="clr-nav__count clr-num">4</span>' : '') + '</a>'; }).join('') + '</nav>' +
      '<div class="clr-sidebar__foot">' + (o.timer ? MiniPlayer(Object.assign({ expand: false }, o.timer)) : '') + '<div class="clr-account"><span class="clr-avatar">SR</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">sam@uni.edu</span><button type="button" class="clr-btn clr-btn--ghost clr-btn--icon clr-btn--sm" aria-label="Switch to light theme">' + icon('sun', 18) + '</button></div></div></aside>';
  }
  function TopBar(o) {
    return '<header class="clr-topbar"><div class="clr-topbar__title"><h1>' + esc(o.title) + '</h1>' + (o.sub ? '<p>' + o.sub + '</p>' : '') + '</div><div class="clr-topbar__actions">' + (o.actions != null ? o.actions : ConnectionStatus({ status: o.status || 'live' }) + Button({ label: 'Do Not Disturb', icon: 'bell-off', variant: 'ghost', iconOnly: true }) + Button({ label: 'Start focus', icon: 'timer', variant: 'primary' })) + '</div></header>';
  }
  var TABS = [['now', 'Now', 'gauge'], ['focus', 'Focus', 'timer'], ['tasks', 'Tasks', 'list-checks'], ['insights', 'Insights', 'bar-chart'], ['more', 'More', 'menu']];
  function TabBar(o) {
    var a = (o && o.active) || 'now';
    return '<nav class="clr-tabbar" aria-label="Main">' + TABS.map(function (t) { return '<a href="#" ' + (t[0] === a ? 'aria-current="page"' : '') + '><span class="clr-tabbar__pill">' + icon(t[2], 22) + '</span>' + t[1] + '</a>'; }).join('') + '</nav>';
  }
  function MobileTopBar(o) {
    o = o || {};
    var right = o.right != null ? o.right : (o.state === false ? '' : LoadPill(o.state || sample.state)) + Button({ label: 'Notifications', icon: 'bell', variant: 'ghost', iconOnly: true });
    return '<header class="clr-mtop' + (o.back ? ' clr-mtop--back' : '') + '">' + (o.back ? Button({ label: 'Back', icon: 'arrow-left', variant: 'ghost', iconOnly: true, style: 'color:var(--ink)' }) : '') + '<h1>' + esc(o.title || 'Now') + '</h1>' + right + '</header>';
  }
  function BottomSheet(o) {
    return '<div class="clr-sheet" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"' + (o.style ? ' style="' + o.style + '"' : '') + '><span class="clr-sheet__grab" aria-hidden="true"></span><div class="clr-sheet__head"><h2 class="clr-h2">' + esc(o.title) + '</h2>' + Button({ label: 'Close', icon: 'x', variant: 'ghost', iconOnly: true }) + '</div>' + o.body + (o.actions ? '<div class="clr-sheet__actions">' + o.actions + '</div>' : '') + '</div>';
  }

  /* ---------- Frames for screen mocks ---------- */
  function Phone(o) {
    o = o || {};
    var status = '<div class="clr-phone__status clr-num"' + (o.statusBg ? ' style="background:' + o.statusBg + ';color:' + (o.statusInk || 'var(--ink)') + '"' : '') + '><span>9:41</span><span>' + icon('signal', 14) + icon('wifi', 14) + icon('battery', 16) + '</span></div>';
    var top = o.notop ? '' : '<div class="clr-phone__top">' + (o.top || MobileTopBar({ title: o.title, state: o.state, back: o.back, right: o.right })) + '</div>';
    var nav = o.nonav ? '<div class="clr-phone__nav" style="background:' + (o.gestureBg || 'var(--bg)') + '"><div class="clr-phone__gesture" style="background:transparent"><i></i></div></div>' : '<div class="clr-phone__nav">' + TabBar({ active: o.tab }) + '<div class="clr-phone__gesture"><i></i></div></div>';
    var body = '<div class="' + cls('clr-phone__body', o.notop && 'clr-phone__body--notop', o.nonav && 'clr-phone__body--nonav') + '"' + (o.bodyStyle ? ' style="' + o.bodyStyle + '"' : '') + '><div class="clr-phone__scroll" style="' + (o.scroll ? 'transform:translateY(-' + o.scroll + 'px);' : '') + (o.pad === false ? 'padding:0;' : '') + (o.mini && !o.nonav ? 'padding-bottom:80px;' : '') + '">' + (o.content || '') + '</div></div>';
    return '<div class="clr-phone"' + (o.style ? ' style="' + o.style + '"' : '') + '>' + status + top + body + (o.mini ? '<div class="clr-phone__mini">' + MiniPlayer(o.mini === true ? {} : o.mini) + '</div>' : '') + nav + (o.overlay ? '<div class="clr-phone__overlay">' + o.overlay + '</div>' : '') + (o.toast ? '<div class="clr-phone__toast">' + o.toast + '</div>' : '') + '</div>';
  }
  function Desk(o) {
    o = o || {};
    if (o.bare) return '<div class="clr-desk clr-desk--bare"' + (o.style ? ' style="' + o.style + '"' : '') + '>' + o.content + (o.overlay || '') + '</div>';
    return '<div class="clr-desk">' + Sidebar({ active: o.active, timer: o.timer, status: o.status, state: o.state }) + '<div class="clr-desk__main">' + (o.top || TopBar({ title: o.title, sub: o.sub, actions: o.actions, status: o.status })) + '<div class="clr-desk__content"' + (o.contentStyle ? ' style="' + o.contentStyle + '"' : '') + '>' + o.content + '</div></div>' + (o.toast ? '<div class="clr-desk__toast">' + o.toast + '</div>' : '') + (o.overlay || '') + '</div>';
  }
  function Board(o) {
    var h = '<div class="clr-board" style="width:' + (o.width || 1520) + 'px">';
    (o.sections || []).forEach(function (s) {
      h += '<section><p class="clr-board__label"><b>' + esc(s.title) + '</b>' + esc(s.note || '') + '</p>' + (s.phones ? '<div class="clr-board__phones">' + s.phones.join('') + '</div>' : s.html) + '</section>';
    });
    return h + '</div>';
  }

  /* ---------- Live behaviour ---------- */
  function tween(el, from, to, ms, prefix) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !ms) { el.textContent = (prefix || '') + to; return; }
    var t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (prefix || '') + Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function mountGauge(el, s) {
    el.innerHTML = LoadGauge(s);
    var cur = Object.assign({}, s);
    return {
      update: function (n) {
        var root = el.querySelector('.clr-gauge'), d = arc(n.load), unc = n.confidence < .5;
        root.setAttribute('data-ctx', n.context);
        root.classList.toggle('is-uncertain', unc);
        root.setAttribute('aria-label', gaugeLabel(n));
        ['.clr-gauge__arc', '.clr-gauge__halo', '.clr-gauge__mask'].forEach(function (q) { el.querySelector(q).style.strokeDasharray = d; });
        tween(el.querySelector('[data-num]'), Math.round(cur.load * 100), Math.round(n.load * 100), 600, unc ? '≈' : '');
        el.querySelector('.clr-gauge__cap').textContent = unc ? 'rough estimate' : 'load';
        if (n.context !== cur.context || unc !== (cur.confidence < .5)) el.querySelector('[data-foot]').innerHTML = ContextPill({ context: n.context, size: (s.size || 280) < 220 ? 'sm' : null, uncertain: unc });
        cur = Object.assign({}, n);
      }
    };
  }
  /* A gentle random walk around a base state, ticking every 2 s like the WebSocket. */
  function simulate(cb, o) {
    o = Object.assign({ base: sample.state, interval: 2000, cycle: null }, o || {});
    var s = JSON.parse(JSON.stringify(o.base)), r = rng(3), tick = 0;
    return setInterval(function () {
      tick++;
      if (o.cycle && tick % o.cycle.every === 0) { var nx = o.cycle.states[(tick / o.cycle.every) % o.cycle.states.length]; s = Object.assign(s, JSON.parse(JSON.stringify(nx))); }
      else { s.load = Math.max(.05, Math.min(.98, s.load + (r() - .5) * .06)); ['intrinsic', 'extraneous', 'germane'].forEach(function (k) { s.breakdown[k] = Math.max(.05, Math.min(.95, s.breakdown[k] + (r() - .5) * .05)); }); }
      cb(JSON.parse(JSON.stringify(s)));
    }, o.interval);
  }


  /* ---------- Now-screen sections (compositions used by the screen mocks) ---------- */
  function HeroCard(o) {
    o = Object.assign({}, sample.state, { size: 260 }, o || {}); var c = CTX[o.context];
    return '<div class="clr-card clr-hero" data-ctx="' + o.context + '"' + (o.style ? ' style="' + o.style + '"' : '') + '>' + LoadGauge({ load: o.load, context: o.context, confidence: o.confidence, size: o.size }) +
      '<div class="clr-stack" style="gap:14px;min-width:0"><div class="clr-hero__ctx"><p class="clr-overline">Right now</p><h2>' + icon(c.icon, 24) + c.label + '</h2><p class="clr-p clr-muted">' + c.blurb + '</p>' + Confidence(o.confidence) + '</div><hr class="clr-divider" style="margin:2px 0">' + Breakdown(Object.assign({ compact: o.compact }, o.breakdown)) + '</div></div>';
  }
  function HeroMobile(o) {
    o = Object.assign({}, sample.state, o || {}); var c = CTX[o.context];
    return '<div class="clr-card" data-ctx="' + o.context + '" style="display:grid;justify-items:center;gap:12px;text-align:center;padding:20px 16px">' + LoadGauge({ load: o.load, context: o.context, confidence: o.confidence, size: 236 }) +
      '<p class="clr-p clr-muted" style="max-width:300px">' + c.blurb + '</p>' + Confidence(o.confidence) + (o.sources !== false ? '<div style="margin-top:4px">' + ConnectionStatus({ status: o.status || 'live', sources: ['browser', 'vscode', 'lms'], on: ['browser', 'vscode'] }) + '</div>' : '') + '</div>';
  }
  function QuickActions(o) {
    o = o || {};
    var items = [['Start focus', 'Block distractions for 50 min', 'shield', 'accent', ''], ['Start Pomodoro', '25 min, sized to your load', 'timer', 'accent', ''], ['Do Not Disturb', o.dnd ? 'On until you turn it off' : 'Silence notifications', 'bell-off', 'accent', Toggle({ on: !!o.dnd, label: 'Do Not Disturb' })]];
    if (o.grid) return '<div class="clr-qgrid">' + items.map(function (x) { return '<button type="button" class="clr-quick__btn" data-tone="' + x[3] + '"><span>' + icon(x[2], 20) + '</span><b>' + x[0] + '</b></button>'; }).join('') + '</div>';
    return '<div class="clr-card"><div class="clr-card__head"><h3 class="clr-card__title">Quick actions</h3></div><div class="clr-quick">' + items.map(function (x) {
      return '<div class="clr-quick__btn" data-tone="' + x[3] + '" role="group"><span>' + icon(x[2], 20) + '</span><span style="flex:1"><b>' + x[0] + '</b><small>' + x[1] + '</small></span>' + (x[4] || icon('chevron-right', 18, 'style="color:var(--ink-subtle)"')) + '</div>';
    }).join('') + '</div></div>';
  }
  function UpNext(o) {
    o = o || {}; var t = o.task || sample.tasks[1];
    return '<div class="clr-card"><div class="clr-card__head"><h3 class="clr-card__title">Up next</h3><a class="clr-link" href="#" style="font-size:14px">All tasks</a></div><div class="clr-tasks">' + TaskRow(Object.assign({ recommended: true }, t)) + '</div><p class="clr-p clr-body-sm clr-subtle" style="margin-top:10px">' + (o.why || 'Medium work suits a steady 62%. Hard tasks stay on deck for a lower-load window.') + '</p></div>';
  }
  function TodayCard(o) {
    o = o || {}; var t = sample.today;
    return '<div class="clr-card"><div class="clr-card__head"><h3 class="clr-card__title">Today at a glance</h3><span class="clr-card__meta">Since 6:10 pm</span></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">' +
      StatTile({ plain: true, label: 'Focus', icon: 'timer', value: '1<small>h</small> 48<small>m</small>' }) + StatTile({ plain: true, label: 'Avg load', icon: 'gauge', value: '54', unit: '%' }) + StatTile({ plain: true, label: 'Sessions', icon: 'history', value: '3' }) + '</div>' + ContextBar({ dist: t.dist, legend: o.legend }) + '</div>';
  }
  var api = {
    icon: icon, Logo: Logo, esc: esc, CTX: CTX, CTX_ORDER: CTX_ORDER, DIRECTIVES: DIRECTIVES, DIFF: DIFF, BREAKDOWN: BREAKDOWN, SOURCES: SOURCES, sample: sample, series: series, rng: rng, mmss: mmss, orderTasks: orderTasks,
    Button: Button, ContextPill: ContextPill, Badge: Badge, Tag: Tag, DifficultyChip: DifficultyChip, Toggle: Toggle, TextField: TextField, Segmented: Segmented, SegmentedControl: Segmented, FilterChip: FilterChip,
    LoadGauge: LoadGauge, MiniGauge: MiniGauge, LoadPill: LoadPill, Confidence: Confidence, Breakdown: Breakdown, ConnectionStatus: ConnectionStatus,
    StatTile: StatTile, ContextBar: ContextBar, DirectiveCard: DirectiveCard, DirectivesFeed: DirectivesFeed, TaskRow: TaskRow,
    Timer: Timer, SessionDots: SessionDots, MiniPlayer: MiniPlayer, PlaybackControls: PlaybackControls,
    LoadChart: LoadChart, BarChart: BarChart, StackedBars: StackedBars, Heatmap: Heatmap, Tooltip: Tooltip, ChartStyle: LoadChart,
    Banner: Banner, Toast: Toast, AndroidNotification: AndroidNotification, EmptyState: EmptyState, Skel: Skel, Skeleton: Skel, SourceCard: SourceCard, Slider: Slider,
    Sidebar: Sidebar, TopBar: TopBar, TabBar: TabBar, MobileTopBar: MobileTopBar, BottomSheet: BottomSheet, Phone: Phone, Desk: Desk, Board: Board,
    HeroCard: HeroCard, HeroMobile: HeroMobile, QuickActions: QuickActions, UpNext: UpNext, TodayCard: TodayCard,
    mountGauge: mountGauge, simulate: simulate, tween: tween
  };
  window.CLR = Object.assign(window.CLR || {}, api);
})();
