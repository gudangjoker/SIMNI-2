import {
  GADM_KB,
  GADM_KB_VERSION,
  GADM_KB_SCHEMA_VERSION,
  resolvePhase,
  resolveSubject,
  resolveCurriculumSource,
  validateCurriculumRecord,
  findCurriculumRecords,
  recommendOfficialCp,
  suggestLearningObjective,
  recommendModels,
  recommendContextSupports,
  recommendProfileDimensions,
  validateProfileEvidence,
  explainDecision,
  planLessonTime,
  validateTimeBudget,
  repairTimeBudget,
  validateCrossDocumentConsistency,
  auditGeneratedDocument,
  buildRepairPlan,
  pickLanguageVariant,
  validateLearningPlan,
  validateDocumentInput,
  validateERaporEvidence,
  selfAuditKB
} from "./gadm-kb.js";

export const GADM_ENGINE = (() => {
  "use strict";

  const ENGINE_VERSION = "6.0.0";
  const ROOT_ID = "gadm-root";
  const KNOWLEDGE_MODE = "teacher-intelligence-knowledge-graph";
  const MAX_RESOLVE_DEPTH = 12;
  const DOCUMENT_TYPES = Object.freeze([
    "modulAjar",
    "prota",
    "promes",
    "silabus",
    "deskripsiKokurikuler",
    "deskripsiERapor"
  ]);

  const state = {
    variation: 0,
    lastInput: null,
    lastResult: null,
    lastValidation: null,
    mounted: false,
    documentBundle: {},
    auditHistory: [],
    lifecycleController: null
  };

  let hostAdapter = null;

  function configureHost(adapter) {
    if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
      throw new Error("Host adapter GADM tidak valid.");
    }
    for (const method of ["normalizeInput", "loadDraft", "saveDraft"]) {
      if (typeof adapter[method] !== "function") {
        throw new Error(`Host adapter GADM tidak menyediakan ${method}().`);
      }
    }
    hostAdapter = Object.freeze({ ...adapter });
    return hostAdapter;
  }

  function normalizeHostInput(input) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? { ...input } : {};
    const normalized = hostAdapter ? hostAdapter.normalizeInput(source) : source;
    if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
      throw new Error("Host adapter GADM menghasilkan input tidak valid.");
    }
    return { ...normalized };
  }

  function lifecycleOptions() {
    if (!state.lifecycleController || state.lifecycleController.signal.aborted) {
      throw new Error("Lifecycle GADM belum aktif.");
    }
    return { signal: state.lifecycleController.signal };
  }

  const normalizeText = (value) => String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  const normalizeMultiline = (value) => String(value ?? "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
  const normalizeId = (value) => normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const compact = (items) => items.filter((item) => item != null && item !== "");
  const unique = (items) => [...new Set(compact(items))];

  function stableHash(input) {
    const text = String(input ?? "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function deterministicPick(items, seed = "gadm") {
    if (!Array.isArray(items) || items.length === 0) return null;
    return items[stableHash(`${GADM_KB_VERSION}:${seed}`) % items.length];
  }

  function deterministicMany(items, count, seed = "gadm") {
    if (!Array.isArray(items) || items.length === 0 || count <= 0) return [];
    const pool = [...items];
    const output = [];
    let cursor = 0;
    while (pool.length > 0 && output.length < count) {
      const index = stableHash(`${seed}:${cursor}`) % pool.length;
      output.push(pool.splice(index, 1)[0]);
      cursor += 1;
    }
    return output;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function stripTerminalPunctuation(value) {
    return normalizeText(value).replace(/[.!?;:]+$/g, "");
  }

  function sentenceCase(value) {
    const text = normalizeText(value).replace(/_/g, " ");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  }

  function ensureSentence(value) {
    const text = normalizeText(value);
    if (!text) return "";
    return /[.!?]$/.test(text) ? text : `${text}.`;
  }

  function asList(value) {
    if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean);
    return normalizeMultiline(value)
      .split("\n")
      .map((item) => item.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
      .filter(Boolean);
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat("id-ID").format(number) : normalizeText(value);
  }

  function joinNatural(items) {
    const values = unique(items.map(normalizeText).filter(Boolean));
    if (values.length === 0) return "";
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} dan ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, dan ${values.at(-1)}`;
  }

  function getByPath(source, path) {
    return String(path)
      .split(".")
      .reduce((current, key) => (current != null ? current[key] : undefined), source);
  }

  class StringAssembler {
    constructor(kb) {
      this.kb = kb;
      this.placeholderPattern = /\{([a-zA-Z0-9_.-]+)\}/g;
    }

    resolveValue(value, context, seed, depth) {
      if (depth > MAX_RESOLVE_DEPTH) {
        throw new Error("Batas resolusi Nested Assembly terlampaui.");
      }
      if (Array.isArray(value)) {
        const picked = deterministicPick(value, `${seed}:array:${depth}`);
        return this.resolveValue(picked, context, seed, depth + 1);
      }
      if (value && typeof value === "object") {
        if (typeof value.value === "string" || Array.isArray(value.value)) {
          return this.resolveValue(value.value, context, seed, depth + 1);
        }
        return "";
      }
      return this.resolve(String(value ?? ""), context, seed, depth + 1);
    }

    resolve(template, context = {}, seed = "gadm", depth = 0) {
      if (depth > MAX_RESOLVE_DEPTH) {
        throw new Error("Batas resolusi Nested Assembly terlampaui.");
      }

      let output = String(template ?? "");
      let rounds = 0;
      while (this.placeholderPattern.test(output)) {
        this.placeholderPattern.lastIndex = 0;
        if (rounds >= MAX_RESOLVE_DEPTH) {
          throw new Error(`Placeholder bersarang tidak selesai: ${output}`);
        }
        output = output.replace(this.placeholderPattern, (full, token) => {
          const fromContext = getByPath(context, token);
          if (fromContext !== undefined) {
            return this.resolveValue(fromContext, context, `${seed}:${token}:${rounds}`, depth + 1);
          }
          const fromKB = getByPath(this.kb, token);
          if (fromKB !== undefined) {
            return this.resolveValue(fromKB, context, `${seed}:kb:${token}:${rounds}`, depth + 1);
          }
          return full;
        });
        rounds += 1;
      }
      this.placeholderPattern.lastIndex = 0;
      return normalizeText(output);
    }

    assemble(segments, context = {}, seed = "gadm") {
      return compact(segments)
        .map((segment, index) => this.resolveValue(segment, context, `${seed}:segment:${index}`, 0))
        .map(sentenceCase)
        .map(ensureSentence)
        .filter(Boolean)
        .join(" ");
    }
  }

  const assembler = new StringAssembler(GADM_KB);

  function makeIssue(code, message, field = null, severity = "error") {
    return { code, message, field, severity };
  }

  function mergeValidation(...reports) {
    const errors = [];
    const warnings = [];
    reports.filter(Boolean).forEach((report) => {
      if (Array.isArray(report.errors)) errors.push(...report.errors);
      if (Array.isArray(report.warnings)) warnings.push(...report.warnings);
    });
    return { ok: errors.length === 0, errors, warnings };
  }

  function parsePipeRows(value, options = {}) {
    const { columns = 3 } = options;
    return normalizeMultiline(value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const parts = line.split("|").map((part) => part.trim());
        while (parts.length < columns) parts.push("");
        return { index: index + 1, raw: line, parts };
      });
  }

  function parsePositiveNumber(value) {
    const normalized = String(value ?? "").replace(",", ".").trim();
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function parseTimeAllocation(input = {}) {
    const explicitTotal = parsePositiveNumber(input.totalMinutes ?? input.totalMenit ?? input.alokasiMenit);
    const explicitJP = parsePositiveNumber(input.jp ?? input.jumlahJP);
    const explicitMinutesPerJP = parsePositiveNumber(input.minutesPerJP ?? input.menitPerJP) ?? GADM_KB.timeIntelligence.policy.defaultMinutesPerJP;
    if (explicitTotal) return { totalMinutes: Math.round(explicitTotal), jp: explicitJP, minutesPerJP: explicitMinutesPerJP, source: "explicit_total" };
    if (explicitJP) return { totalMinutes: Math.round(explicitJP * explicitMinutesPerJP), jp: explicitJP, minutesPerJP: explicitMinutesPerJP, source: "explicit_jp" };

    const raw = normalizeText(input.alokasiWaktu);
    if (!raw) return { totalMinutes: null, jp: null, minutesPerJP: explicitMinutesPerJP, source: "missing" };
    const lower = raw.toLowerCase().replace(/×/g, "x");
    const multiplication = lower.match(/(\d+(?:[.,]\d+)?)\s*[x*]\s*(\d+(?:[.,]\d+)?)/);
    if (multiplication) {
      const a = Number(multiplication[1].replace(",", "."));
      const b = Number(multiplication[2].replace(",", "."));
      if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
        return { totalMinutes: Math.round(a * b), jp: a, minutesPerJP: b, source: "parsed_multiplication" };
      }
    }
    const minutes = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:menit|min\b)/);
    if (minutes) {
      const total = Number(minutes[1].replace(",", "."));
      if (Number.isFinite(total) && total > 0) return { totalMinutes: Math.round(total), jp: null, minutesPerJP: explicitMinutesPerJP, source: "parsed_minutes" };
    }
    const jp = lower.match(/(\d+(?:[.,]\d+)?)\s*jp\b/);
    if (jp) {
      const count = Number(jp[1].replace(",", "."));
      if (Number.isFinite(count) && count > 0) return { totalMinutes: Math.round(count * explicitMinutesPerJP), jp: count, minutesPerJP: explicitMinutesPerJP, source: "parsed_jp" };
    }
    const bare = parsePositiveNumber(raw);
    if (bare) return { totalMinutes: Math.round(bare), jp: null, minutesPerJP: explicitMinutesPerJP, source: "parsed_bare_minutes" };
    return { totalMinutes: null, jp: null, minutesPerJP: explicitMinutesPerJP, source: "unparsed" };
  }

  function buildTeacherContext(input, phase) {
    const context = recommendContextSupports({
      phase,
      kelasAtauFase: input.kelasAtauFase,
      kondisiAwalMurid: input.kondisiAwalMurid,
      sumberDaya: input.sumberDaya,
      konteksSekolah: input.konteksSekolah,
      tujuan: input.tujuan || input.cpAtauTp,
      aktivitas: input.aktivitas,
      contextFlags: Array.isArray(input.contextFlags) ? input.contextFlags : [],
      catatan: [input.teacherContext, input.sumberDaya, input.konteksSekolah].filter(Boolean).join(" | ")
    });
    const matchedDetails = context.matchedContexts
      .map((id) => Object.values(GADM_KB.teacherContextIntelligence.contexts).find((item) => item.id === id))
      .filter(Boolean);
    return {
      ...context,
      matchedDetails,
      preferredModelIds: unique(matchedDetails.flatMap((item) => item.preferModels || [])),
      rules: unique([...(context.rules || []), ...matchedDetails.flatMap((item) => item.rules || [])])
    };
  }

  function resolveCurriculumGrounding(input, phase) {
    const subject = resolveSubject(input.mataPelajaran);
    const source = subject ? resolveCurriculumSource(subject.id ?? input.mataPelajaran) : resolveCurriculumSource(input.mataPelajaran);
    const requestedRecordId = normalizeText(input.curriculumRecordId || input.cpRecordId);
    let record = null;
    if (requestedRecordId) {
      const matches = findCurriculumRecords({ id: requestedRecordId, phase, subject: subject?.id ?? input.mataPelajaran });
      record = matches[0] || null;
    }
    const recordValidation = record ? validateCurriculumRecord(record) : null;
    const cpText = normalizeText(input.cpResmiAtauManual || input.cpAtauTp || input.cpAtpTp);
    const verifiedRecordText = normalizeText(record?.officialText);
    const verifiedSelection = Boolean(record && recordValidation?.ok && cpText && verifiedRecordText.includes(cpText));
    return {
      subject,
      source,
      record,
      recordValidation,
      cpText,
      provenance: verifiedSelection ? "verified_kb_record" : cpText ? "teacher_supplied_unverified_text" : "missing",
      officialTextClaimAllowed: verifiedSelection
    };
  }

  function plannedProfileEvidence(profileEntries, phase, seed) {
    const evidence = {};
    profileEntries.forEach((item, index) => {
      const dimension = GADM_KB.profilLulusan.dimensions[item.key || item.dimension];
      const indicator = deterministicPick(dimension?.phaseIndicators?.[phase] || [], `${seed}:profile-evidence:${item.key || item.dimension}:${index}`);
      if (indicator) evidence[item.key || item.dimension] = indicator;
    });
    return evidence;
  }

  function translateReasonCodes(codes) {
    return unique((codes || []).map((code) => GADM_KB.decisionExplanations.reasonCodes[code] || code).filter(Boolean));
  }

  function buildDecisionExplanations({ model, media, profiles, assessments, context }) {
    const profileReasons = profiles.length ? explainDecision("profile", profiles[0]?.key || profiles[0]?.dimension, context) : [];
    return {
      model: translateReasonCodes(explainDecision("model", model, context)),
      media: translateReasonCodes(explainDecision("media", media, context)),
      profile: translateReasonCodes(profileReasons),
      assessment: translateReasonCodes(explainDecision("assessment", assessments, context))
    };
  }

  function qualityIssuesFromAudit(audit) {
    if (!audit) return { ok: true, errors: [], warnings: [] };
    return {
      ok: audit.fails.length === 0,
      errors: audit.fails.map((item) => makeIssue(`QUALITY_${String(item.id).toUpperCase()}`, item.message, item.id, "error")),
      warnings: audit.warnings.map((item) => makeIssue(`QUALITY_${String(item.id).toUpperCase()}`, item.message, item.id, "warning"))
    };
  }

  function buildConsistencyEnvelope(type, input, data = {}) {
    const phase = resolvePhase(input.kelasAtauFase || data.phase);
    const curriculum = data.curriculum || {};
    return {
      documentType: type,
      tahunPelajaran: normalizeText(input.tahunPelajaran),
      semester: normalizeText(input.semester),
      kelasAtauFase: normalizeText(input.kelasAtauFase) || (phase ? GADM_KB.faseMap[phase].label : ""),
      mataPelajaran: normalizeText(input.mataPelajaran),
      cpId: normalizeText(input.cpId || curriculum.record?.id),
      tpId: normalizeText(input.tpId)
    };
  }

  function registerDocument(type, input, result) {
    if (!result?.validation?.ok) return null;
    const envelope = buildConsistencyEnvelope(type, input, result.data || {});
    state.documentBundle[type] = envelope;
    const consistency = validateCrossDocumentConsistency(state.documentBundle);
    result.data = { ...(result.data || {}), consistencyEnvelope: envelope, crossDocumentConsistency: consistency };
    return consistency;
  }

  function resolveProfileDimensions(rawValue, phase, seed, reasoningContext = {}) {
    const dimensions = GADM_KB.profilLulusan.dimensions;
    const requested = Array.isArray(rawValue) ? rawValue : String(rawValue ?? "").split(/[;,\n]/);
    const normalizedRequested = requested.map(normalizeId).filter(Boolean);
    if (normalizedRequested.length) {
      return Object.entries(dimensions)
        .filter(([key, dimension]) => normalizedRequested.some((requestedId) => [normalizeId(key), normalizeId(dimension.label)].includes(requestedId)))
        .slice(0, GADM_KB.generationPolicies.selectFewNotAll.profileDimensionsDefaultMax)
        .map(([key, dimension], index) => ({ key, dimension: key, priority: index === 0 ? "utama" : "pendukung", reasonCode: "PROFILE_EVIDENCE", ...dimension }));
    }

    const recommended = recommendProfileDimensions({ phase, ...reasoningContext });
    return recommended.map((item) => ({
      key: item.dimension,
      ...item,
      ...(dimensions[item.dimension] || {})
    }));
  }

  function resolveMethods(phase, contextText, seed, preferredCount = 2, teacherContext = null) {
    const entries = Object.entries(GADM_KB.metodePembelajaran)
      .filter(([key, value]) => key !== "phaseGuidance" && value && Array.isArray(value.suitablePhases))
      .filter(([, value]) => value.suitablePhases.includes(phase));

    const text = normalizeText(contextText).toLowerCase();
    const scored = entries.map(([key, method]) => {
      let score = 0;
      if (teacherContext?.recommendedMethodKeys?.includes(key)) score += 4;
      method.purposes.forEach((purpose) => {
        const purposeWords = normalizeText(purpose).toLowerCase().split(/\s+/).filter((word) => word.length >= 5);
        if (purposeWords.some((word) => text.includes(word))) score += 1;
      });
      if (text.includes("praktik") && key === "praktik") score += 3;
      if (text.includes("diskusi") && key === "diskusi") score += 3;
      if (text.includes("membaca") && key === "membacaTerbimbing") score += 3;
      if (text.includes("percobaan") && key === "eksperimen") score += 3;
      if (text.includes("observasi") && key === "observasi") score += 3;
      if (text.includes("presentasi") && key === "presentasi") score += 3;
      return { key, ...method, score };
    });

    const strongest = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "id"));
    const candidates = strongest.length >= preferredCount ? strongest : scored;
    return deterministicMany(candidates, preferredCount, `${seed}:methods`).map(({ key, label, purposes }) => ({ key, label, purposes }));
  }

  function resolveMedia(phase, seed, count = 3, teacherContext = null, explicitValue = "") {
    const explicit = String(explicitValue ?? "").split(/[;,\n]/).map(normalizeText).filter(Boolean);
    if (explicit.length) return unique(explicit).slice(0, count);
    const contextual = unique(teacherContext?.recommendedMedia || []);
    const base = unique(GADM_KB.mediaPembelajaran.byPhase[phase] ?? []);
    if (contextual.length) {
      const primary = deterministicMany(contextual, Math.min(count, contextual.length), `${seed}:media:context`);
      const remainder = base.filter((item) => !primary.includes(item));
      return [...primary, ...deterministicMany(remainder, Math.max(0, count - primary.length), `${seed}:media:base`)].slice(0, count);
    }
    return deterministicMany(base, count, `${seed}:media`);
  }

  function resolveKko(contextText, seed) {
    const text = normalizeText(contextText).toLowerCase();
    const intents = GADM_KB.kko.intents;
    let pool = [];
    if (/refle|nilai|kriteria|revisi|evalu/.test(text)) pool = intents.mengevaluasiMerefleksi;
    else if (/rancang|buat|karya|produk|proyek|cipta/.test(text)) pool = intents.mencipta;
    else if (/analisis|selidik|data|bukti|sebab|simpul|tanya/.test(text)) pool = intents.menalarMenyelidiki;
    else if (/praktik|gunakan|hitung|terap|selesai/.test(text)) pool = intents.menerapkan;
    else if (/jelas|banding|hubung|contoh|kelompok|cerita/.test(text)) pool = intents.memahamiMenjelaskan;
    else pool = intents.mengenaliMengingat;
    return deterministicPick(pool, `${seed}:kko`);
  }

  function resolveModel(input, phase, seed, teacherContext = null) {
    const requested = normalizeId(input.modelPembelajaran);
    const models = Object.values(GADM_KB.modelPembelajaran);
    if (requested && requested !== "otomatis" && requested !== "auto") {
      const selected = models.find((model) => [normalizeId(model.id), normalizeId(model.label)].includes(requested));
      if (selected) return { model: selected, recommendations: [], source: "teacher_override" };
    }

    const recommendations = recommendModels({
      phase,
      tujuan: input.tujuan || input.cpAtauTp || input.cpAtpTp,
      kompetensi: input.kompetensi || input.tujuan,
      buktiBelajar: input.buktiBelajar || input.evidence,
      aktivitas: input.aktivitas,
      output: input.output || input.materiAtauUnit || input.materiAtauLingkup,
      kondisiAwalMurid: input.kondisiAwalMurid
    });
    let chosen = recommendations[0];
    const topScore = Number(chosen?.score || 0);
    if (topScore <= 1 && teacherContext?.preferredModelIds?.length) {
      const preferred = teacherContext.preferredModelIds
        .map((id) => models.find((model) => normalizeId(model.id) === normalizeId(id)))
        .find((model) => model?.suitablePhases?.includes(phase));
      if (preferred) chosen = { id: preferred.id, score: topScore, reasons: ["COLLABORATIVE_CONTRIBUTION"] };
    }
    const selected = models.find((model) => model.id === chosen?.id) ?? models.find((model) => model.id === "explicit_instruction") ?? models[0];
    return { model: selected, recommendations, source: chosen ? "knowledge_graph_recommendation" : "safe_fallback_from_kb" };
  }

  function modelSyntaxLabel(stepId) {
    return sentenceCase(String(stepId).replace(/_/g, " "));
  }

  function buildModulePlan(input, seed) {
    const phase = resolvePhase(input.kelasAtauFase);
    if (!phase) return { validation: { ok: false, errors: [makeIssue("PHASE_INVALID", "Kelas/fase tidak valid.", "kelasAtauFase")], warnings: [] } };

    const curriculum = resolveCurriculumGrounding(input, phase);
    const teacherContext = buildTeacherContext(input, phase);
    const { model, recommendations, source: modelSource } = resolveModel(input, phase, seed, teacherContext);
    const contextText = [input.cpAtauTp, input.materiAtauUnit, input.tujuan, input.buktiBelajar, input.kondisiAwalMurid].filter(Boolean).join(" | ");
    const methods = resolveMethods(phase, contextText, seed, 3, teacherContext);
    const media = resolveMedia(phase, seed, 3, teacherContext, input.mediaPembelajaran);
    const kko = resolveKko(contextText, seed);

    const profileContext = {
      tujuan: input.tujuan || input.cpAtauTp,
      kompetensi: input.kompetensi,
      aktivitas: [contextText, methods.map((item) => item.label).join(" "), model.label].join(" | "),
      buktiBelajar: input.buktiBelajar,
      model: model.label,
      metode: methods.map((item) => item.label).join(" ")
    };
    const profiles = resolveProfileDimensions(input.targetProfilLulusan, phase, seed, profileContext);
    const profileEvidence = plannedProfileEvidence(profiles, phase, seed);

    const pm = GADM_KB.pembelajaranMendalam;
    const mindful = deterministicPick(pm.prinsip.berkesadaran.phaseIndicators[phase], `${seed}:mindful`);
    const readiness = deterministicPick(pm.prinsip.berkesadaran.optionalReadinessActivities[phase], `${seed}:readiness`);
    const meaningful = deterministicPick(GADM_KB.kegiatanKontekstual.meaningfulByPhase[phase], `${seed}:meaningful`);
    const joyful = deterministicPick(pm.prinsip.menggembirakan.phaseIndicators[phase], `${seed}:joyful`);
    const opening = pickLanguageVariant("opening", `${seed}:opening`);
    const transition = pickLanguageVariant("transition", `${seed}:transition`);
    const closing = pickLanguageVariant("closing", `${seed}:closing`);
    const topic = normalizeText(input.materiAtauUnit);
    const target = normalizeText(input.cpAtauTp);
    const phaseGuidanceUnderstand = pm.pengalamanBelajar.memahami.phaseGuidance[phase];
    const phaseGuidanceApply = pm.pengalamanBelajar.mengaplikasi.phaseGuidance[phase];
    const phaseGuidanceReflect = pm.pengalamanBelajar.merefleksi.phaseGuidance[phase];
    const evidenceUnderstand = deterministicPick(pm.pengalamanBelajar.memahami.evidenceExamples, `${seed}:ev:understand`);
    const evidenceApply = deterministicPick(pm.pengalamanBelajar.mengaplikasi.evidenceExamples, `${seed}:ev:apply`);
    const evidenceReflect = deterministicPick(pm.pengalamanBelajar.merefleksi.evidenceExamples, `${seed}:ev:reflect`);

    // Nested Assembly: setiap placeholder dapat berasal dari context atau node KB dan diselesaikan rekursif.
    const memahami = assembler.assemble([
      "{opening}", "{mindful}.", "{readiness}.", "{phaseGuidanceUnderstand}.", "{evidenceUnderstand}."
    ], { opening, mindful, readiness, phaseGuidanceUnderstand, evidenceUnderstand }, `${seed}:memahami`);
    const mengaplikasi = assembler.assemble([
      "{transition}", "{meaningful}.", "{phaseGuidanceApply}.", "{joyful}.", "{evidenceApply}."
    ], { transition, meaningful, phaseGuidanceApply, joyful, evidenceApply }, `${seed}:mengaplikasi`);
    const merefleksi = assembler.assemble([
      "{closing}", "{phaseGuidanceReflect}.", "{evidenceReflect}."
    ], { closing, phaseGuidanceReflect, evidenceReflect }, `${seed}:merefleksi`);

    const modelSyntax = model.syntax.map((step, index) => ({
      id: step,
      label: modelSyntaxLabel(step),
      experience: index < Math.ceil(model.syntax.length / 3) ? "memahami" : index < Math.ceil((model.syntax.length * 2) / 3) ? "mengaplikasi" : "merefleksi"
    }));

    const initialAssessment = deterministicPick(GADM_KB.asesmen.moments.awal.examples, `${seed}:assessment:initial`);
    const processAssessment = deterministicPick(GADM_KB.asesmen.moments.proses.examples, `${seed}:assessment:process`);
    const finalAssessment = deterministicPick(GADM_KB.asesmen.moments.akhir.examples, `${seed}:assessment:final`);
    const support = teacherContext.recommendedSupports[0] || deterministicPick(GADM_KB.scaffolding.supports.proses, `${seed}:support`);
    const timeInput = parseTimeAllocation(input);
    let timePlan = planLessonTime({ phase, modelId: model.id, totalMinutes: timeInput.totalMinutes, jp: timeInput.jp, minutesPerJP: timeInput.minutesPerJP });
    if (timePlan.ok && !validateTimeBudget(timePlan).ok) timePlan = repairTimeBudget(timePlan, { phase, modelId: model.id, totalMinutes: timePlan.totalMinutes });

    const assessments = { awal: initialAssessment, proses: processAssessment, akhir: finalAssessment };
    const decisionContext = {
      phase,
      tujuan: input.tujuan || target,
      kompetensi: input.kompetensi || target,
      buktiBelajar: input.buktiBelajar || [evidenceUnderstand, evidenceApply, evidenceReflect].join("; "),
      aktivitas: [meaningful, model.label, methods.map((item) => item.label).join(" ")].join(" | "),
      kondisiAwalMurid: input.kondisiAwalMurid,
      sumberDaya: input.sumberDaya
    };
    const decisionExplanations = buildDecisionExplanations({ model, media, profiles, assessments, context: decisionContext });

    const plan = {
      phase,
      kelasAtauFase: input.kelasAtauFase,
      mataPelajaran: input.mataPelajaran,
      materiAtauUnit: topic,
      cpAtauTp: target,
      tujuan: normalizeText(input.tujuan) || target,
      buktiBelajar: [evidenceUnderstand, evidenceApply, evidenceReflect],
      pendekatanPembelajaran: GADM_KB.pendekatanPembelajaran.pembelajaranMendalam,
      modelPembelajaran: model,
      modelSyntax: model.syntax,
      metodePembelajaran: methods,
      mediaPembelajaran: media,
      pengalamanBelajar: { memahami, mengaplikasi, merefleksi },
      memahami,
      mengaplikasi,
      merefleksi,
      asesmen: assessments,
      tindakLanjut: { support, fadingRule: GADM_KB.scaffolding.fadingRule },
      targetProfilLulusan: profiles,
      profileEvidence,
      teacherContext,
      timePlan,
      curriculum,
      decisionExplanations
    };

    const coreValidation = mergeValidation(validateDocumentInput("modulAjar", input), validateLearningPlan(plan));
    if (curriculum.provenance === "teacher_supplied_unverified_text") {
      coreValidation.warnings.push(makeIssue("CURRICULUM_TEXT_UNVERIFIED", "CP/TP berasal dari input guru dan belum diverifikasi sebagai salinan teks resmi oleh corpus tertanam GADM.", "cpAtauTp", "warning"));
    }
    let qualityAudit = null;
    let repairPlan = null;
    if (coreValidation.ok) {
      qualityAudit = auditGeneratedDocument({
        documentType: "modulAjar",
        input,
        plan,
        timePlan: timePlan.ok ? timePlan : null,
        selectedDimensions: profiles.map((item) => item.key || item.dimension),
        profileEvidence,
        curriculumRecord: curriculum.record
      });
      repairPlan = buildRepairPlan(qualityAudit);
      state.auditHistory.push({ at: new Date().toISOString(), documentType: "modulAjar", audit: qualityAudit });
      if (state.auditHistory.length > 20) state.auditHistory.shift();
    }
    const qualityValidation = qualityIssuesFromAudit(qualityAudit);
    const validation = mergeValidation(coreValidation, qualityValidation);

    return {
      phase, curriculum, teacherContext, model, modelSource, recommendations, methods, media, profiles, profileEvidence,
      timePlan, decisionExplanations, qualityAudit, repairPlan, plan, validation, kko
    };
  }

  function renderIssues(validation) {
    const sections = [];
    if (validation.errors.length) {
      sections.push(`<section class="gadm-output-alert gadm-output-alert-error"><h3>Generasi diblokir</h3><ul>${validation.errors.map((item) => `<li>${escapeHTML(item.message || item.code)}</li>`).join("")}</ul></section>`);
    }
    if (validation.warnings.length) {
      sections.push(`<section class="gadm-output-alert gadm-output-alert-warning"><h3>Catatan validasi</h3><ul>${validation.warnings.map((item) => `<li>${escapeHTML(item.message || item.code)}</li>`).join("")}</ul></section>`);
    }
    return sections.join("");
  }

  function renderHeader(title, subtitle = "") {
    return `<header class="gadm-doc-header"><h1>${escapeHTML(title)}</h1>${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}</header>`;
  }

  function renderKeyValue(rows) {
    return `<dl class="gadm-doc-meta">${rows.filter(([, value]) => normalizeText(value)).map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>`;
  }

  function renderBullets(items) {
    return `<ul>${items.filter(Boolean).map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`;
  }

  function renderTable(headers, rows) {
    return `<div class="gadm-table-wrap" tabindex="0" role="region" aria-label="Tabel dokumen"><table class="gadm-table"><thead><tr>${headers.map((header) => `<th>${escapeHTML(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function renderFormatBasis(documentName) {
    const standard = GADM_KB.documentLayoutStandards?.[documentName];
    if (!standard) return "";
    return `<p class="gadm-doc-note"><strong>Dasar format:</strong> ${escapeHTML(standard.status)} ${escapeHTML(standard.basis)}</p>`;
  }

  function renderApprovalBlock(input) {
    const teacher = normalizeText(input.namaGuru);
    const school = normalizeText(input.namaSekolah);
    if (!teacher && !school) return "";
    return `<section class="gadm-signature-section"><h2>Pengesahan</h2><div class="gadm-signature-grid"><div><p>Mengetahui,<br>Kepala Satuan Pendidikan</p><div class="gadm-signature-space"></div><p>(................................................)</p></div><div><p>Guru Mata Pelajaran/Kelas</p><div class="gadm-signature-space"></div><p><strong>${escapeHTML(teacher || "................................................")}</strong></p></div></div></section>`;
  }

  function renderQualityAudit(audit) {
    if (!audit) return "";
    const rows = audit.checks.map((item) => [item.status === "pass" ? "✓" : item.status === "warning" ? "!" : "×", sentenceCase(item.id), item.message]);
    return `<section class="gadm-quality"><h2>GADM Quality Inspector — ${escapeHTML(String(audit.score))}/100</h2>${renderTable(["Status", "Pemeriksaan", "Hasil"], rows)}<p class="gadm-doc-note">Status: ${escapeHTML(audit.status)}</p></section>`;
  }

  function renderDecisionExplanations(explanations) {
    if (!explanations) return "";
    const sections = [
      ["Model", explanations.model],
      ["Media", explanations.media],
      ["Profil Lulusan", explanations.profile],
      ["Asesmen", explanations.assessment]
    ].filter(([, reasons]) => Array.isArray(reasons) && reasons.length);
    if (!sections.length) return "";
    return `<section><h2>Mengapa GADM Memilih Ini?</h2>${sections.map(([label, reasons]) => `<h3>${escapeHTML(label)}</h3>${renderBullets(reasons)}`).join("")}</section>`;
  }

  function renderTeacherContext(context) {
    if (!context?.matchedDetails?.length) return "";
    return `<section><h2>Adaptasi Berdasarkan Konteks Kelas</h2>${renderBullets(context.matchedDetails.map((item) => item.label))}${context.rules?.length ? `<h3>Aturan Adaptasi</h3>${renderBullets(context.rules)}` : ""}${context.recommendedSupports?.length ? `<h3>Dukungan yang Direkomendasikan</h3>${renderBullets(context.recommendedSupports)}` : ""}</section>`;
  }

  function renderTimePlan(timePlan) {
    if (!timePlan?.ok) return "";
    const labels = { pendahuluan: "Pendahuluan", memahami: "Memahami", mengaplikasi: "Mengaplikasi", merefleksi: "Merefleksi", penutup: "Penutup" };
    const rows = Object.entries(timePlan.segments).map(([key, value]) => [labels[key] || sentenceCase(key), `${value} menit`]);
    rows.push(["TOTAL", `${timePlan.totalMinutes} menit`]);
    return `<section><h2>Reality Check Waktu</h2>${renderTable(["Segmen", "Alokasi"], rows)}</section>`;
  }

  function renderCurriculumGrounding(curriculum) {
    if (!curriculum) return "";
    const sourceTitle = curriculum.source?.title || curriculum.source?.sourceTitle || curriculum.source?.id || "";
    const status = curriculum.officialTextClaimAllowed ? "Record KB terverifikasi" : curriculum.cpText ? "Teks CP/TP diberikan guru; tidak diklaim sebagai salinan resmi oleh engine" : "Belum tersedia";
    return `<section><h2>Curriculum Grounding</h2>${renderKeyValue([["Mata Pelajaran Terdeteksi", curriculum.subject?.label || curriculum.subject?.name || ""], ["Rute Sumber", sourceTitle], ["Status Provenance", status]])}</section>`;
  }

  function resultFromHTML(type, title, html, text, validation, data = {}) {
    return { type, title, html, text, validation, data, engineVersion: ENGINE_VERSION, kbVersion: GADM_KB_VERSION, kbSchemaVersion: GADM_KB_SCHEMA_VERSION, architecture: KNOWLEDGE_MODE };
  }

  function generateModule(input, seed) {
    const built = buildModulePlan(input, seed);
    const validation = built.validation ?? { ok: false, errors: [makeIssue("MODULE_BUILD_FAILED", "Rencana modul tidak dapat dibangun.")], warnings: [] };
    if (!validation.ok) {
      const html = `${renderHeader("Modul Ajar — Belum Dapat Digenerasi")}${renderIssues(validation)}`;
      const text = ["MODUL AJAR — GENERASI DIBLOKIR", ...validation.errors.map((item) => `- ${item.message || item.code}`)].join("\n");
      return resultFromHTML("modulAjar", "Modul Ajar", html, text, validation, built);
    }

    const { phase, curriculum, teacherContext, model, methods, media, profiles, profileEvidence, timePlan, qualityAudit, plan } = built;
    const profileLabels = profiles.map((item) => item.label);
    const topic = normalizeText(input.materiAtauUnit) || "Materi Pokok";
    const cpText = escapeHTML(input.cpResmiAtauManual || input.cpAtauTp || "");
    const tpText = escapeHTML(input.tujuanPembelajaran || input.tujuan || input.cpAtauTp || "");
    const schoolName = input.namaSekolah || "SDIT Bina Muda";
    const teacherName = input.namaGuru || "Guru Kelas / Mata Pelajaran";
    const academicYear = input.tahunPelajaran || "2024/2025";
    const semester = input.semester || "1 (Ganjil)";
    const timeAlloc = input.alokasiWaktu || "2 x 35 Menit (1 Pertemuan)";
    const phaseLabel = GADM_KB.faseMap[phase]?.label || "Fase B";

    // Alokasi waktu terstruktur (Pendahuluan, Inti, Penutup)
    const timeIntro = timePlan?.ok && timePlan.segments?.pendahuluan ? `${timePlan.segments.pendahuluan} Menit` : "10 Menit";
    const timeCore = timePlan?.ok ? `${(timePlan.segments?.memahami || 20) + (timePlan.segments?.mengaplikasi || 20) + (timePlan.segments?.merefleksi || 10)} Menit` : "50 Menit";
    const timeClosing = timePlan?.ok && timePlan.segments?.penutup ? `${timePlan.segments.penutup} Menit` : "10 Menit";

    // Pertanyaan pemantik kontekstual
    const pemantik = [
      `Pernahkah kalian menemukan atau mengamati peristiwa yang berkaitan dengan ${topic} di sekitar kalian?`,
      `Mengapa pemahaman tentang ${topic} penting bagi kehidupan kita sehari-hari?`,
      `Bagaimana kita dapat membuktikan atau mencari tahu lebih mendalam tentang ${topic} bersama teman-teman?`
    ];

    // Pemahaman Bermakna kontekstual
    const pemahamanBermakna = `Peserta didik menyadari bahwa konsep ${topic} memiliki keterkaitan erat dengan kehidupan sehari-hari dan lingkungan sekitar. Melalui proses pengamatan, diskusi kolaboratif, dan penyelidikan, peserta didik menumbuhkan rasa syukur atas keteraturan ciptaan Tuhan YME, mengasah nalar kritis, serta mampu mengambil keputusan secara bijak dalam menyelesaikan permasalahan kontekstual.`;

    // Kompetensi Awal
    const kompetensiAwal = input.kondisiAwalMurid
      ? `Peserta didik telah memiliki pemahaman dasar awal terkait materi ${topic} melalui pengalaman sehari-hari. Berdasarkan identifikasi awal: ${input.kondisiAwalMurid}.`
      : `Sebelum mengikuti pembelajaran ini, peserta didik telah mengenal fenomena dasar terkait ${topic} dari pengamatan dan pengalaman sehari-hari, serta siap mengikuti penyelidikan terarah dalam kelompok.`;

    // Skenario Sintaks Kegiatan Inti
    const syntaxRows = plan.modelSyntax.map((step, index) => {
      const expType = index < Math.ceil(plan.modelSyntax.length / 3) ? "Memahami" : index < Math.ceil((plan.modelSyntax.length * 2) / 3) ? "Mengaplikasi" : "Merefleksi";
      const expNarrative = expType === "Memahami" ? plan.memahami : expType === "Mengaplikasi" ? plan.mengaplikasi : plan.merefleksi;
      return [
        `Tahap ${index + 1}`,
        modelSyntaxLabel(step),
        expNarrative,
        expType
      ];
    });

    // Profile table rows (hanya jika ada dimensi profil lulusan yang terpilih)
    const profileRows = profiles.map((item) => [
      item.label,
      profileEvidence[item.key || item.dimension] || "Menunjukkan keterlibatan aktif, kerja sama tim, dan kemampuan bernalar objektif selama proses pembelajaran."
    ]);

    const html = [
      renderHeader("Modul Ajar Pembelajaran Mendalam", `KURIKULUM MERDEKA • ${schoolName.toUpperCase()} • TAHUN PELAJARAN ${academicYear}`),
      
      `<section><h2>I. INFORMASI UMUM</h2>`,
      `<h3>A. Identitas Modul</h3>`,
      renderKeyValue([
        ["Nama Penyusun", teacherName],
        ["Satuan Pendidikan", schoolName],
        ["Tahun Pelajaran", academicYear],
        ["Mata Pelajaran", input.mataPelajaran || "-"],
        ["Fase / Kelas / Semester", `${phaseLabel} / Kelas ${input.kelasAtauFase} / Semester ${semester}`],
        ["Elemen / Domain", input.materiAtauUnit ? `Pemahaman ${input.mataPelajaran || "Materi"}` : "-"],
        ["Materi Pokok", topic],
        ["Alokasi Waktu", timeAlloc]
      ]),
      `<h3>B. Kompetensi Awal</h3>`,
      `<p>${escapeHTML(kompetensiAwal)}</p>`,
      `<h3>C. Profil Pelajar Pancasila</h3>`,
      renderBullets(profileLabels.length ? profileLabels : ["Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia", "Bernalar Kritis", "Gotong Royong", "Mandiri"]),
      `<h3>D. Sarana dan Prasarana</h3>`,
      renderBullets([
        `Media Pembelajaran: ${joinNatural(media.length ? media : ["Papan tulis", "Kartu gambar kontekstual", "Benda konkret lingkungan", "Proyektor LCD/Video"])}`,
        `Sumber Belajar: Buku Guru dan Buku Siswa ${input.mataPelajaran || "Kemendikbudristek"}, bahan tayang, dan lingkungan sekitar`,
        `Alat dan Bahan: Alat tulis, lembar pengamatan/eksplorasi ${topic}`
      ]),
      `<h3>E. Target Peserta Didik</h3>`,
      renderBullets([
        "Peserta didik reguler/tipikal: umum, tidak ada kesulitan dalam mencerna dan memahami materi ajar.",
        "Peserta didik dengan pencapaian tinggi: mencerna dan memahami dengan cepat, mampu mencapai keterampilan berpikir tingkat tinggi (HOTS).",
        "Peserta didik dengan kesulitan belajar: difasilitasi dengan bimbingan terfokus dan pendampingan bertahap (scaffolding)."
      ]),
      `<h3>F. Jumlah Peserta Didik</h3>`,
      `<p>20 – 28 Peserta Didik (kondisi ideal pembelajaran tatap muka)</p>`,
      `<h3>G. Pendekatan, Model, dan Metode Pembelajaran</h3>`,
      renderKeyValue([
        ["Pendekatan", "Deep Learning / Pembelajaran Mendalam (Mindful, Meaningful, Joyful)"],
        ["Model Pembelajaran", model.label],
        ["Metode Pembelajaran", joinNatural(methods.map((item) => item.label))]
      ]),
      `</section>`,

      `<section><h2>II. KOMPONEN INTI</h2>`,
      `<h3>A. Capaian Pembelajaran (CP)</h3>`,
      `<div class="gadm-curriculum-text"><p>${cpText}</p>${curriculum?.officialTextClaimAllowed ? '<small class="gadm-curriculum-source" style="display:block;margin-top:6px;color:#64748b;font-size:10px;">Status: Record KB terverifikasi</small>' : ""}</div>`,
      `<h3>B. Tujuan Pembelajaran (TP)</h3>`,
      `<div class="gadm-curriculum-text"><p>${tpText}</p></div>`,
      `<h3>C. Pemahaman Bermakna</h3>`,
      `<p>${escapeHTML(pemahamanBermakna)}</p>`,
      `<h3>D. Kemitraan Pembelajaran</h3>`,
      renderBullets([
        "Lingkungan Sekolah: Interaksi kolaboratif antarsiswa dalam tim belajar, koordinasi berkala bersama guru kelas/sejawat, pemanfaatan ruang kelas dan perpustakaan.",
        "Luar Sekolah / Orang Tua: Pendampingan kebiasaan belajar di rumah serta obrolan bermakna seputar materi di lingkungan keluarga.",
        "Mitra Digital / Sumber Belajar: Pemanfaatan sumber belajar digital edukatif terverifikasi dan media visual kontekstual."
      ]),
      `<h3>E. Lingkungan Belajar</h3>`,
      renderBullets([
        "Ruang Fisik: Penataan tempat duduk kelompok yang fleksibel, sirkulasi udara baik, pencahayaan nyaman, dan sarana mudah diakses.",
        "Ruang Virtual / Media: Media visual disajikan secara jelas, terarah, dan ramah anak.",
        "Budaya Belajar: Menumbuhkan rasa saling menghormati, keterbukaan dalam menyampaikan ide, keberanian berpendapat tanpa takut salah, dan semangat gotong royong."
      ]),
      `<h3>F. Pertanyaan Pemantik</h3>`,
      renderBullets(pemantik),
      `<h3>G. Pembelajaran Berdiferensiasi</h3>`,
      renderBullets([
        `Diferensiasi Proses: Guru memberikan bimbingan bertahap (scaffolding: ${escapeHTML(plan.tindakLanjut.support || "panduan pertanyaan pemandu")}) bagi kelompok yang memerlukan bantuan, serta tantangan eksplorasi mandiri bagi peserta didik yang bergerak lebih cepat.`,
        "Diferensiasi Produk: Peserta didik diberikan keleluasaan dalam menyajikan pemahaman hasil diskusi/pengamatan (misalnya melalui paparan lisan, lembar kerja kelompok, atau representasi visual/gambar)."
      ]),
      `<h3>H. Urutan Kegiatan Pembelajaran</h3>`,
      `<div class="gadm-learning-scenario">`,
      `<h4>1. Kegiatan Awal / Pendahuluan (${timeIntro})</h4>`,
      renderBullets([
        "Berkesadaran (Mindful): Guru mengkondisikan kelas, memberi salam hangat, memimpin doa bersama, mengecek kehadiran, dan memastikan kesiapan belajar peserta didik.",
        "Apersepsi: Guru mengaitkan materi pembelajaran dengan pengalaman nyata sehari-hari murid atau materi sebelumnya melalui tanya jawab kontekstual.",
        "Menggembirakan (Joyful): Guru memberikan motivasi berupa yel-yel penyemangat, tepuk fokus, atau ice breaking singkat untuk membangun antusiasme.",
        "Penyampaian Tujuan: Guru menjelaskan tujuan pembelajaran hari ini, alur kegiatan belajar yang akan dilalui, serta kesepakatan belajar kelompok."
      ]),
      `<h4>2. Kegiatan Inti (${timeCore})</h4>`,
      `<p>Pelaksanaan kegiatan inti mengacu pada sintaks model <strong>${escapeHTML(model.label)}</strong> yang mengintegrasikan pengalaman belajar <em>Memahami</em>, <em>Mengaplikasi</em>, dan <em>Merefleksi</em>:</p>`,
      renderTable(["Tahap", "Sintaks Pembelajaran", "Aktivitas dan Eksplorasi Pembelajaran", "Pengalaman Belajar"], syntaxRows),
      `<h4>3. Kegiatan Penutup (${timeClosing})</h4>`,
      renderBullets([
        "Refleksi & Rangkuman: Guru bersama peserta didik merangkum poin-poin penting yang telah dipelajari hari ini.",
        "Peserta didik menyampaikan refleksi singkat mengenai kegiatan yang paling bermakna dan berkesan.",
        "Apresiasi & Penguatan: Guru memberikan apresiasi atas kerja sama tim seluruh murid serta menyampaikan pesan moral karakter.",
        "Tindak Lanjut: Guru menyampaikan pengantar rencana topik belajar untuk pertemuan berikutnya.",
        "Penutup: Pembelajaran diakhiri dengan doa bersama penuh syukur dan salam penutup."
      ]),
      `</div>`,
      `</section>`,

      `<section><h2>III. ASESMEN PEMBELAJARAN</h2>`,
      renderKeyValue([
        ["Asesmen Awal (Diagnostik)", `Observasi kesiapan belajar non-kognitif serta tanya jawab lisan kognitif awal (${escapeHTML(plan.asesmen.awal)})`],
        ["Asesmen Formatif (Proses)", `Observasi keterlibatan diskusi, kinerja kerja sama kelompok, dan lembar catatan proses (${escapeHTML(plan.asesmen.proses)})`],
        ["Asesmen Sumatif (Akhir)", `Uji pemahaman mandiri tertulis / penugasan performa di akhir lingkup materi (${escapeHTML(plan.asesmen.akhir)})`]
      ]),
      profileRows.length ? `<h3>Fokus Dimensi Profil Pelajar Pancasila yang Diamati</h3>${renderTable(["Dimensi", "Indikator Ketercapaian yang Diamati"], profileRows)}` : "",
      `</section>`,

      `<section><h2>IV. PROGRAM PENGAYAAN DAN REMEDIAL</h2>`,
      renderBullets([
        "Program Pengayaan: Diberikan kepada peserta didik yang telah mencapai kriteria ketuntasan tujuan pembelajaran untuk memperluas dan memperdalam wawasan materi melalui tugas eksplorasi kontekstual tingkat tinggi (HOTS) atau menjadi tutor sebaya bagi temannya.",
        `Program Remedial: Diberikan kepada peserta didik yang membutuhkan bimbingan tambahan dalam memahami indikator tertentu melalui pendampingan terbimbing secara perorangan atau kelompok kecil (guided scaffolding) dengan bantuan ${escapeHTML(plan.tindakLanjut.support || "penjelasan ulang konsep kunci")}.`
      ]),
      `</section>`,

      `<section><h2>V. REFLEKSI GURU DAN PESERTA DIDIK</h2>`,
      `<h3>A. Refleksi Guru</h3>`,
      renderBullets([
        "Apakah tujuan pembelajaran hari ini tercapai secara optimal oleh seluruh peserta didik?",
        "Bagian alur kegiatan pembelajaran mana yang paling disukai dan paling efektif bagi peserta didik?",
        "Kesulitan atau hambatan apa yang ditemukan selama memfasilitasi proses pembelajaran?",
        "Apakah diferensiasi proses dan pendampingan bertahap (scaffolding) telah berjalan efektif?",
        "Langkah perbaikan apa yang perlu disiapkan untuk diterapkan pada pertemuan berikutnya?"
      ]),
      `<h3>B. Refleksi Peserta Didik</h3>`,
      renderBullets([
        "Apa hal baru dan paling menarik yang kalian pelajari hari ini?",
        "Bagian mana dari pelajaran hari ini yang masih terasa menantang atau perlu dipelajari lagi?",
        "Bagaimana perasaan kalian setelah bekerja sama dan menyelesaikan kegiatan bersama teman sekelompok?"
      ]),
      `</section>`,

      renderApprovalBlock(input),
      renderIssues(validation)
    ].join("");

    const text = [
      "MODUL AJAR KURIKULUM MERDEKA",
      `PEMBELAJARAN MENDALAM (DEEP LEARNING) — ${schoolName.toUpperCase()}`,
      "",
      "I. INFORMASI UMUM",
      `Satuan Pendidikan: ${schoolName}`,
      `Nama Guru: ${teacherName}`,
      `Tahun Pelajaran: ${academicYear}`,
      `Semester: ${semester}`,
      `Fase / Kelas: ${phaseLabel} / Kelas ${input.kelasAtauFase}`,
      `Mata Pelajaran: ${input.mataPelajaran || "-"}`,
      `Materi Pokok: ${topic}`,
      `Alokasi Waktu: ${timeAlloc}`,
      "",
      "A. Kompetensi Awal",
      kompetensiAwal,
      "",
      "B. Profil Pelajar Pancasila",
      ...(profileLabels.length ? profileLabels : ["Beriman, Bertakwa kepada Tuhan YME", "Bernalar Kritis", "Gotong Royong", "Mandiri"]).map((p) => `- ${p}`),
      "",
      "C. Sarana dan Prasarana",
      `- Media: ${joinNatural(media.length ? media : ["Media visual konkret", "Kartu gambar", "Proyektor LCD"])}`,
      `- Sumber Belajar: Buku Siswa dan Buku Guru ${input.mataPelajaran || "Kemendikbudristek"}, lingkungan sekitar`,
      `- Alat dan Bahan: Alat tulis, lembar eksplorasi kerja`,
      "",
      "D. Target Peserta Didik",
      "- Peserta didik reguler/tipikal",
      "- Peserta didik pencapaian tinggi",
      "- Peserta didik membutuhkan bimbingan (scaffolding)",
      "",
      "E. Pendekatan, Model, dan Metode",
      "Pendekatan: Deep Learning (Mindful, Meaningful, Joyful)",
      `Model: ${model.label}`,
      `Metode: ${joinNatural(methods.map((item) => item.label))}`,
      "",
      "II. KOMPONEN INTI",
      "A. Capaian Pembelajaran (CP)",
      input.cpResmiAtauManual || input.cpAtauTp || "-",
      "",
      "B. Tujuan Pembelajaran (TP)",
      input.tujuanPembelajaran || input.tujuan || input.cpAtauTp || "-",
      "",
      "C. Pemahaman Bermakna",
      pemahamanBermakna,
      "",
      "D. Pertanyaan Pemantik",
      ...pemantik.map((q, i) => `${i + 1}. ${q}`),
      "",
      "E. Pembelajaran Berdiferensiasi",
      `- Proses: Pendampingan bertahap (scaffolding: ${plan.tindakLanjut.support || "panduan terarah"}) dan eksplorasi mandiri.`,
      "- Produk: Ragam penyajian lisan, catatan lembar kerja, atau visual kelompok.",
      "",
      "F. Urutan Kegiatan Pembelajaran",
      `1. Pendahuluan (${timeIntro}): Orientasi mindful, salam & doa, apersepsi kontekstual, motivasi joyful, dan penyampaian tujuan.`,
      `2. Kegiatan Inti (${timeCore}): Mengacu pada sintaks model ${model.label}:`,
      `   - Memahami: ${plan.memahami}`,
      `   - Mengaplikasi: ${plan.mengaplikasi}`,
      `   - Merefleksi: ${plan.merefleksi}`,
      `3. Penutup (${timeClosing}): Refleksi bersama, kesimpulan materi, apresiasi guru, pesan karakter, rencana tindak lanjut, dan doa penutup.`,
      "",
      "III. ASESMEN PEMBELAJARAN",
      `Awal (Diagnostik): ${plan.asesmen.awal}`,
      `Proses (Formatif): ${plan.asesmen.proses}`,
      `Akhir (Sumatif): ${plan.asesmen.akhir}`,
      "",
      "IV. PROGRAM PENGAYAAN DAN REMEDIAL",
      "Pengayaan: Pendalaman konsep dan tugas eksploratif (HOTS) bagi peserta didik yang tuntas.",
      `Remedial: Pendampingan terfokus secara individu/kelompok kecil (scaffolding) dengan ${plan.tindakLanjut.support || "bimbingan bertahap"}.`,
      "",
      "V. REFLEKSI GURU DAN PESERTA DIDIK",
      "Refleksi Guru: Evaluasi ketercapaian tujuan, efektivitas waktu, respon antusiasme murid, dan adaptasi pembelajaran.",
      "Refleksi Murid: Kesan belajar, hal bermakna yang dipahami, serta hal yang masih perlu dilatih.",
      "",
      "VI. PENGESAHAN",
      `Mengetahui: Kepala Satuan Pendidikan | Guru: ${teacherName}`
    ].filter(Boolean).join("\n");

    return resultFromHTML("modulAjar", "Modul Ajar Pembelajaran Mendalam", html, text, validation, built);
  }

  function generateProta(input) {
    const base = validateDocumentInput("prota", input);
    const rows = parsePipeRows(input.cpAtpTp, { columns: 3 });
    const errors = [...base.errors];
    const warnings = [...base.warnings];
    const parsed = rows.map((row) => ({
      unit: row.parts[0],
      jp: parsePositiveNumber(row.parts[1]),
      semester: normalizeText(row.parts[2])
    }));

    if (parsed.length === 0) errors.push(makeIssue("PROTA_UNIT_MISSING", "Daftar CP/ATP/TP belum tersedia.", "cpAtpTp"));
    parsed.forEach((row, index) => {
      if (!row.unit) errors.push(makeIssue("PROTA_UNIT_EMPTY", `Baris ${index + 1}: unit/TP kosong.`, "cpAtpTp"));
      if (!row.jp) errors.push(makeIssue("PROTA_JP_MISSING", `Baris ${index + 1}: alokasi JP wajib ditulis agar GADM tidak mengarang distribusi waktu.`, "cpAtpTp"));
      if (!/^(1|2|ganjil|genap)$/i.test(row.semester)) errors.push(makeIssue("PROTA_SEMESTER_MISSING", `Baris ${index + 1}: semester harus 1/2 atau ganjil/genap.`, "cpAtpTp"));
    });

    const totalRows = parsed.reduce((sum, row) => sum + (row.jp || 0), 0);
    const annual = parsePositiveNumber(input.alokasiJamTahunan);
    if (annual && parsed.every((row) => row.jp) && Math.abs(totalRows - annual) > 0.0001) {
      errors.push(makeIssue("PROTA_TOTAL_MISMATCH", `Jumlah alokasi unit (${formatNumber(totalRows)} JP) tidak sama dengan alokasi tahunan (${formatNumber(annual)} JP).`, "alokasiJamTahunan"));
    }

    const validation = { ok: errors.length === 0, errors, warnings };
    if (!validation.ok) {
      return resultFromHTML("prota", "Program Tahunan", `${renderHeader("Program Tahunan — Belum Dapat Digenerasi")}${renderIssues(validation)}`, ["PROGRAM TAHUNAN — GENERASI DIBLOKIR", ...errors.map((item) => `- ${item.message}`)].join("\n"), validation);
    }

    const tableRows = parsed.map((row, index) => [String(index + 1), row.semester, row.unit, `${formatNumber(row.jp)} JP`, ""]);
    const html = [
      renderHeader("Program Tahunan (Prota)", `${input.tahunPelajaran} • ${input.mataPelajaran}`),
      renderFormatBasis("prota"),
      renderKeyValue([
        ["Satuan Pendidikan", input.namaSekolah],
        ["Nama Guru", input.namaGuru],
        ["Tahun Pelajaran", input.tahunPelajaran],
        ["Kelas/Fase", input.kelasAtauFase],
        ["Mata Pelajaran", input.mataPelajaran],
        ["Total Alokasi", `${formatNumber(annual)} JP`],
        ["Basis Kalender/Minggu Efektif", input.kalenderPendidikanAtauMingguEfektif]
      ]),
      renderTable(["No.", "Semester", "Lingkup Materi / TP / Unit", "Alokasi Waktu", "Keterangan"], tableRows),
      `<p class="gadm-doc-note"><strong>Total alokasi tahunan:</strong> ${escapeHTML(formatNumber(totalRows))} JP. Distribusi waktu sepenuhnya mengikuti alokasi guru dan kalender pendidikan; GADM tidak menciptakan minggu efektif atau JP.</p>`,
      renderApprovalBlock(input)
    ].join("");

    const text = [
      "PROGRAM TAHUNAN (PROTA)",
      `Tahun Pelajaran: ${input.tahunPelajaran}`,
      `Kelas/Fase: ${input.kelasAtauFase}`,
      `Mata Pelajaran: ${input.mataPelajaran}`,
      `Total Alokasi: ${formatNumber(annual)} JP`,
      `Basis Kalender/Minggu Efektif: ${input.kalenderPendidikanAtauMingguEfektif}`,
      "",
      ...parsed.map((row, index) => `${index + 1}. ${row.unit} | ${formatNumber(row.jp)} JP | Semester ${row.semester}`)
    ].join("\n");
    return resultFromHTML("prota", "Program Tahunan", html, text, validation, { rows: parsed, total: totalRows });
  }

  function generatePromes(input) {
    const base = validateDocumentInput("promes", input);
    const rows = parsePipeRows(input.tpAtauUnitSemester, { columns: 3 });
    const errors = [...base.errors];
    const warnings = [...base.warnings];
    const parsed = rows.map((row) => ({ unit: row.parts[0], jp: parsePositiveNumber(row.parts[1]), periode: normalizeText(row.parts[2]) }));

    if (parsed.length === 0) errors.push(makeIssue("PROMES_UNIT_MISSING", "Daftar TP/unit semester belum tersedia.", "tpAtauUnitSemester"));
    parsed.forEach((row, index) => {
      if (!row.unit) errors.push(makeIssue("PROMES_UNIT_EMPTY", `Baris ${index + 1}: TP/unit kosong.`, "tpAtauUnitSemester"));
      if (!row.jp) errors.push(makeIssue("PROMES_JP_MISSING", `Baris ${index + 1}: alokasi JP wajib ditulis.`, "tpAtauUnitSemester"));
      if (!row.periode) errors.push(makeIssue("PROMES_PERIOD_MISSING", `Baris ${index + 1}: periode/minggu harus berasal dari kalender yang Anda masukkan.`, "tpAtauUnitSemester"));
    });

    const validation = { ok: errors.length === 0, errors, warnings };
    if (!validation.ok) {
      return resultFromHTML("promes", "Program Semester", `${renderHeader("Program Semester — Belum Dapat Digenerasi")}${renderIssues(validation)}`, ["PROGRAM SEMESTER — GENERASI DIBLOKIR", ...errors.map((item) => `- ${item.message}`)].join("\n"), validation);
    }

    const total = parsed.reduce((sum, row) => sum + row.jp, 0);
    const html = [
      renderHeader("Program Semester (Promes)", `Semester ${input.semester}`),
      renderFormatBasis("promes"),
      renderKeyValue([
        ["Satuan Pendidikan", input.namaSekolah],
        ["Nama Guru", input.namaGuru],
        ["Tahun Pelajaran", input.tahunPelajaran],
        ["Kelas/Fase", input.kelasAtauFase],
        ["Mata Pelajaran", input.mataPelajaran],
        ["Semester", input.semester],
        ["Minggu Efektif", input.mingguEfektifSemester],
        ["Referensi Prota", input.hasilProtaAtauDistribusiTahunan]
      ]),
      renderTable(["No.", "Bulan / Minggu", "Tujuan Pembelajaran / Unit", "Alokasi Waktu", "Asesmen", "Keterangan"], parsed.map((row, index) => [String(index + 1), row.periode, row.unit, `${formatNumber(row.jp)} JP`, "Disesuaikan dengan bukti belajar pada TP", ""])),
      `<p class="gadm-doc-note"><strong>Total alokasi semester:</strong> ${escapeHTML(formatNumber(total))} JP. Periode hanya menggunakan data kalender dan Prota yang dimasukkan guru.</p>`,
      renderApprovalBlock(input)
    ].join("");

    const text = [
      "PROGRAM SEMESTER (PROMES)",
      `Semester: ${input.semester}`,
      `Minggu Efektif: ${input.mingguEfektifSemester}`,
      `Referensi Prota: ${input.hasilProtaAtauDistribusiTahunan}`,
      "",
      ...parsed.map((row, index) => `${index + 1}. ${row.unit} | ${formatNumber(row.jp)} JP | ${row.periode}`),
      `Total: ${formatNumber(total)} JP`
    ].join("\n");
    return resultFromHTML("promes", "Program Semester", html, text, validation, { rows: parsed, total });
  }

  function generateSilabus(input, seed) {
    const base = validateDocumentInput("silabus", input);
    const errors = [...base.errors];
    const warnings = [...base.warnings];
    const phase = resolvePhase(input.kelasAtauFase);
    if (!phase) errors.push(makeIssue("PHASE_INVALID", "Kelas/fase tidak valid.", "kelasAtauFase"));

    const targets = asList(input.cpAtauTp);
    if (targets.length === 0) errors.push(makeIssue("SILABUS_TARGET_MISSING", "CP/TP belum tersedia.", "cpAtauTp"));
    const materials = asList(input.materiAtauLingkup || input.materiAtauUnit);
    const curriculum = phase ? resolveCurriculumGrounding(input, phase) : null;
    if (curriculum?.provenance === "teacher_supplied_unverified_text") warnings.push(makeIssue("CURRICULUM_TEXT_UNVERIFIED", "CP/TP berasal dari input guru dan belum diverifikasi sebagai salinan teks resmi oleh corpus tertanam GADM.", "cpAtauTp", "warning"));
    const validation = { ok: errors.length === 0, errors, warnings };
    if (!validation.ok) {
      return resultFromHTML("silabus", "Silabus Operasional", `${renderHeader("Silabus — Belum Dapat Digenerasi")}${renderIssues(validation)}`, ["SILABUS — GENERASI DIBLOKIR", ...errors.map((item) => `- ${item.message}`)].join("\n"), validation, { curriculum });
    }

    const teacherContext = buildTeacherContext(input, phase);
    const { model, recommendations } = resolveModel(input, phase, seed, teacherContext);
    const methods = resolveMethods(phase, [input.cpAtauTp, input.materiAtauLingkup, input.materiAtauUnit, input.kondisiAwalMurid].join(" | "), seed, 2, teacherContext);
    const media = resolveMedia(phase, seed, 2, teacherContext, input.mediaPembelajaran);
    const decisionExplanations = buildDecisionExplanations({ model, media, profiles: [], assessments: GADM_KB.asesmen.moments.proses.examples, context: { phase, tujuan: input.cpAtauTp, aktivitas: input.materiAtauLingkup, sumberDaya: input.sumberDaya, kondisiAwalMurid: input.kondisiAwalMurid } });
    const rows = targets.map((target, index) => {
      const material = materials[index] || materials[0] || normalizeText(input.materiAtauUnit || input.materiAtauLingkup);
      const activity = deterministicPick(GADM_KB.kegiatanKontekstual.meaningfulByPhase[phase], `${seed}:silabus:activity:${index}`);
      const evidence = deterministicPick(GADM_KB.asesmen.moments.proses.examples, `${seed}:silabus:evidence:${index}`);
      return [target, material, model.label, joinNatural(methods.map((item) => item.label)), activity, evidence, joinNatural(media), input.alokasiWaktu];
    });

    const html = [
      renderHeader("Silabus / ATP Operasional", `${input.mataPelajaran} • ${GADM_KB.faseMap[phase].label}`),
      renderFormatBasis("silabus"),
      renderKeyValue([["Satuan Pendidikan", input.namaSekolah], ["Nama Guru", input.namaGuru], ["Tahun Pelajaran", input.tahunPelajaran], ["Kelas/Fase", input.kelasAtauFase], ["Mata Pelajaran", input.mataPelajaran], ["Alokasi Waktu", input.alokasiWaktu]]),
      renderCurriculumGrounding(curriculum),
      renderTeacherContext(teacherContext),
      `<p class="gadm-doc-note">Susunan ini adalah format kerja guru yang fleksibel, bukan klaim format nasional wajib. Urutan tujuan harus tetap logis dan dapat dituntaskan dalam fase.</p>`,
      renderTable(["CP / Tujuan Pembelajaran", "Lingkup Materi", "Praktik Pedagogis", "Metode", "Aktivitas Pembelajaran", "Asesmen / Bukti", "Media / Sumber", "Alokasi"], rows),
      renderDecisionExplanations(decisionExplanations),
      renderIssues(validation),
      renderApprovalBlock(input)
    ].join("");
    const text = [
      "SILABUS OPERASIONAL", `Mata Pelajaran: ${input.mataPelajaran}`, `Kelas/Fase: ${input.kelasAtauFase}`, `Alokasi Waktu: ${input.alokasiWaktu}`, `Model: ${model.label}`,
      `Metode: ${joinNatural(methods.map((item) => item.label))}`, `Media: ${joinNatural(media)}`, "", ...rows.map((row, index) => `${index + 1}. ${row.join(" | ")}`)
    ].join("\n");
    return resultFromHTML("silabus", "Silabus Operasional", html, text, validation, { rows, curriculum, teacherContext, model, recommendations, methods, media, decisionExplanations });
  }

  function resolveDimensionEntries(rawValue) {
    const dimensions = GADM_KB.profilLulusan.dimensions;
    const requested = String(rawValue ?? "").split(/[;,\n]/).map(normalizeId).filter(Boolean);
    return Object.entries(dimensions)
      .filter(([key, dimension]) => requested.some((item) => [normalizeId(key), normalizeId(dimension.label)].includes(item)))
      .map(([key, value]) => ({ key, ...value }));
  }

  function generateKokurikuler(input, seed) {
    const base = validateDocumentInput("deskripsiKokurikuler", input);
    const errors = [...base.errors];
    const warnings = [...base.warnings];
    const dimensions = resolveDimensionEntries(input.targetDimensi);
    if (dimensions.length === 0) errors.push(makeIssue("KOKURIKULER_DIMENSION_UNKNOWN", "Target dimensi belum cocok dengan 8 Dimensi Profil Lulusan di KB.", "targetDimensi"));
    const validation = { ok: errors.length === 0, errors, warnings };
    if (!validation.ok) {
      return resultFromHTML("deskripsiKokurikuler", "Deskripsi Kokurikuler", `${renderHeader("Deskripsi Kokurikuler — Belum Dapat Digenerasi")}${renderIssues(validation)}`, ["DESKRIPSI KOKURIKULER — GENERASI DIBLOKIR", ...errors.map((item) => `- ${item.message}`)].join("\n"), validation);
    }

    const safeClaim = deterministicPick(GADM_KB.languageEngine.claimLexicon.safeWithoutEvidence, `${seed}:kokurikuler:claim`);
    const description = assembler.assemble([
      "Kegiatan {kegiatan} {safeClaim} {dimensions}.",
      "Bukti observasi yang menjadi dasar deskripsi adalah: {evidence}."
    ], {
      kegiatan: input.kegiatan,
      safeClaim,
      dimensions: joinNatural(dimensions.map((item) => item.label)),
      evidence: input.evidenceObservasi
    }, `${seed}:kokurikuler`);

    const html = [
      renderHeader("Deskripsi Kokurikuler"),
      renderKeyValue([["Satuan Pendidikan", input.namaSekolah], ["Nama Guru", input.namaGuru], ["Tahun Pelajaran", input.tahunPelajaran], ["Kelas", input.kelasAtauFase], ["Kegiatan", input.kegiatan], ["Target Dimensi", joinNatural(dimensions.map((item) => item.label))]]),
      `<section><h2>Deskripsi Berbasis Bukti</h2><p>${escapeHTML(description)}</p></section>`,
      `<section><h2>Batas Klaim</h2><p>${escapeHTML(GADM_KB.profilLulusan.claimRule)}</p></section>`,
      renderApprovalBlock(input)
    ].join("");
    return resultFromHTML("deskripsiKokurikuler", "Deskripsi Kokurikuler", html, description, validation, { dimensions });
  }

  function normalizeAchievementState(value) {
    const id = normalizeId(value);
    const aliases = {
      sangat_baik: "sangatBaik",
      sangatbaik: "sangatBaik",
      optimal: "sangatBaik",
      tercapai: "tercapai",
      baik: "tercapai",
      berkembang: "berkembang",
      mulai_berkembang: "berkembang",
      perlu_bimbingan: "perluBimbingan",
      perlubimbingan: "perluBimbingan",
      bimbingan: "perluBimbingan"
    };
    return aliases[id] || null;
  }

  function generateERapor(input, seed) {
    const base = validateDocumentInput("deskripsiERapor", input);
    const evidenceReport = validateERaporEvidence(input);
    const errors = [...base.errors, ...evidenceReport.errors];
    const warnings = [...base.warnings, ...evidenceReport.warnings];
    const stateKey = normalizeAchievementState(input.statusCapaian);
    if (!stateKey || !GADM_KB.erapor.achievementStates[stateKey]) errors.push(makeIssue("ERAPOR_STATUS_UNKNOWN", "Status capaian harus Sangat Baik, Tercapai, Berkembang, atau Perlu Bimbingan.", "statusCapaian"));
    const validation = { ok: errors.length === 0, errors, warnings };
    if (!validation.ok) {
      return resultFromHTML("deskripsiERapor", "Deskripsi e-Rapor", `${renderHeader("Deskripsi e-Rapor — Belum Dapat Digenerasi")}${renderIssues(validation)}`, ["DESKRIPSI E-RAPOR — GENERASI DIBLOKIR", ...errors.map((item) => `- ${item.message}`)].join("\n"), validation);
    }

    const stateConfig = GADM_KB.erapor.achievementStates[stateKey];
    const plan = deterministicPick(stateConfig.sentencePlans, `${seed}:erapor:plan`);
    const fallbackNext = deterministicPick(GADM_KB.scaffolding.supports.proses, `${seed}:erapor:next`);
    const competence = normalizeText(input.kompetensi || input.materiAtauTP);
    const description = assembler.resolve(plan, {
      kompetensi: competence,
      materi: input.materiAtauTP,
      bukti: input.evidence,
      tindakLanjut: input.nextStep || fallbackNext
    }, `${seed}:erapor`);

    const optionalObservation = normalizeText(input.teacherObservation);
    const finalText = optionalObservation ? `${ensureSentence(description)} ${ensureSentence(optionalObservation)}` : ensureSentence(description);
    const html = [
      renderHeader("Deskripsi Nilai e-Rapor"),
      renderKeyValue([["Materi/TP", input.materiAtauTP], ["Status Capaian", input.statusCapaian], ["Bukti", input.evidence]]),
      `<section><h2>Deskripsi</h2><p class="gadm-erapor-text">${escapeHTML(finalText)}</p></section>`,
      warnings.length ? renderIssues({ ok: true, errors: [], warnings }) : ""
    ].join("");
    return resultFromHTML("deskripsiERapor", "Deskripsi e-Rapor", html, finalText, validation, { stateKey });
  }

  function generateLKPDRubrik(input, seed) {
    const base = validateDocumentInput("lkpdRubrik", input);
    const errors = [...base.errors];
    const warnings = [...base.warnings];
    const validation = { ok: errors.length === 0, errors, warnings };
    if (!validation.ok) {
      return resultFromHTML(
        "lkpdRubrik",
        "LKPD & Rubrik Penilaian",
        `${renderHeader("LKPD & Rubrik Penilaian — Belum Dapat Digenerasi")}${renderIssues(validation)}`,
        ["LKPD & RUBRIK PENILAIAN — GENERASI DIBLOKIR", ...errors.map((item) => `- ${item.message}`)].join("\n"),
        validation
      );
    }

    const schoolName = input.namaSekolah || "SDIT Bina Muda";
    const teacherName = input.namaGuru || "Guru Kelas / Mata Pelajaran";
    const academicYear = input.tahunPelajaran || "2024/2025";
    const semester = input.semester || "1 (Ganjil)";
    const phase = resolvePhase(input.kelasAtauFase || input.phase || input.kelas);
    const phaseLabel = GADM_KB.faseMap[phase]?.label || "Fase B";
    const topic = normalizeText(input.materiAtauUnit) || "Materi Pembelajaran";
    const timeAlloc = input.alokasiWaktu || input.lkpdAlokasi || "30 Menit (1 Pertemuan)";
    const tpText = input.tujuanPembelajaran || input.tujuan || input.cpAtauTp || `Peserta didik mampu memahami dan menyajikan hasil pengamatan terkait materi ${topic} secara mandiri maupun kolaboratif.`;
    const activityType = input.lkpdAktivitas || "Pengamatan Langsung dan Diskusi Kelompok Terarah";
    const toolsAndMaterials = input.lkpdAlatBahan || "Alat tulis, lembar kerja pengamatan, dan benda/lingkungan konkret di sekitar kelas";
    const rawSteps = input.lkpdPetunjuk
      ? input.lkpdPetunjuk.split("\n").map((s) => s.trim()).filter(Boolean)
      : [
          "Bentuklah kelompok kecil beranggotakan 4–5 orang secara tertib.",
          "Bacalah setiap langkah kerja dan instruksi pada lembar ini bersama teman sekelompokmu.",
          `Lakukan eksplorasi/pengamatan terhadap objek atau fenomena ${topic} yang telah disiapkan.`,
          "Diskusikan hasil temuan kelompok dan catatlah secara rapi pada tabel pengamatan yang tersedia.",
          "Jawab pertanyaan pemandu diskusi dan rumuskan kesimpulan bersama kelompok.",
          "Presentasikan hasil kerja kelompok di depan kelas dengan penuh percaya diri."
        ];

    const rawRubricCriteria = input.rubrikKriteria
      ? input.rubrikKriteria.split("\n").map((c) => c.trim()).filter(Boolean)
      : [
          `Penguasaan Konsep (${topic})`,
          "Keterampilan Eksplorasi & Pengamatan Data",
          "Kerja Sama Tim & Keterlibatan Aktif",
          "Komunikasi & Penyampaian Hasil Diskusi"
        ];

    const rubricRows = rawRubricCriteria.map((crit) => {
      return [
        crit,
        "Belum menunjukkan pemahaman; memerlukan bimbingan penuh dari guru dan teman sejawat.",
        "Menunjukkan pemahaman dasar sebagian; masih memerlukan pengingat atau bantuan bertahap.",
        "Menunjukkan pemahaman yang baik, mandiri, dan mampu menyelesaikan tugas secara tepat.",
        "Sangat mandiri, akurat, bernalar kritis, dan mampu membantu atau membimbing teman sekelompok."
      ];
    });

    const html = [
      renderHeader("LEMBAR KERJA PESERTA DIDIK (LKPD)", `${schoolName.toUpperCase()} • TAHUN PELAJARAN ${academicYear}`),
      
      `<section><h2>I. IDENTITAS LEMBAR KERJA</h2>`,
      renderKeyValue([
        ["Satuan Pendidikan", schoolName],
        ["Mata Pelajaran", input.mataPelajaran || "-"],
        ["Fase / Kelas / Semester", `${phaseLabel} / Kelas ${input.kelasAtauFase} / Semester ${semester}`],
        ["Topik / Materi", topic],
        ["Alokasi Waktu", timeAlloc],
        ["Nama Kelompok / Anggota", "1. .....................  2. .....................  3. .....................  4. ....................."]
      ]),
      `</section>`,

      `<section><h2>II. TUJUAN PEMBELAJARAN</h2>`,
      `<div class="gadm-curriculum-text"><p>${escapeHTML(tpText)}</p></div>`,
      `</section>`,

      `<section><h2>III. ALAT DAN SUMBER BELAJAR</h2>`,
      `<p>${escapeHTML(toolsAndMaterials)}</p>`,
      `</section>`,

      `<section><h2>IV. PETUNJUK KERJA PESERTA DIDIK</h2>`,
      renderBullets(rawSteps),
      `</section>`,

      `<section><h2>V. LEMBAR AKTIVITAS & PENGAMATAN SISWA</h2>`,
      `<p><strong>Bentuk Aktivitas:</strong> ${escapeHTML(activityType)}</p>`,
      `<p>Amati dan lakukan pengamatan bersama kelompokmu, kemudian isilah tabel di bawah ini dengan cermat:</p>`,
      renderTable(
        ["No", "Objek / Aspek yang Diamati", "Hasil Pengamatan & Ciri yang Ditemukan", "Catatan Penjelasan"],
        [
          ["1", "Pengamatan 1 (Kondisi Awal / Contoh 1)", "", ""],
          ["2", "Pengamatan 2 (Perubahan / Contoh 2)", "", ""],
          ["3", "Pengamatan 3 (Penerapan Sehari-hari)", "", ""]
        ]
      ),
      `<h3>Pertanyaan Diskusi Pemandu:</h3>`,
      renderBullets([
        `Berdasarkan data di atas, apa hal paling menarik yang kalian temukan terkait ${topic}?`,
        "Mengapa hal tersebut dapat terjadi? Jelaskan alasan atau bukti yang kelompok kalian temukan!",
        `Apa kesimpulan utama yang dapat diambil oleh kelompok kalian mengenai ${topic}?`
      ]),
      `<div style="margin-top:14px;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;min-height:90px;background:#f8fafc;">`,
      `<strong>Ruang Kesimpulan Kelompok:</strong><br><br>`,
      `<span style="color:#94a3b8;font-size:11px;font-style:italic;">(Tuliskan rangkuman kesimpulan kelompokmu di sini)</span>`,
      `</div>`,
      `</section>`,

      `<section><h2>VI. RUBRIK PENILAIAN ASESMEN OTENTIK</h2>`,
      `<p>Pedoman penilaian kinerja dan proses ketercapaian tujuan pembelajaran:</p>`,
      renderTable(
        ["Kriteria Penilaian", "Skor 1 (Perlu Bimbingan)", "Skor 2 (Cukup)", "Skor 3 (Baik)", "Skor 4 (Sangat Baik)"],
        rubricRows
      ),
      `<div style="margin-top:10px;font-size:11px;color:#475569;background:#f1f5f9;padding:9px 12px;border-radius:8px;">`,
      `<strong>Pedoman Penskoran:</strong> Nilai Akhir = (Total Skor Perolehan / Total Skor Maksimal [${rawRubricCriteria.length * 4}]) × 100`,
      `</div>`,
      `</section>`,

      renderApprovalBlock(input)
    ].join("");

    const text = [
      "LEMBAR KERJA PESERTA DIDIK (LKPD) & RUBRIK PENILAIAN",
      `${schoolName.toUpperCase()} — TAHUN PELAJARAN ${academicYear}`,
      "",
      "I. IDENTITAS",
      `Satuan Pendidikan: ${schoolName}`,
      `Mata Pelajaran: ${input.mataPelajaran || "-"}`,
      `Fase / Kelas / Semester: ${phaseLabel} / Kelas ${input.kelasAtauFase} / Semester ${semester}`,
      `Topik / Materi: ${topic}`,
      `Alokasi Waktu: ${timeAlloc}`,
      "Nama Kelompok / Anggota: ......................................................",
      "",
      "II. TUJUAN PEMBELAJARAN",
      tpText,
      "",
      "III. ALAT DAN SUMBER BELAJAR",
      toolsAndMaterials,
      "",
      "IV. PETUNJUK KERJA PESERTA DIDIK",
      ...rawSteps.map((s, i) => `${i + 1}. ${s}`),
      "",
      "V. LEMBAR AKTIVITAS SISWA",
      `Bentuk Aktivitas: ${activityType}`,
      "Tabel Pengamatan: [Tersedia format pengamatan dan pertanyaan pemandu diskusi]",
      "",
      "VI. RUBRIK PENILAIAN ASESMEN OTENTIK",
      ...rawRubricCriteria.map((c, i) => `${i + 1}. Kriteria: ${c} (Skala Skor 1–4)`),
      "",
      `VII. PENGESAHAN: Guru: ${teacherName}`
    ].filter(Boolean).join("\n");

    return resultFromHTML("lkpdRubrik", "LKPD & Rubrik Penilaian", html, text, validation);
  }

  function generateDocument(rawInput) {
    const input = normalizeHostInput(rawInput);
    const type = normalizeText(input.documentType);
    const seed = normalizeText(input.seed) || [type, input.kelasAtauFase, input.mataPelajaran, input.materiAtauUnit, input.materiAtauTP, state.variation].filter(Boolean).join("|");
    let result;
    switch (type) {
      case "modulAjar": result = generateModule(input, seed); break;
      case "prota": result = generateProta(input, seed); break;
      case "promes": result = generatePromes(input, seed); break;
      case "silabus": result = generateSilabus(input, seed); break;
      case "deskripsiKokurikuler": result = generateKokurikuler(input, seed); break;
      case "deskripsiERapor": result = generateERapor(input, seed); break;
      case "lkpdRubrik": result = generateLKPDRubrik(input, seed); break;
      default: {
        const validation = { ok: false, errors: [makeIssue("DOCUMENT_TYPE_UNKNOWN", `Jenis dokumen '${type}' tidak dikenali.`)], warnings: [] };
        result = resultFromHTML(type, "GADM", `${renderHeader("GADM")}${renderIssues(validation)}`, validation.errors[0].message, validation);
      }
    }
    if (result) registerDocument(type, input, result);
    return result;
  }

  function inspectTeacherIntelligence(input = {}) {
    const phase = resolvePhase(input.kelasAtauFase || input.phase || input.kelas);
    if (!phase) return { ok: false, errors: [makeIssue("PHASE_INVALID", "Kelas/fase tidak valid.", "kelasAtauFase")], warnings: [] };
    const curriculum = resolveCurriculumGrounding(input, phase);
    const teacherContext = buildTeacherContext(input, phase);
    const { model, recommendations, source } = resolveModel(input, phase, normalizeText(input.seed) || "teacher-intelligence", teacherContext);
    const timeInput = parseTimeAllocation(input);
    const timePlan = planLessonTime({ phase, modelId: model.id, totalMinutes: timeInput.totalMinutes, jp: timeInput.jp, minutesPerJP: timeInput.minutesPerJP });
    const profiles = resolveProfileDimensions(input.targetProfilLulusan, phase, normalizeText(input.seed) || "teacher-intelligence", {
      tujuan: input.tujuan || input.cpAtauTp,
      aktivitas: input.aktivitas,
      buktiBelajar: input.buktiBelajar,
      model: model.label
    });
    return { ok: true, phase, curriculum, teacherContext, model, modelSource: source, recommendations, timePlan, profiles };
  }

  function validateCurrentBundle(bundle = state.documentBundle) {
    return validateCrossDocumentConsistency(bundle);
  }

  function resetDocumentBundle() {
    state.documentBundle = {};
    return { ok: true };
  }

  function collectInput(root = document) {
    const get = (id) => root.querySelector(`#${id}`)?.value ?? "";
    const cpText = normalizeMultiline(get("gadm-cp-tp"));
    const tpText = normalizeMultiline(get("gadm-tp-manual"));
    return {
      documentType: get("gadm-document-type"),
      seed: get("gadm-seed"),
      namaSekolah: get("gadm-nama-sekolah"),
      namaGuru: get("gadm-nama-guru"),
      kelasAtauFase: get("gadm-kelas-fase"),
      mataPelajaran: get("gadm-mata-pelajaran"),
      materiAtauUnit: get("gadm-materi-unit"),
      materiAtauLingkup: get("gadm-materi-lingkup"),
      curriculumRecordId: get("gadm-curriculum-record-id"),
      cpAtauTp: [cpText ? `CP: ${cpText}` : "", tpText ? `TP: ${tpText}` : ""].filter(Boolean).join("\n\n"),
      cpResmiAtauManual: cpText,
      tujuanPembelajaran: tpText,
      alokasiWaktu: get("gadm-alokasi-waktu"),
      totalMinutes: get("gadm-total-menit"),
      jp: get("gadm-jp"),
      minutesPerJP: get("gadm-menit-per-jp"),
      mediaPembelajaran: get("gadm-media"),
      tujuan: get("gadm-tujuan"),
      buktiBelajar: get("gadm-bukti-belajar"),
      kondisiAwalMurid: get("gadm-kondisi-awal"),
      sumberDaya: get("gadm-sumber-daya"),
      konteksSekolah: get("gadm-konteks-sekolah"),
      targetProfilLulusan: get("gadm-target-profil"),
      modelPembelajaran: get("gadm-model"),
      tahunPelajaran: get("gadm-tahun-pelajaran"),
      cpAtpTp: get("gadm-prota-unit"),
      alokasiJamTahunan: get("gadm-prota-total-jp"),
      kalenderPendidikanAtauMingguEfektif: get("gadm-kalender-efektif"),
      semester: get("gadm-semester"),
      hasilProtaAtauDistribusiTahunan: get("gadm-referensi-prota"),
      mingguEfektifSemester: get("gadm-minggu-efektif-semester"),
      tpAtauUnitSemester: get("gadm-promes-unit"),
      kegiatan: get("gadm-kegiatan-kokurikuler"),
      targetDimensi: get("gadm-target-dimensi"),
      evidenceObservasi: get("gadm-evidence-kokurikuler"),
      materiAtauTP: get("gadm-erapor-materi"),
      statusCapaian: get("gadm-erapor-status"),
      evidence: get("gadm-erapor-evidence"),
      kompetensi: get("gadm-erapor-kompetensi"),
      nextStep: get("gadm-erapor-next-step"),
      teacherObservation: get("gadm-erapor-observation"),
      lkpdAktivitas: get("gadm-lkpd-aktivitas"),
      lkpdAlatBahan: get("gadm-lkpd-alat-bahan"),
      lkpdPetunjuk: get("gadm-lkpd-petunjuk"),
      rubrikModel: get("gadm-rubrik-model"),
      rubrikKriteria: get("gadm-rubrik-kriteria"),
      lkpdAlokasi: get("gadm-lkpd-alokasi")
    };
  }

  function setFieldVisibility(type) {
    document.querySelectorAll("[data-gadm-for]").forEach((element) => {
      const modes = String(element.dataset.gadmFor || "").split(/\s+/);
      element.hidden = !modes.includes(type) && !modes.includes("all");
    });
  }

  function renderResult(result) {
    const preview = document.querySelector("#gadm-preview");
    const status = document.querySelector("#gadm-status");
    if (preview) preview.innerHTML = result.html;
    if (status) {
      status.textContent = result.validation.ok ? 'Dokumen siap ditinjau' : `${result.validation.errors.length} masalah harus diperbaiki`;
      status.title = `Engine ${result.engineVersion} · KB ${result.kbVersion}`;
      status.dataset.state = result.validation.ok ? "ok" : "error";
    }
    state.lastResult = result;
    state.lastValidation = result.validation;
    setResultActionsEnabled(Boolean(result.validation.ok));
    updateQualitySummary(result);
    setMobilePane("preview");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(scrollGadmToTop);
    }
  }

  async function saveDraft(input) {
    if (!hostAdapter) throw new Error("Host adapter GADM belum dikonfigurasi.");
    await hostAdapter.saveDraft(normalizeHostInput(input));
  }

  const FIELD_MAPPING = Object.freeze({
        documentType: "gadm-document-type", seed: "gadm-seed", namaSekolah: "gadm-nama-sekolah", namaGuru: "gadm-nama-guru", kelasAtauFase: "gadm-kelas-fase", mataPelajaran: "gadm-mata-pelajaran",
        materiAtauUnit: "gadm-materi-unit", materiAtauLingkup: "gadm-materi-lingkup", curriculumRecordId: "gadm-curriculum-record-id", cpResmiAtauManual: "gadm-cp-tp", tujuanPembelajaran: "gadm-tp-manual", alokasiWaktu: "gadm-alokasi-waktu", totalMinutes: "gadm-total-menit", jp: "gadm-jp", minutesPerJP: "gadm-menit-per-jp", mediaPembelajaran: "gadm-media",
        tujuan: "gadm-tujuan", buktiBelajar: "gadm-bukti-belajar", kondisiAwalMurid: "gadm-kondisi-awal", sumberDaya: "gadm-sumber-daya",
        konteksSekolah: "gadm-konteks-sekolah", targetProfilLulusan: "gadm-target-profil", modelPembelajaran: "gadm-model", tahunPelajaran: "gadm-tahun-pelajaran",
        cpAtpTp: "gadm-prota-unit", alokasiJamTahunan: "gadm-prota-total-jp", kalenderPendidikanAtauMingguEfektif: "gadm-kalender-efektif",
        semester: "gadm-semester", hasilProtaAtauDistribusiTahunan: "gadm-referensi-prota", mingguEfektifSemester: "gadm-minggu-efektif-semester",
        tpAtauUnitSemester: "gadm-promes-unit", kegiatan: "gadm-kegiatan-kokurikuler", targetDimensi: "gadm-target-dimensi",
        evidenceObservasi: "gadm-evidence-kokurikuler", materiAtauTP: "gadm-erapor-materi", statusCapaian: "gadm-erapor-status",
        evidence: "gadm-erapor-evidence", kompetensi: "gadm-erapor-kompetensi", nextStep: "gadm-erapor-next-step", teacherObservation: "gadm-erapor-observation",
        lkpdAktivitas: "gadm-lkpd-aktivitas", lkpdAlatBahan: "gadm-lkpd-alat-bahan", lkpdPetunjuk: "gadm-lkpd-petunjuk",
        rubrikModel: "gadm-rubrik-model", rubrikKriteria: "gadm-rubrik-kriteria", lkpdAlokasi: "gadm-lkpd-alokasi"
  });

  function populateInputFields(input) {
      const data = normalizeHostInput(input);
      Object.entries(FIELD_MAPPING).forEach(([key, id]) => {
        const element = document.querySelector(`#${id}`);
        if (element && data[key] != null) element.value = data[key];
      });
      const cpField = document.querySelector("#gadm-cp-tp");
      if (cpField && !normalizeMultiline(data.cpResmiAtauManual) && normalizeMultiline(data.cpAtauTp)) {
        cpField.value = data.cpAtauTp;
      }
      setFieldVisibility(data.documentType || "modulAjar");
      syncDocumentNavigation(data.documentType || "modulAjar");
      return data;
  }

  async function restoreDraft() {
    if (!hostAdapter) throw new Error("Host adapter GADM belum dikonfigurasi.");
    const data = await hostAdapter.loadDraft();
    if (!data) return null;
    return populateInputFields(data);
  }

  function reportAsyncError(error) {
    const status = document.querySelector("#gadm-status");
    if (status) {
      status.textContent = error instanceof Error ? error.message : String(error);
      status.dataset.state = "error";
    }
    if (typeof hostAdapter?.onError === "function") hostAdapter.onError(error);
  }

  function triggerGenerate({ incrementVariation = false } = {}) {
    if (incrementVariation) state.variation += 1;
    let input = normalizeHostInput(collectInput());
    if (incrementVariation) input.seed = `${normalizeText(input.seed) || "gadm"}:v${state.variation}`;
    state.lastInput = input;
    void saveDraft(input).catch(reportAsyncError);
    const result = generateDocument(input);
    renderResult(result);
    document.dispatchEvent(new CustomEvent("gadm:generated", { detail: { input, result } }));
    return result;
  }

  const RESULT_ACTION_IDS = Object.freeze([
    "gadm-variation",
    "gadm-copy",
    "gadm-download-text",
    "gadm-download-word",
    "gadm-download-excel",
    "gadm-print",
    "gadm-save"
  ]);

  function setResultActionsEnabled(enabled) {
    for (const id of RESULT_ACTION_IDS) {
      const button = document.querySelector(`#${id}`);
      if (button) button.disabled = !enabled;
    }
  }

  function renderEmptyPreview() {
    const preview = document.querySelector("#gadm-preview");
    if (!preview) return;
    preview.innerHTML = `<div class="gadm-empty-state"><div class="gadm-empty-illustration" aria-hidden="true"><svg viewBox="0 0 160 120"><path d="M35 14h68l22 22v70H35z"/><path d="M103 14v24h23M52 55h55M52 70h46M52 85h35"/><circle cx="128" cy="88" r="20"/><path d="m119 88 6 6 12-14"/></svg></div><h3>Dokumen Anda akan tampil di sini</h3><p>Isi konteks seperlunya. GADM akan menyusun, memeriksa, dan menjelaskan keputusan pedagogisnya sebelum hasil dianggap siap.</p><div class="gadm-empty-badges"><span>Offline</span><span>Deterministik</span><span>Anti-halusinasi</span></div></div>`;
  }

  function startNewDocument() {
    if (!state.mounted) throw new Error("GADM belum aktif.");
    const form = document.querySelector(".gadm-controls");
    form?.reset();
    state.variation = 0;
    state.lastInput = null;
    state.lastResult = null;
    state.lastValidation = null;
    setFieldVisibility("modulAjar");
    syncDocumentNavigation("modulAjar");
    setTeacherMode("quick");
    setWizardStep(1);
    setMobilePane("form");
    if (typeof window !== "undefined") window.requestAnimationFrame(scrollGadmToTop);
    setResultActionsEnabled(false);
    renderEmptyPreview();
    const status = document.querySelector("#gadm-status");
    if (status) {
      status.textContent = 'Siap membuat dokumen';
      status.title = `Engine ${ENGINE_VERSION} · KB ${GADM_KB_VERSION}`;
      status.dataset.state = "ok";
    }
    const summary = document.querySelector("#gadm-quality-summary");
    if (summary) {
      summary.dataset.state = "idle";
      summary.style.setProperty("--gadm-score", "0%");
    }
    const score = document.querySelector("#gadm-quality-score");
    const title = document.querySelector("#gadm-quality-title");
    const message = document.querySelector("#gadm-quality-message");
    if (score) score.textContent = "—";
    if (title) title.textContent = "Quality Inspector siap";
    if (message) message.textContent = "Lengkapi formulir untuk membuat dan memeriksa dokumen baru.";
    void saveDraft(collectInput()).catch(reportAsyncError);
  }

  async function copyOutput() {
    const text = state.lastResult?.text || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.className = "gadm-copy-helper";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  function downloadText() {
    const result = state.lastResult;
    if (!result?.text) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${normalizeId(result.title) || "gadm-output"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  let activePDFJob = null;
  function printOutput() {
    if (activePDFJob) return activePDFJob;
    const button = document.querySelector('#gadm-print');
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    activePDFJob = printOutputImplementation().finally(() => {
      activePDFJob = null;
      if (button) { button.disabled = !state.lastValidation?.ok; button.removeAttribute('aria-busy'); }
    });
    return activePDFJob;
  }
  async function printOutputImplementation() {
    await window.ensureSIMNIVendors?.("pdf");
    if (!state.lastResult?.html) return;
    if (typeof window.html2pdf !== "function") throw new Error("Pustaka PDF SIMNI belum tersedia.");
    const exportContainer = document.createElement("article");
    exportContainer.className = "gadm-preview gadm-paper gadm-pdf-export";
    exportContainer.setAttribute("aria-hidden", "true");
    exportContainer.innerHTML = state.lastResult.html;
    const printButton = document.querySelector("#gadm-print");
    const restoredColorVariables = [];
    const rootInlineStyle = document.documentElement.style;
    const rootComputedStyle = window.getComputedStyle(document.documentElement);
    for (const property of rootComputedStyle) {
      if (!property.startsWith("--")) continue;
      const computedValue = rootComputedStyle.getPropertyValue(property);
      if (!/oklch|oklab|color-mix/i.test(computedValue)) continue;
      restoredColorVariables.push({
        property,
        value: rootInlineStyle.getPropertyValue(property),
        priority: rootInlineStyle.getPropertyPriority(property)
      });
      rootInlineStyle.setProperty(property, "#000000", "important");
    }
    printButton?.setAttribute("aria-busy", "true");
    if (printButton) printButton.disabled = true;
    try {
      await window.html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `${normalizeId(state.lastResult.title) || "gadm-output"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 1024, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"], avoid: ["tr", "h2", "h3", ".gadm-signature-grid", ".gadm-doc-meta", ".gadm-curriculum-text", ".gadm-output-alert"] }
      }).from(exportContainer).save();
    } finally {
      document.querySelectorAll(".html2pdf__overlay").forEach((overlay) => overlay.remove());
      for (const entry of restoredColorVariables) {
        if (entry.value) rootInlineStyle.setProperty(entry.property, entry.value, entry.priority);
        else rootInlineStyle.removeProperty(entry.property);
      }
      printButton?.removeAttribute("aria-busy");
      if (printButton) printButton.disabled = !state.lastValidation?.ok;
    }
  }

  function injectStandaloneStyles() {
    if (document.querySelector('link[href$="gadm.css"], link[data-gadm-stylesheet]')) return;
    if (document.querySelector("#gadm-runtime-style")) return;
    const style = document.createElement("style");
    style.id = "gadm-runtime-style";
    style.textContent = `
      .gadm-shell{min-height:100vh;background:#f4f7fb;color:#152033;font:14px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.gadm-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 22px;background:#fff;border-bottom:1px solid #dfe6ef;position:sticky;top:0;z-index:5}.gadm-brand h1{font-size:18px;margin:0}.gadm-brand p{margin:2px 0 0;color:#64748b;font-size:12px}.gadm-status{font-size:12px;padding:6px 10px;border-radius:999px;background:#eef2ff}.gadm-status[data-state="ok"]{background:#ecfdf3}.gadm-status[data-state="error"]{background:#fff1f2}.gadm-workspace{display:grid;grid-template-columns:minmax(320px,440px) minmax(0,1fr);gap:18px;padding:18px;max-width:1500px;margin:0 auto}.gadm-panel{background:#fff;border:1px solid #dfe6ef;border-radius:16px;box-shadow:0 8px 30px rgba(15,23,42,.05)}.gadm-controls{padding:18px;max-height:calc(100vh - 106px);overflow:auto;position:sticky;top:86px}.gadm-field{display:grid;gap:6px;margin-bottom:13px}.gadm-field label{font-weight:650;font-size:12px}.gadm-field small{color:#64748b}.gadm-field input,.gadm-field select,.gadm-field textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px 11px;background:#fff;color:#0f172a;font:inherit}.gadm-field textarea{min-height:86px;resize:vertical}.gadm-field input:focus,.gadm-field select:focus,.gadm-field textarea:focus{outline:2px solid #bfdbfe;border-color:#60a5fa}.gadm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.gadm-button{border:0;border-radius:10px;padding:10px 12px;font:inherit;font-weight:700;cursor:pointer;background:#e2e8f0;color:#0f172a}.gadm-button-primary{background:#0f766e;color:#fff}.gadm-button-wide{grid-column:1/-1}.gadm-preview-panel{padding:20px;min-height:calc(100vh - 124px)}.gadm-preview{max-width:900px;min-height:1120px;margin:0 auto;background:#fff;padding:54px 58px;box-sizing:border-box;border:1px solid #e2e8f0;box-shadow:0 12px 36px rgba(15,23,42,.08)}.gadm-preview h1{font-size:24px;line-height:1.25;margin:0 0 8px}.gadm-preview h2{font-size:17px;margin:26px 0 10px;padding-bottom:5px;border-bottom:1px solid #e2e8f0}.gadm-preview h3{font-size:14px;margin:18px 0 6px}.gadm-preview p{margin:7px 0}.gadm-doc-header{text-align:center;margin-bottom:24px}.gadm-doc-header p{color:#64748b}.gadm-doc-meta{display:grid;gap:0;margin:18px 0}.gadm-doc-meta>div{display:grid;grid-template-columns:190px 1fr;border-bottom:1px solid #edf2f7;padding:7px 0}.gadm-doc-meta dt{font-weight:700}.gadm-doc-meta dd{margin:0}.gadm-table-wrap{overflow:auto}.gadm-table{width:100%;border-collapse:collapse;font-size:12px}.gadm-table th,.gadm-table td{border:1px solid #d8e0ea;padding:8px;vertical-align:top;text-align:left}.gadm-table th{background:#f8fafc}.gadm-output-alert{padding:12px 14px;border-radius:10px;margin:14px 0}.gadm-output-alert h3{margin:0 0 6px}.gadm-output-alert-error{background:#fff1f2;border:1px solid #fecdd3}.gadm-output-alert-warning{background:#fffbeb;border:1px solid #fde68a}.gadm-doc-note{font-size:12px;color:#64748b}.gadm-copy-helper{position:fixed;left:-9999px;top:-9999px}.gadm-help{padding:10px 12px;border-radius:10px;background:#f8fafc;color:#475569;font-size:12px;margin:0 0 14px}.gadm-section-title{margin:20px 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#475569}.gadm-field[hidden]{display:none!important}
      @media(max-width:900px){.gadm-workspace{grid-template-columns:1fr}.gadm-controls{position:static;max-height:none}.gadm-preview{padding:32px 24px;min-height:0}.gadm-preview-panel{padding:10px}.gadm-doc-meta>div{grid-template-columns:1fr}.gadm-doc-meta dd{margin-top:2px}}
      @media print{body.gadm-print-mode *{visibility:hidden!important}body.gadm-print-mode #gadm-preview,body.gadm-print-mode #gadm-preview *{visibility:visible!important}body.gadm-print-mode #gadm-preview{position:absolute;left:0;top:0;width:100%;max-width:none;min-height:0;border:0;box-shadow:none;padding:15mm} @page{size:A4;margin:0}}
    `;
    document.head.appendChild(style);
  }

  function injectStandaloneUI(root) {
    root.innerHTML = `
      <main class="gadm-shell">
        <header class="gadm-topbar">
          <div class="gadm-brand"><h1>GADM — Generator Administrasi Pembelajaran Mendalam</h1><p>Offline Expert System • KB ${escapeHTML(GADM_KB_VERSION)}</p></div>
          <div id="gadm-status" class="gadm-status">Siap</div>
        </header>
        <div class="gadm-workspace">
          <aside class="gadm-panel gadm-controls">
            <div class="gadm-field"><label for="gadm-document-type">Jenis Dokumen</label><select id="gadm-document-type"><option value="modulAjar">Modul Ajar</option><option value="prota">Program Tahunan (Prota)</option><option value="promes">Program Semester (Promes)</option><option value="silabus">Silabus Operasional</option><option value="deskripsiKokurikuler">Deskripsi Kokurikuler</option><option value="deskripsiERapor">Deskripsi Nilai e-Rapor</option></select></div>
            <div class="gadm-field" data-gadm-for="all"><label for="gadm-seed">Seed Variasi (opsional)</label><input id="gadm-seed" placeholder="Kosong = otomatis deterministik"><small>Input + seed yang sama menghasilkan output yang sama.</small></div>

            <h2 class="gadm-section-title" data-gadm-for="modulAjar silabus prota">Identitas Pembelajaran</h2>
            <div class="gadm-field" data-gadm-for="modulAjar silabus prota"><label for="gadm-kelas-fase">Kelas atau Fase</label><input id="gadm-kelas-fase" placeholder="Contoh: 3 atau Fase B"></div>
            <div class="gadm-field" data-gadm-for="modulAjar silabus prota"><label for="gadm-mata-pelajaran">Mata Pelajaran</label><input id="gadm-mata-pelajaran" placeholder="Contoh: Matematika"></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-materi-unit">Materi/Unit</label><input id="gadm-materi-unit" placeholder="Materi yang benar-benar akan diajarkan"></div>
            <div class="gadm-field" data-gadm-for="silabus"><label for="gadm-materi-lingkup">Materi/Lingkup</label><textarea id="gadm-materi-lingkup" placeholder="Satu materi per baris; dapat sejajar dengan daftar CP/TP"></textarea></div>
            <div class="gadm-field" data-gadm-for="modulAjar silabus"><label for="gadm-cp-tp">CP/TP Terverifikasi</label><textarea id="gadm-cp-tp" placeholder="Tempel CP/TP resmi atau TP yang telah ditetapkan. GADM tidak akan mengarang CP/TP."></textarea></div>
            <div class="gadm-field" data-gadm-for="modulAjar silabus"><label for="gadm-alokasi-waktu">Alokasi Waktu</label><input id="gadm-alokasi-waktu" placeholder="Contoh: 2 x 35 menit / 4 JP"></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-total-menit">Total Menit (opsional)</label><input id="gadm-total-menit" inputmode="numeric" placeholder="Jika diisi, mengalahkan parsing Alokasi Waktu"><small>Reality Check akan memastikan seluruh segmen tepat sama dengan total ini.</small></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-jp">Jumlah JP (opsional)</label><input id="gadm-jp" inputmode="decimal" placeholder="Contoh: 2"></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-menit-per-jp">Menit per JP (opsional)</label><input id="gadm-menit-per-jp" inputmode="numeric" placeholder="Default KB: 35"></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-media">Media yang Wajib/Ditetapkan Guru (opsional)</label><input id="gadm-media" placeholder="Kosongkan agar GADM merekomendasikan dari konteks"></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-tujuan">Intent/Tujuan Spesifik (opsional)</label><textarea id="gadm-tujuan" placeholder="Membantu engine memilih model/metode tanpa mengubah CP/TP."></textarea></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-bukti-belajar">Bukti Belajar yang Diharapkan (opsional)</label><input id="gadm-bukti-belajar" placeholder="Contoh: demonstrasi, solusi masalah, produk"></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-model">Model Pembelajaran</label><select id="gadm-model"><option value="otomatis">Otomatis berdasarkan tujuan</option>${Object.values(GADM_KB.modelPembelajaran).map((model) => `<option value="${escapeHTML(model.id)}">${escapeHTML(model.label)}</option>`).join("")}</select></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-target-profil">Target Profil Lulusan (opsional)</label><input id="gadm-target-profil" placeholder="Contoh: Penalaran Kritis, Komunikasi"></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-kondisi-awal">Kondisi Awal Murid (opsional)</label><textarea id="gadm-kondisi-awal"></textarea></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-sumber-daya">Sumber Daya (opsional)</label><textarea id="gadm-sumber-daya" placeholder="Media/fasilitas yang benar-benar tersedia"></textarea></div>
            <div class="gadm-field" data-gadm-for="modulAjar"><label for="gadm-konteks-sekolah">Konteks Sekolah (opsional)</label><textarea id="gadm-konteks-sekolah"></textarea></div>

            <h2 class="gadm-section-title" data-gadm-for="prota">Data Prota</h2>
            <div class="gadm-field" data-gadm-for="prota"><label for="gadm-tahun-pelajaran">Tahun Pelajaran</label><input id="gadm-tahun-pelajaran" placeholder="Contoh: 2026/2027"></div>
            <div class="gadm-field" data-gadm-for="prota"><label for="gadm-prota-total-jp">Total JP Tahunan</label><input id="gadm-prota-total-jp" inputmode="numeric" placeholder="Contoh: 144"></div>
            <div class="gadm-field" data-gadm-for="prota"><label for="gadm-kalender-efektif">Kalender/Minggu Efektif</label><textarea id="gadm-kalender-efektif" placeholder="Tempel ringkasan minggu efektif yang telah ditetapkan sekolah/dinas."></textarea></div>
            <div class="gadm-field" data-gadm-for="prota"><label for="gadm-prota-unit">CP/ATP/TP atau Unit + JP + Semester</label><textarea id="gadm-prota-unit" placeholder="Format wajib per baris:\nTP/Unit | JP | Semester\nContoh: Bilangan cacah | 18 | 1"></textarea><small>Alokasi per unit wajib diberikan agar engine tidak mengarang distribusi.</small></div>

            <h2 class="gadm-section-title" data-gadm-for="promes">Data Promes</h2>
            <div class="gadm-field" data-gadm-for="promes"><label for="gadm-semester">Semester</label><select id="gadm-semester"><option value="1">1 / Ganjil</option><option value="2">2 / Genap</option></select></div>
            <div class="gadm-field" data-gadm-for="promes"><label for="gadm-referensi-prota">Referensi/Hasil Prota</label><textarea id="gadm-referensi-prota" placeholder="Tempel distribusi Prota yang sudah disahkan/dipakai."></textarea></div>
            <div class="gadm-field" data-gadm-for="promes"><label for="gadm-minggu-efektif-semester">Minggu Efektif Semester</label><input id="gadm-minggu-efektif-semester" placeholder="Contoh: 18 minggu efektif"></div>
            <div class="gadm-field" data-gadm-for="promes"><label for="gadm-promes-unit">TP/Unit + JP + Periode/Minggu</label><textarea id="gadm-promes-unit" placeholder="Format wajib per baris:\nTP/Unit | JP | periode dari kalender\nContoh: Bilangan cacah | 8 | Minggu 1-2"></textarea></div>

            <h2 class="gadm-section-title" data-gadm-for="deskripsiKokurikuler">Data Kokurikuler</h2>
            <div class="gadm-field" data-gadm-for="deskripsiKokurikuler"><label for="gadm-kegiatan-kokurikuler">Kegiatan</label><input id="gadm-kegiatan-kokurikuler" placeholder="Nama kegiatan kokurikuler"></div>
            <div class="gadm-field" data-gadm-for="deskripsiKokurikuler"><label for="gadm-target-dimensi">Target Dimensi</label><input id="gadm-target-dimensi" placeholder="Contoh: Kolaborasi, Kewargaan"></div>
            <div class="gadm-field" data-gadm-for="deskripsiKokurikuler"><label for="gadm-evidence-kokurikuler">Bukti Observasi</label><textarea id="gadm-evidence-kokurikuler" placeholder="Tuliskan perilaku/karya yang benar-benar diamati"></textarea></div>

            <h2 class="gadm-section-title" data-gadm-for="deskripsiERapor">Data e-Rapor</h2>
            <div class="gadm-field" data-gadm-for="deskripsiERapor"><label for="gadm-erapor-materi">Materi/TP</label><input id="gadm-erapor-materi"></div>
            <div class="gadm-field" data-gadm-for="deskripsiERapor"><label for="gadm-erapor-kompetensi">Kompetensi yang Didiskripsikan</label><input id="gadm-erapor-kompetensi" placeholder="Contoh: menjelaskan hubungan ..."></div>
            <div class="gadm-field" data-gadm-for="deskripsiERapor"><label for="gadm-erapor-status">Status Capaian</label><select id="gadm-erapor-status"><option value="Sangat Baik">Sangat Baik</option><option value="Tercapai">Tercapai</option><option value="Berkembang">Berkembang</option><option value="Perlu Bimbingan">Perlu Bimbingan</option></select></div>
            <div class="gadm-field" data-gadm-for="deskripsiERapor"><label for="gadm-erapor-evidence">Bukti Capaian</label><textarea id="gadm-erapor-evidence" placeholder="Bukti nyata dari tugas, asesmen, atau observasi"></textarea></div>
            <div class="gadm-field" data-gadm-for="deskripsiERapor"><label for="gadm-erapor-next-step">Tindak Lanjut (opsional)</label><input id="gadm-erapor-next-step"></div>
            <div class="gadm-field" data-gadm-for="deskripsiERapor"><label for="gadm-erapor-observation">Observasi Guru Tambahan (opsional)</label><textarea id="gadm-erapor-observation"></textarea></div>

            <div class="gadm-actions">
              <button id="gadm-generate" class="gadm-button gadm-button-primary gadm-button-wide" type="button">Generate</button>
              <button id="gadm-variation" class="gadm-button" type="button">Variasi Baru</button>
              <button id="gadm-copy" class="gadm-button" type="button">Salin Teks</button>
              <button id="gadm-download-text" class="gadm-button" type="button">Unduh TXT</button>
              <button id="gadm-print" class="gadm-button" type="button">Cetak / Simpan PDF</button>
            </div>
          </aside>
          <section class="gadm-panel gadm-preview-panel"><div id="gadm-preview" class="gadm-preview"><div class="gadm-help"><strong>GADM siap.</strong> Pilih jenis dokumen dan isi data yang faktual. Engine akan memblokir keluaran jika data penting seperti CP/TP, evidence e-Rapor, atau kalender Prota/Promes belum tersedia.</div></div></section>
        </div>
      </main>`;
  }


  const DOCUMENT_UI = Object.freeze({
    modulAjar: {
      title: "Modul Ajar",
      description: "Berikan fakta pembelajaran. GADM akan menentukan strategi yang paling masuk akal dan menjelaskan alasannya."
    },
    prota: {
      title: "Program Tahunan",
      description: "Distribusikan CP/ATP/TP dan JP berdasarkan data waktu yang telah ditetapkan, tanpa menciptakan minggu efektif."
    },
    promes: {
      title: "Program Semester",
      description: "Turunkan distribusi tahunan menjadi semester secara konsisten dengan Prota dan minggu efektif yang Anda berikan."
    },
    silabus: {
      title: "Silabus Operasional",
      description: "Petakan CP/TP, materi, model, metode, aktivitas, asesmen, media dan waktu dalam format operasional yang dapat dipakai guru."
    },
    deskripsiKokurikuler: {
      title: "Deskripsi Kokurikuler",
      description: "Susun deskripsi berdasarkan kegiatan, dimensi yang benar-benar ditargetkan, dan evidence yang benar-benar diamati."
    },
    deskripsiERapor: {
      title: "Deskripsi e-Rapor",
      description: "Ubah evidence capaian menjadi deskripsi yang empatik, konkret, dan bebas klaim yang tidak didukung bukti."
    },
    lkpdRubrik: {
      title: "LKPD & Rubrik Penilaian",
      description: "Susun Lembar Kerja Peserta Didik berbasis aktivitas kontekstual serta Rubrik Asesmen Otentik berjenjang 4 kriteria."
    }
  });

  function populateModelOptions() {
    const select = document.querySelector("#gadm-model");
    if (!select || select.dataset.gadmPopulated === "true") return;
    Object.values(GADM_KB.modelPembelajaran || {}).forEach((model) => {
      if (!model?.id || !model?.label) return;
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.label;
      select.appendChild(option);
    });
    select.dataset.gadmPopulated = "true";
  }

  function syncDocumentNavigation(type) {
    const config = DOCUMENT_UI[type] || DOCUMENT_UI.modulAjar;
    const title = document.querySelector("#gadm-builder-title");
    const description = document.querySelector("#gadm-builder-description");
    if (title) title.textContent = config.title;
    if (description) description.textContent = config.description;
    document.querySelectorAll("[data-gadm-document]").forEach((button) => {
      const active = button.dataset.gadmDocument === type
        || (button.dataset.gadmDocument === "prota" && (type === "promes" || type === "silabus"));
      button.classList.toggle("gadm-is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function setWizardStep(nextStep) {
    const step = Math.max(1, Math.min(4, Number(nextStep) || 1));
    const root = document.querySelector(`#${ROOT_ID}`);
    if (root) root.dataset.gadmStep = String(step);
    document.querySelectorAll("[data-gadm-step-panel]").forEach((panel) => {
      panel.hidden = Number(panel.dataset.gadmStepPanel) !== step;
    });
    document.querySelectorAll("[data-gadm-step-target]").forEach((button) => {
      const value = Number(button.dataset.gadmStepTarget);
      button.classList.toggle("gadm-is-active", value === step);
      button.classList.toggle("gadm-is-done", value < step);
      if (value === step) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    const previous = document.querySelector("#gadm-step-prev");
    const next = document.querySelector("#gadm-step-next");
    if (previous) previous.disabled = step <= 1;
    if (next) {
      next.hidden = step >= 4;
      next.textContent = step === 3 ? "Finalisasi →" : "Lanjut →";
    }
    const activePanel = document.querySelector(`[data-gadm-step-panel="${step}"]`);
    activePanel?.querySelector("input:not([type='hidden']),select,textarea")?.focus({ preventScroll: true });
  }

  function setTeacherMode(mode) {
    const value = mode === "advanced" ? "advanced" : "quick";
    const root = document.querySelector(`#${ROOT_ID}`);
    if (root) root.dataset.gadmMode = value;
    document.querySelectorAll("[data-gadm-mode-value]").forEach((button) => {
      const active = button.dataset.gadmModeValue === value;
      button.classList.toggle("gadm-is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setMobilePane(pane) {
    const value = pane === "preview" ? "preview" : "form";
    const root = document.querySelector(`#${ROOT_ID}`);
    if (root) root.dataset.gadmPane = value;
    document.querySelectorAll("[data-gadm-pane-value]").forEach((button) => {
      button.classList.toggle("gadm-is-active", button.dataset.gadmPaneValue === value);
    });
  }

  function scrollGadmToTop() {
    const mainScrollArea = document.querySelector("#main-scroll-area");
    if (mainScrollArea && typeof mainScrollArea.scrollTo === "function") {
      mainScrollArea.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }

  function toggleContextChip(button) {
    const targetId = button.dataset.gadmContextTarget;
    const value = normalizeText(button.dataset.gadmContextValue);
    const target = targetId ? document.querySelector(`#${targetId}`) : null;
    if (!target || !value) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    let items = normalizeMultiline(target.value).split("\n").map(normalizeText).filter(Boolean);
    if (pressed) items = items.filter((item) => normalizeText(item) !== value);
    else if (!items.some((item) => normalizeText(item) === value)) items.push(value);
    target.value = items.join("\n");
    button.setAttribute("aria-pressed", String(!pressed));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function updateQualitySummary(result) {
    const summary = document.querySelector("#gadm-quality-summary");
    const scoreElement = document.querySelector("#gadm-quality-score");
    const title = document.querySelector("#gadm-quality-title");
    const message = document.querySelector("#gadm-quality-message");
    if (!summary || !scoreElement || !title || !message || !result) return;
    const audit = result.data?.qualityAudit;
    if (!result.validation?.ok) {
      summary.dataset.state = "error";
      summary.style.setProperty("--gadm-score", "0%");
      scoreElement.textContent = "!";
      title.textContent = "Perlu diperbaiki sebelum dipakai";
      message.textContent = `${result.validation?.errors?.length || 1} masalah diblokir oleh GADM. Periksa catatan pada dokumen lalu lengkapi data faktual yang diminta.`;
      return;
    }
    if (audit && Number.isFinite(Number(audit.score))) {
      const score = Math.max(0, Math.min(100, Number(audit.score)));
      summary.dataset.state = score >= 90 ? "ok" : "idle";
      summary.style.setProperty("--gadm-score", `${score}%`);
      scoreElement.textContent = String(score);
      title.textContent = score === 100 ? "Lolos Quality Inspector" : "Quality Inspector selesai";
      message.textContent = `${audit.checks?.filter((item) => item.status === "pass").length || 0}/${audit.checks?.length || 0} pemeriksaan lulus. Status dokumen: ${audit.status || "ready"}.`;
      return;
    }
    summary.dataset.state = "ok";
    summary.style.setProperty("--gadm-score", "100%");
    scoreElement.textContent = "✓";
    title.textContent = "Validasi dokumen lulus";
    message.textContent = result.validation?.warnings?.length ? `${result.validation.warnings.length} catatan validasi tersedia pada hasil.` : "Data wajib tersedia dan tidak ada error yang memblokir hasil.";
  }

  function bindTeacherCopilotUI(typeSelect) {
    const options = lifecycleOptions();
    populateModelOptions();
    document.querySelectorAll("[data-gadm-document]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!typeSelect) return;
        typeSelect.value = button.dataset.gadmDocument;
        typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        setWizardStep(1);
        setMobilePane("form");
      }, options);
    });
    document.querySelectorAll("[data-gadm-step-target]").forEach((button) => button.addEventListener("click", () => setWizardStep(button.dataset.gadmStepTarget), options));
    document.querySelector("#gadm-step-prev")?.addEventListener("click", () => {
      const root = document.querySelector(`#${ROOT_ID}`);
      setWizardStep((Number(root?.dataset.gadmStep) || 1) - 1);
    }, options);
    document.querySelector("#gadm-step-next")?.addEventListener("click", () => {
      const root = document.querySelector(`#${ROOT_ID}`);
      setWizardStep((Number(root?.dataset.gadmStep) || 1) + 1);
    }, options);
    document.querySelectorAll("[data-gadm-mode-value]").forEach((button) => button.addEventListener("click", () => setTeacherMode(button.dataset.gadmModeValue), options));
    document.querySelectorAll("[data-gadm-context-target]").forEach((button) => button.addEventListener("click", () => toggleContextChip(button), options));
    document.querySelectorAll("[data-gadm-pane-value]").forEach((button) => button.addEventListener("click", () => setMobilePane(button.dataset.gadmPaneValue), options));
    syncDocumentNavigation(typeSelect?.value || "modulAjar");
    setTeacherMode(document.querySelector(`#${ROOT_ID}`)?.dataset.gadmMode || "quick");
    setWizardStep(1);
    setMobilePane(document.querySelector(`#${ROOT_ID}`)?.dataset.gadmPane || "form");
  }

  function bindUI() {
    const options = lifecycleOptions();
    const type = document.querySelector("#gadm-document-type");
    const generate = document.querySelector("#gadm-generate");
    const variation = document.querySelector("#gadm-variation");
    const copy = document.querySelector("#gadm-copy");
    const print = document.querySelector("#gadm-print");
    const download = document.querySelector("#gadm-download-text");

    bindTeacherCopilotUI(type);

    type?.addEventListener("change", () => {
      setFieldVisibility(type.value);
      syncDocumentNavigation(type.value);
      void saveDraft(collectInput()).catch(reportAsyncError);
    }, options);
    document.querySelector(".gadm-controls")?.addEventListener("submit", (event) => {
      event.preventDefault();
      triggerGenerate();
    }, options);
    generate?.addEventListener("click", () => triggerGenerate(), options);
    variation?.addEventListener("click", () => triggerGenerate({ incrementVariation: true }), options);
    copy?.addEventListener("click", () => void copyOutput().catch(reportAsyncError), options);
    print?.addEventListener("click", () => void printOutput().catch(reportAsyncError), options);
    download?.addEventListener("click", downloadText, options);

    document.querySelectorAll(".gadm-controls input,.gadm-controls textarea,.gadm-controls select").forEach((element) => {
      element.addEventListener("change", () => void saveDraft(collectInput()).catch(reportAsyncError), options);
    });

    document.addEventListener("gadm:generate", (event) => {
      const detailInput = event.detail?.input;
      if (detailInput && typeof detailInput === "object") {
        const normalizedInput = normalizeHostInput(detailInput);
        const result = generateDocument(normalizedInput);
        state.lastInput = normalizedInput;
        renderResult(result);
        void saveDraft(normalizedInput).catch(reportAsyncError);
        document.dispatchEvent(new CustomEvent("gadm:generated", { detail: { input: normalizedInput, result } }));
      } else {
        triggerGenerate();
      }
    }, options);
  }

  function preflight() {
    const kbAudit = selfAuditKB();
    const errors = [...kbAudit.errors];
    const warnings = [...kbAudit.warnings];
    if (Number(GADM_KB_SCHEMA_VERSION) < 6) errors.push(makeIssue("KB_SCHEMA_TOO_OLD", "Teacher Intelligence engine memerlukan GADM KB schema v6 atau lebih baru."));
    if (!DOCUMENT_TYPES.every((type) => GADM_KB.documentSchemas[type])) errors.push(makeIssue("DOCUMENT_SCHEMA_INCOMPLETE", "Schema dokumen GADM tidak lengkap."));
    if (GADM_KB.pembelajaranMendalam.statusKonseptual.forbiddenAsModelName !== true) errors.push(makeIssue("APPROACH_MODEL_GUARD_MISSING", "Guard pemisahan pendekatan dan model tidak aktif."));
    if (GADM_KB.generationPolicies.variability.mechanism !== "deterministic_seeded_selection") errors.push(makeIssue("DETERMINISM_POLICY_MISMATCH", "KB tidak menggunakan kebijakan variasi deterministik."));
    if (!GADM_KB.teacherContextIntelligence || !GADM_KB.timeIntelligence || !GADM_KB.documentRelations || !GADM_KB.qualityInspector) errors.push(makeIssue("TEACHER_INTELLIGENCE_GRAPH_INCOMPLETE", "Node Teacher Intelligence Knowledge Graph v6 tidak lengkap."));
    return { ok: errors.length === 0, errors, warnings, engineVersion: ENGINE_VERSION, kbVersion: GADM_KB_VERSION, kbSchemaVersion: GADM_KB_SCHEMA_VERSION, architecture: KNOWLEDGE_MODE };
  }

  async function mount(adapter = null) {
    if (state.mounted) return true;
    if (adapter) configureHost(adapter);
    if (!hostAdapter) throw new Error("Host adapter GADM wajib dikonfigurasi sebelum mount.");
    const audit = preflight();
    const root = document.querySelector(`#${ROOT_ID}`);
    if (!root) throw new Error("Fragmen UI GADM belum dimuat.");

    if (!audit.ok) {
      root.innerHTML = `${renderHeader("GADM gagal melakukan preflight")}${renderIssues(audit)}`;
      throw new Error(audit.errors.map((issue) => issue.message).join(" "));
    }

    state.lifecycleController = new AbortController();
    bindUI();
    await restoreDraft();
    const currentType = document.querySelector("#gadm-document-type")?.value || "modulAjar";
    setFieldVisibility(currentType);
    syncDocumentNavigation(currentType);
    state.mounted = true;
    setResultActionsEnabled(false);
    document.dispatchEvent(new CustomEvent("gadm:ready", { detail: { engineVersion: ENGINE_VERSION, kbVersion: GADM_KB_VERSION } }));
    return true;
  }

  function unmount() {
    state.lifecycleController?.abort();
    state.lifecycleController = null;
    state.variation = 0;
    state.lastInput = null;
    state.lastResult = null;
    state.lastValidation = null;
    state.mounted = false;
    state.documentBundle = {};
    state.auditHistory = [];
    hostAdapter = null;
    document.body.classList.remove("gadm-print-mode");
  }

  function snapshot() {
    return {
      mounted: state.mounted,
      input: state.lastInput ? JSON.parse(JSON.stringify(state.lastInput)) : null,
      result: state.lastResult ? JSON.parse(JSON.stringify(state.lastResult)) : null,
      validation: state.lastValidation ? JSON.parse(JSON.stringify(state.lastValidation)) : null
    };
  }

  function loadInput(input) {
    if (!state.mounted) throw new Error("GADM belum aktif.");
    const normalizedInput = populateInputFields(input);
    state.lastInput = normalizedInput;
    const result = generateDocument(normalizedInput);
    renderResult(result);
    void saveDraft(normalizedInput).catch(reportAsyncError);
    document.dispatchEvent(new CustomEvent("gadm:generated", { detail: { input: normalizedInput, result } }));
    return result;
  }

  return Object.freeze({
    version: ENGINE_VERSION,
    kbVersion: GADM_KB_VERSION,
    kbSchemaVersion: GADM_KB_SCHEMA_VERSION,
    architecture: KNOWLEDGE_MODE,
    mount,
    unmount,
    configureHost,
    snapshot,
    loadInput,
    startNewDocument,
    preflight,
    generate: generateDocument,
    buildModulePlan,
    inspectTeacherIntelligence,
    validateBundle: validateCurrentBundle,
    resetBundle: resetDocumentBundle,
    resolvePhase,
    resolveSubject,
    resolveCurriculumSource,
    findCurriculumRecords,
    recommendOfficialCp,
    suggestLearningObjective,
    recommendModels,
    recommendContextSupports,
    recommendProfileDimensions,
    planLessonTime,
    validateTimeBudget,
    auditGeneratedDocument,
    buildRepairPlan,
    validateCrossDocumentConsistency,
    validateDocumentInput,
    validateERaporEvidence,
    validateLearningPlan
  });
})();

export default GADM_ENGINE;
