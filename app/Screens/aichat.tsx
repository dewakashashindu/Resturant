import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { apiClient, ChartDataPoint, ReportResponse } from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
type UserMsg    = { id: string; type: 'user';    text: string };
type LoadingMsg = { id: string; type: 'loading'; phase: string; elapsed: number };
type ErrorMsg   = { id: string; type: 'error';   text: string };
type ResultMsg  = { id: string; type: 'result';  data: ReportResponse & { _q: string } };
type Msg = UserMsg | LoadingMsg | ErrorMsg | ResultMsg;

// ─── COLORS ───────────────────────────────────────────────────────────────────
const CHART_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  HIGH:   { bg: '#fef2f2', text: '#dc2626', label: 'High' },
  MEDIUM: { bg: '#fffbeb', text: '#d97706', label: 'Medium' },
  LOW:    { bg: '#f0fdf4', text: '#16a34a', label: 'Low' },
};

const TREND_ICON: Record<string, string> = {
  up:      '▲',
  down:    '▼',
  neutral: '─',
};
const TREND_COLOR: Record<string, string> = {
  up:      '#16a34a',
  down:    '#dc2626',
  neutral: '#64748b',
};

// ─── CURRENCY FORMATTER ───────────────────────────────────────────────────────
const fmtLKR = (v: number) =>
  'Rs. ' + Math.round(v).toLocaleString('en-LK');

// ─── SCORE RING ───────────────────────────────────────────────────────────────
function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  return (
    <View style={s.scoreWrap}>
      <View style={[s.scoreRing, { borderColor: color }]}>
        <Text style={[s.scoreNum, { color }]}>{score}</Text>
        <Text style={s.scoreOutOf}>/100</Text>
      </View>
      <Text style={[s.scoreLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─── KEY METRICS ROW ──────────────────────────────────────────────────────────
function MetricCard({ label, value, trend, trendNote }: {
  label: string; value: string; trend: string; trendNote: string;
}) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={[s.metricTrend, { color: TREND_COLOR[trend] || '#64748b' }]}>
        {TREND_ICON[trend] || '─'} {trendNote}
      </Text>
    </View>
  );
}

// ─── CHART ────────────────────────────────────────────────────────────────────
function DynamicChart({ data, type, title }: { data: ChartDataPoint[]; type: string; title: string }) {
  if (!data?.length) return null;
  const max   = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((a, b) => a + b.value, 0) || 1;

  const isPie = type === 'PIE' || (data.length <= 4 && type !== 'LINE' && type !== 'BAR');

  return (
    <View style={s.chartBox}>
      <Text style={s.chartTitle}>📊 {title}</Text>
      {isPie ? (
        <View style={{ gap: 6 }}>
          <View style={s.pieBar}>
            {data.map((d, i) => (
              <View key={i} style={{ flex: d.value / total, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            ))}
          </View>
          {data.map((d, i) => (
            <View key={i} style={s.pieLegendRow}>
              <View style={[s.pieDot, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
              <Text style={s.chartLabel} numberOfLines={1}>{d.label}</Text>
              <Text style={s.chartVal}>
                {((d.value / total) * 100).toFixed(1)}%  ·  {fmtLKR(d.value)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 7 }}>
          {data.map((d, i) => (
            <View key={i}>
              <View style={s.barLabelRow}>
                <Text style={s.chartLabel} numberOfLines={1}>{d.label}</Text>
                <Text style={s.chartVal}>{fmtLKR(d.value)}</Text>
              </View>
              <View style={s.barTrack}>
                <View style={[s.barFill, {
                  width: `${(d.value / max) * 100}%` as any,
                  backgroundColor: type === 'LINE'
                    ? CHART_COLORS[0]
                    : CHART_COLORS[i % CHART_COLORS.length]
                }]} />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── HIGHLIGHT CARD ───────────────────────────────────────────────────────────
function HighlightCard({ icon, title, detail, type }: {
  icon: string; title: string; detail: string; type: string;
}) {
  const borderColor = type === 'positive' ? '#86efac' : type === 'critical' ? '#fca5a5' : '#fde68a';
  const bgColor     = type === 'positive' ? '#f0fdf4' : type === 'critical' ? '#fef2f2' : '#fffbeb';
  return (
    <View style={[s.highlightCard, { borderLeftColor: borderColor, backgroundColor: bgColor }]}>
      <Text style={s.highlightIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.highlightTitle}>{title}</Text>
        <Text style={s.highlightDetail}>{detail}</Text>
      </View>
    </View>
  );
}

// ─── SUGGESTION CARD ──────────────────────────────────────────────────────────
function SuggestionCard({ priority, action, why, impact }: {
  priority: string; action: string; why: string; impact: string;
}) {
  const pStyle = PRIORITY_STYLE[priority] || PRIORITY_STYLE.LOW;
  return (
    <View style={s.suggCard}>
      <View style={s.suggHeader}>
        <View style={[s.priorityBadge, { backgroundColor: pStyle.bg }]}>
          <Text style={[s.priorityText, { color: pStyle.text }]}>{pStyle.label}</Text>
        </View>
        <Text style={s.suggAction}>{action}</Text>
      </View>
      <Text style={s.suggWhy}>{why}</Text>
      <Text style={s.suggImpact}>💡 {impact}</Text>
    </View>
  );
}

// ─── NEXT-BEST-ACTION CHIPS ───────────────────────────────────────────────────
function NBAStrip({ actions, onTap }: { actions: string[]; onTap: (q: string) => void }) {
  if (!actions?.length) return null;
  return (
    <View style={s.nbaWrap}>
      <Text style={s.nbaLabel}>ASK NEXT</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
          {actions.map((a, i) => (
            <TouchableOpacity key={i} style={s.nbaChip} onPress={() => onTap(a)}>
              <Text style={s.nbaChipTxt}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── FULL RESULT COMPONENT ────────────────────────────────────────────────────
function DeepResult({ data, onNBA }: { data: ReportResponse & { _q: string }; onNBA: (q: string) => void }) {
  const { analysis } = data;
  if (!analysis) return (
    <View style={s.resultBox}>
      <Text style={s.directAnswer}>No analysis available.</Text>
    </View>
  );

  const {
    directAnswer, performanceScore, scoreLabel,
    keyMetrics, chartData, highlights, suggestions,
    nextActions,
  } = analysis;

  const hasChart       = chartData && chartData.type !== 'NONE' && chartData.data?.length > 0;
  const hasMetrics     = keyMetrics?.length > 0;
  const hasHighlights  = highlights?.length > 0;
  const hasSuggestions = suggestions?.length > 0;

  return (
    <View style={s.resultBox}>

      {/* Score + Direct Answer */}
      <View style={s.topRow}>
        {performanceScore != null && scoreLabel ? (
          <>
            <ScoreRing score={performanceScore} label={scoreLabel} />
            <View style={{ flex: 1 }}>
              <Text style={s.directAnswer}>{directAnswer}</Text>
            </View>
          </>
        ) : (
          <Text style={s.directAnswer}>{directAnswer}</Text>
        )}
      </View>

      {/* Fallback date notice */}
      {(data as any).isFallbackDate && (data as any).dataDate && (data as any).dataDate !== 'unknown' && (
        <View style={s.fallbackNotice}>
          <Text style={s.fallbackTxt}>📅 Showing data from {(data as any).dataDate} (no data for today)</Text>
        </View>
      )}

      {/* Key Metrics */}
      {hasMetrics && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>KEY METRICS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
              {keyMetrics.map((m, i) => (
                <MetricCard key={i} label={m.label} value={m.value} trend={m.trend} trendNote={m.trendNote} />
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Chart */}
      {hasChart && (
        <View style={s.section}>
          <DynamicChart data={chartData.data} type={chartData.type} title={chartData.title} />
        </View>
      )}

      {/* Highlights */}
      {hasHighlights && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>ANALYSIS</Text>
          <View style={{ gap: 8 }}>
            {highlights.map((h, i) => (
              <HighlightCard key={i} icon={h.icon} title={h.title} detail={h.detail} type={h.type} />
            ))}
          </View>
        </View>
      )}

      {/* Suggestions */}
      {hasSuggestions && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>SUGGESTIONS</Text>
          <View style={{ gap: 8 }}>
            {suggestions.map((sg, i) => (
              <SuggestionCard key={i} priority={sg.priority} action={sg.action} why={sg.why} impact={sg.impact} />
            ))}
          </View>
        </View>
      )}

      {/* Next-Best-Action */}
      {nextActions?.length > 0 && (
        <View style={s.section}>
          <NBAStrip actions={nextActions} onTap={onNBA} />
        </View>
      )}

    </View>
  );
}

// ─── LOADING CARD ─────────────────────────────────────────────────────────────
function LoadingCard({ phase, elapsed }: { phase: string; elapsed: number }) {
  return (
    <View style={s.loadingBubble}>
      <ActivityIndicator size="small" color="#2563eb" />
      <Text style={s.loadingTxt}>{phase}</Text>
      <Text style={s.loadingElapsed}>{elapsed}s</Text>
    </View>
  );
}

// ─── MIC ICON SVG-STYLE (pure RN) ────────────────────────────────────────────
function MicIcon({ active }: { active: boolean }) {
  return (
    <View style={[micS.wrapper, active && micS.wrapperActive]}>
      <View style={[micS.body, active && micS.bodyActive]} />
      <View style={[micS.neck, active && micS.neckActive]} />
      <View style={[micS.stand, active && micS.standActive]} />
      <View style={[micS.base, active && micS.baseActive]} />
      {active && (
        <>
          <View style={micS.ring1} />
          <View style={micS.ring2} />
        </>
      )}
    </View>
  );
}

const micS = StyleSheet.create({
  wrapper:      { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  wrapperActive: {},
  body:         { width: 8, height: 11, borderRadius: 4, backgroundColor: '#64748b', position: 'absolute', top: 0 },
  bodyActive:   { backgroundColor: '#fff' },
  neck:         { width: 12, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 2, borderColor: '#64748b', borderBottomWidth: 0, position: 'absolute', top: 9, backgroundColor: 'transparent' },
  neckActive:   { borderColor: '#fff' },
  stand:        { width: 2, height: 4, backgroundColor: '#64748b', position: 'absolute', top: 15 },
  standActive:  { backgroundColor: '#fff' },
  base:         { width: 8, height: 2, borderRadius: 1, backgroundColor: '#64748b', position: 'absolute', top: 19 },
  baseActive:   { backgroundColor: '#fff' },
  ring1:        { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', top: 2 },
  ring2:        { position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', top: -1, left: -1 },
});

// ─── SEND ICON ────────────────────────────────────────────────────────────────
function SendIcon() {
  return (
    <View style={sendS.wrapper}>
      <View style={sendS.arrowHead} />
      <View style={sendS.shaft} />
    </View>
  );
}

const sendS = StyleSheet.create({
  wrapper:   { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  arrowHead: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderLeftColor: 'transparent',
    borderRightWidth: 6, borderRightColor: 'transparent',
    borderBottomWidth: 9, borderBottomColor: '#fff',
    marginBottom: -1,
  },
  shaft: { width: 3, height: 10, backgroundColor: '#fff', borderRadius: 1.5 },
});

// ─── VOICE HOOK ───────────────────────────────────────────────────────────────
function useVoice(onResult: (t: string) => void) {
  const [listening, setListening] = useState(false);
  useSpeechRecognitionEvent('start',  () => setListening(true));
  useSpeechRecognitionEvent('end',    () => setListening(false));
  useSpeechRecognitionEvent('error',  () => setListening(false));
  useSpeechRecognitionEvent('result', e => {
    if (e.results[0]?.transcript) onResult(e.results[0].transcript);
  });
  const start = async () => {
    const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!p.granted) { alert('Microphone permission needed'); return; }
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false });
  };
  const stop = () => ExpoSpeechRecognitionModule.stop();
  return { listening, start, stop };
}

// ─── QUICK PROMPTS ────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: '📊 Status',     q: 'How is my restaurant doing today?' },
  { label: '💰 Revenue',    q: "What is today's total revenue?" },
  { label: '🍽️ Top Items',  q: 'What are the top selling items today?' },
  { label: '⏰ Busy Hours', q: 'Show me the hourly sales trend today' },
];

// ─── LOADING PHASES ───────────────────────────────────────────────────────────
const PHASES = ['Generating query...', 'Fetching data...', 'Analyzing deeply...', 'Building insights...'];

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function AiChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText]  = useState('');
  const [busy, setBusy]  = useState(false);
  const scrollRef        = useRef<ScrollView>(null);

  const uid = () => Date.now().toString() + Math.random();

  const push = (m: Omit<UserMsg, 'id'> | Omit<LoadingMsg, 'id'> | Omit<ErrorMsg, 'id'> | Omit<ResultMsg, 'id'>) => {
    const id = uid();
    setMsgs(p => [...p, { ...m, id } as Msg]);
    return id;
  };

  const patch = (id: string, updates: Record<string, unknown>) =>
    setMsgs(p => p.map(m => m.id === id ? { ...m, ...updates } as Msg : m));

  const handleContentSizeChange = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const ask = async (q?: string) => {
    const query = (q ?? text).trim();
    if (!query || busy) return;
    setText('');
    setBusy(true);

    push({ type: 'user', text: query });
    const lid = push({ type: 'loading', phase: PHASES[0], elapsed: 0 });

    let pi = 0;
    const phaseTimer = setInterval(() => {
      if (pi < PHASES.length - 1) patch(lid, { phase: PHASES[++pi] });
      else patch(lid, { phase: PHASES[PHASES.length - 1] });
    }, 1800);

    let secs = 0;
    const elapsedTimer = setInterval(() => {
      patch(lid, { elapsed: ++secs });
    }, 1000);

    try {
      const res = await apiClient.fetchAIReport(query);
      clearInterval(phaseTimer);
      clearInterval(elapsedTimer);
      patch(lid, { type: 'result', data: { ...res, _q: query } });
    } catch (e: unknown) {
      clearInterval(phaseTimer);
      clearInterval(elapsedTimer);
      patch(lid, { type: 'error', text: e instanceof Error ? e.message : 'Something went wrong' });
    } finally {
      setBusy(false);
    }
  };

  const { listening, start: startVoice, stop: stopVoice } = useVoice(t => {
    setText(t);
    ask(t);
  });

  const canSend = !!text.trim() && !busy;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />

      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Restaurant AI</Text>
          <Text style={s.subtitle}>Ask anything about your sales</Text>
        </View>
        {msgs.length > 0 && (
          <TouchableOpacity onPress={() => setMsgs([])} style={s.clearBtn}>
            <Text style={s.clearTxt}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: 20 }}
        onContentSizeChange={handleContentSizeChange}
        keyboardShouldPersistTaps="handled"
      >
        {/* EMPTY STATE */}
        {msgs.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>🍽️</Text>
            <Text style={s.emptyTitle}>Ask your AI analyst</Text>
            <Text style={s.emptyHint}>Type, speak, or tap a quick question below</Text>
            <View style={s.quickGrid}>
              {QUICK_PROMPTS.map((qp, i) => (
                <TouchableOpacity key={i} style={s.quickBtn} onPress={() => ask(qp.q)}>
                  <Text style={s.quickBtnTxt}>{qp.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* MESSAGES */}
        {msgs.map(m => {
          if (m.type === 'user') return (
            <View key={m.id} style={s.userBubble}>
              <Text style={s.userTxt}>{m.text}</Text>
            </View>
          );
          if (m.type === 'loading') return (
            <LoadingCard key={m.id} phase={m.phase} elapsed={m.elapsed} />
          );
          if (m.type === 'error') return (
            <View key={m.id} style={s.errorBubble}>
              <Text style={s.errorTxt}>⚠ {m.text}</Text>
            </View>
          );
          if (m.type === 'result') return (
            <View key={m.id} style={s.aiWrap}>
              <DeepResult data={m.data} onNBA={(q) => ask(q)} />
            </View>
          );
          return null;
        })}
      </ScrollView>

      {/* INPUT DOCK */}
      <View style={s.dock}>

        {/* MIC BUTTON */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[s.micBtn, listening && s.micBtnActive]}
          onPress={listening ? stopVoice : startVoice}
        >
          {listening && <View style={s.micGlowRing} />}
          <View style={s.micIconWrap}>
            <MicIcon active={listening} />
          </View>
          {listening && (
            <View style={s.liveTag}>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>LIVE</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* TEXT INPUT */}
        <TextInput
          style={[s.input, listening && s.inputListening]}
          placeholder={listening ? 'Listening...' : 'Ask about your restaurant...'}
          placeholderTextColor={listening ? '#dc2626' : '#94a3b8'}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => ask()}
          returnKeyType="send"
          multiline
          editable={!listening}
        />

        {/* SEND BUTTON */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[s.sendBtn, !canSend && s.sendBtnDisabled]}
          onPress={() => ask()}
          disabled={!canSend}
        >
          <View style={s.sendShine} />
          {busy
            ? <ActivityIndicator color="#fff" size="small" />
            : <SendIcon />
          }
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // Header
  header: {
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderColor: '#e2e8f0',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  title:    { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f1f5f9', borderRadius: 8 },
  clearTxt: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  scroll: { flex: 1, paddingHorizontal: 14, paddingTop: 14 },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyEmoji: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  emptyHint:  { fontSize: 13, color: '#64748b', textAlign: 'center' },
  quickGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 16 },
  quickBtn:   {
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  quickBtnTxt: { fontSize: 13, fontWeight: '600', color: '#1e293b' },

  // Messages
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderRadius: 16, borderBottomRightRadius: 3,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 12, maxWidth: '82%',
  },
  userTxt: { color: '#fff', fontSize: 14, lineHeight: 20 },

  loadingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  loadingTxt:     { fontSize: 13, color: '#64748b', flex: 1 },
  loadingElapsed: { fontSize: 12, color: '#94a3b8', fontVariant: ['tabular-nums'] },

  errorBubble: {
    backgroundColor: '#fef2f2', borderRadius: 12,
    padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#fecaca',
  },
  errorTxt: { color: '#dc2626', fontSize: 13 },

  aiWrap: { marginBottom: 12 },

  // Result box
  resultBox: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#e2e8f0',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 4 },

  // Fallback
  fallbackNotice: {
    marginTop: 8, backgroundColor: '#fffbeb',
    borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: '#fde68a',
  },
  fallbackTxt: { fontSize: 12, color: '#92400e' },

  // Score ring
  scoreWrap:  { alignItems: 'center', gap: 4 },
  scoreRing:  { width: 64, height: 64, borderRadius: 32, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreNum:   { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  scoreOutOf: { fontSize: 9, color: '#94a3b8', marginTop: -2 },
  scoreLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  directAnswer: { fontSize: 14, fontWeight: '500', color: '#0f172a', lineHeight: 22, flex: 1 },

  section:      { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: '#f1f5f9' },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 10 },

  // Metrics
  metricCard:  { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, minWidth: 110, borderWidth: 1, borderColor: '#e2e8f0' },
  metricLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  metricValue: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  metricTrend: { fontSize: 11, fontWeight: '500' },

  // Chart
  chartBox:    { gap: 4 },
  chartTitle:  { fontSize: 11, fontWeight: '700', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  pieBar:      { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', height: 14, marginBottom: 8 },
  pieLegendRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  pieDot:      { width: 10, height: 10, borderRadius: 2 },
  chartLabel:  { fontSize: 12, color: '#475569', flex: 1 },
  chartVal:    { fontSize: 12, color: '#1e293b', fontWeight: '600' },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  barTrack:    { height: 7, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  barFill:     { height: 7, borderRadius: 4 },

  // Highlights
  highlightCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 10, padding: 10, borderLeftWidth: 3 },
  highlightIcon:   { fontSize: 16, lineHeight: 22 },
  highlightTitle:  { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  highlightDetail: { fontSize: 12, color: '#475569', lineHeight: 18 },

  // Suggestions
  suggCard:      { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  suggHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  priorityBadge: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  priorityText:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  suggAction:    { fontSize: 13, fontWeight: '700', color: '#0f172a', flex: 1 },
  suggWhy:       { fontSize: 12, color: '#475569', lineHeight: 18, marginBottom: 4 },
  suggImpact:    { fontSize: 12, color: '#2563eb', fontWeight: '500' },

  // NBA
  nbaWrap:    { gap: 8 },
  nbaLabel:   { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },
  nbaChip:    { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  nbaChipTxt: { fontSize: 12, fontWeight: '600', color: '#2563eb' },

  // ── INPUT DOCK ──────────────────────────────────────────────────────────────
  dock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },

  // ── MIC BUTTON ──────────────────────────────────────────────────────────────
  micBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5, borderColor: '#cbd5e1',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  micBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
    shadowColor: '#ef4444', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  micGlowRing: {
    position: 'absolute',
    width: 58, height: 58, borderRadius: 18,
    borderWidth: 2, borderColor: 'rgba(239,68,68,0.3)',
    top: -6, left: -6,
  },
  micIconWrap: { alignItems: 'center', justifyContent: 'center' },
  liveTag: {
    position: 'absolute', bottom: -9,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#dc2626', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1.5, borderColor: '#fff',
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  liveTxt: { fontSize: 7, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // ── TEXT INPUT ──────────────────────────────────────────────────────────────
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#0f172a',
    borderWidth: 1.5, borderColor: '#e2e8f0',
    maxHeight: 100, minHeight: 46,
  },
  inputListening: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },

  // ── SEND BUTTON ─────────────────────────────────────────────────────────────
  sendBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#2563eb', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  sendBtnDisabled: {
    backgroundColor: '#93c5fd',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendShine: {
    position: 'absolute',
    top: 4, left: 5,
    width: 16, height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ rotate: '-30deg' }],
  },
});