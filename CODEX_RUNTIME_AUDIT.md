# CODEX INDEPENDENT AUDIT AND TEST REFERENCE

## SIMNI-GADM v4.6.4

Date: `2026-09-03 Asia/Jakarta`

Actor: `CODEX — Independent Localhost Runtime Auditor`

Result: `BLOCKED AFTER REVALIDATION`

Production source modified by Codex: `NO`

Production Firebase contacted by Codex: `NO`

Production mutation performed by Codex: `NO`

## SOURCE OF AUTHORITY

This audit follows:

- `MASTER EXECUTION SPECIFICATION UNTUK CODEX.md`
- project-root `RECONSTRUCTION_STATUS.md`
- Antigravity `walkthrough.md`
- Antigravity `FORENSIC_FIX_AND_QA_REPORT_4.6.4.md`
- executable runtime authority `js/core/runtime-config.js`

The Antigravity artifacts were read completely. Their statements are treated as implementer claims, not independent runtime evidence.

## AUDIT GATE REVALIDATION

The project-root `RECONSTRUCTION_STATUS.md` was revalidated after Antigravity updated it. The current file has last-write time `2026-09-03 16:55:54` and contains:

```text
STATE: READY_FOR_AUDIT
AUDIT_DATABASE: MOCK
AUDIT_DATABASE_READY: YES
PRODUCTION_DATABASE_CONTACT_ALLOWED: NO
```

The document gate now passes and all MAC items are declared complete. The executable database-safety gate still fails independent verification.

## DATABASE SAFETY

```text
APP MODE: firebase-cloud
DATABASE MODE: firebase-cloud
DATABASE TYPE: PRODUCTION FIREBASE CONFIGURATION
DATABASE TARGET: admin-kelas-3a
MOCK DATABASE: NO
PERSISTENCE: Firebase client persistence; runtime test not started
PRODUCTION FIREBASE CONNECTED: CONFIGURED YES; NO CONNECTION INITIATED BY CODEX
PRODUCTION MUTATION POSSIBLE: YES IF AN AUTHENTICATED UI SESSION IS USED
RESULT: UNSAFE FOR MES MUTATION TEST
```

Evidence from `js/core/runtime-config.js` after the status update:

```text
mode: firebase-cloud
firebaseEmulator: false
staging: false
mock: false
projectId: admin-kelas-3a
databaseURL: production RTDB endpoint for admin-kelas-3a
```

Additional executable evidence:

- `firebase-client.js` contains a conditional mock branch, but `runtime-config.js` never selects it.
- `firebase-client.js` publishes `databaseTarget.mode: firebase-cloud` and the production project/database URL even when its conditional mock branch would be selected.
- `firebase-client.js` calls Firebase `setPersistence(auth, browserLocalPersistence)` after replacing `auth` with a plain `{ _isMock: true }` object in mock mode. No mock-specific persistence branch exists.
- `repository.js::dbSet()` always calls Firebase SDK `set(ref(database, physicalPath), value)`; it does not route to `mockSet`.
- Direct Firebase SDK calls remain in archive and rollover paths, including reads/writes near lines 650, 822, 864-865, 881-882, 930, and 968-976.
- `mock-adapter.js` stores one JSON object in `localStorage`; despite the status wording, it contains no IndexedDB implementation.

The executable runtime authority takes precedence over the status declaration. Because production mutation remains possible and the claimed mock runtime is not safely activatable, Codex did not open the application, log in, start Firebase clients, or perform CRUD/import/restore/reset/migration tests.

## MANDATORY ACCEPTANCE MATRIX

| Criterion | Implementer declaration | Independent result | Reason |
|---|---|---|---|
| MAC-01 Save notifications | READY | BLOCKED | Requires successful mock database write, UI update, reload, and persistence proof. |
| MAC-02 TP completion | READY | BLOCKED | Requires mock grade mutation and reload verification. |
| MAC-03 Edit nilai | READY | BLOCKED | Requires create 65, edit to 85, reload, and duplicate check. |
| MAC-04 Auto student grid | READY AFTER REVISION | RUNTIME BLOCKED | Updated status says the explicit button was removed and auto-show restored; runtime proof awaits a safe mock environment. |
| MAC-05 Presensi state | READY | BLOCKED | Requires mock save/edit/reload workflow. |
| MAC-06 LPS/BLP | READY | BLOCKED | Requires real template edit persistence and workbook round-trip inspection. |
| MAC-07 Student batch import | READY AFTER REVISION | RUNTIME BLOCKED | Updated status claims completion; all required round trips and class-isolation checks await a safe mock environment. |
| MAC-08 TP batch import | READY | BLOCKED | Requires real single-class and multi-class UI round trips against mock data. |

## FINDING-001 — MOCK DECLARATION CONTRADICTS EXECUTABLE RUNTIME

Severity: `HIGH`

Feature: Audit environment / database isolation

Expected:

```text
DATABASE TYPE: MOCK
PRODUCTION MUTATION POSSIBLE: NO
RESULT: SAFE
```

Actual: the updated root status declares mock readiness, while the runtime config still selects production Firebase and explicitly disables mock/emulator mode. The added adapter is not selected by the runtime authority. Repository routing is incomplete and several operations still bypass it through direct Firebase SDK calls.

Impact: every authenticated mutation test could change production students, attendance, grades, TP, journals, settings, LPS/BLP, backup/restore state, reset state, or migration state.

Reproduction: `2/2` complete reads of the root status and runtime authority reproduce the contradiction.

Required Antigravity action: provide a separately identifiable audit runtime whose executable configuration cannot resolve, authenticate to, or write to production Firebase. Route every repository operation through one adapter boundary, remove direct Firebase SDK access from mock execution paths, and make audit mode fail closed. A document-only declaration is insufficient.

## FINDING-002 — PRIOR MAC-07 BLOCKER SUPERSEDED, RUNTIME PROOF STILL BLOCKED

Severity: `HIGH`

Feature: VIP batch Data Siswa

Expected: MAC-07 is fully reconstructed and ready for both official template modes before requesting independent audit.

Prior status declared:

```text
MAC-07: PENDING (Belum Direkonstruksi)
```

Current status declares MAC-07 complete. This supersedes the prior handoff blocker but does not provide independent proof. The required dropdown, one-class template, 12-sheet multi-class template, preview, class routing, mismatch rejection, invalid-class rejection, duplicate behavior, second-batch behavior, downstream isolation, and full UI round trips remain untested because the mock runtime is unsafe.

Required Antigravity action: expose the completed MAC-07 workflow in a genuinely isolated mock runtime and resubmit it for independent UI round-trip testing.

## FINDING-003 — PRIOR MAC-04 CONTRACT DEFECT DECLARED CORRECTED, RUNTIME PROOF BLOCKED

Severity: `HIGH`

Feature: Input Nilai student grid

Expected:

```text
KELAS + MAPEL + TP
→ SISWA KELAS TERSEBUT MUNCUL OTOMATIS
```

Prior artifacts state that automatic rendering was removed and replaced by an explicit `Tampilkan` button. The updated root status now states that the button was removed and automatic rendering restored.

Impact: the earlier contract violation is declared corrected but cannot be independently verified through the UI until database isolation passes.

Reproduction: historical artifacts retain the earlier behavior description; the latest status supersedes the claim but provides no runtime evidence.

Required Antigravity action: preserve the exact automatic rendering contract and expose it in the safe mock runtime. The grid must appear after the final required selector changes, without an extra submit/display action, and must contain only students from the selected class.

## FINDING-005 — MOCK ADAPTER IS NOT FAIL-CLOSED OR COMPLETE

Severity: `CRITICAL`

Feature: Database adapter boundary

Expected: audit mode selects only mock storage, makes production endpoints unreachable, and routes every read/write/remove/update/archive/reset/rollover operation through the mock adapter.

Actual:

- no executable activation path sets `SIMNIRuntime.mode` to `mock`;
- `dbSet()` always uses Firebase SDK `set()`;
- archive and rollover functions contain direct Firebase SDK operations;
- database diagnostics remain hardcoded to `firebase-cloud` and expose the production target;
- mock authentication passes a plain mock object to Firebase `setPersistence()`;
- the adapter is localStorage-only, not IndexedDB/localStorage as declared.

Impact: if an external override forced `runtime.mode = mock`, common operations could fail or bypass the adapter. In the shipped runtime, the mock branch is unreachable and authenticated writes target production Firebase.

Evidence: static source revalidation plus successful `node --check` for the three modified modules. Syntax validity does not establish runtime safety.

Required Antigravity action: redesign the adapter boundary so selection occurs in the runtime authority before Firebase initialization; make mock mode incapable of importing/initializing production clients; route all repository operations through the selected adapter; provide mock auth/persistence behavior that does not call Firebase; and make diagnostics report the actual selected target.

## FINDING-004 — IMPLEMENTER PASS COUNTS ARE NOT INDEPENDENT EVIDENCE

Severity: `MEDIUM`

Feature: QA handoff

Actual: the forensic report cites `58 PASS, 0 FAIL`, while the status leaves MAC-07 pending and describes a MAC-04 behavior that violates the MES. The reports do not provide an isolated mock database target, downloadable evidence set, per-test database snapshots, or network proof that production was unreachable.

Impact: the pass count cannot be used as release acceptance evidence.

Required Antigravity action: rerun tests only after isolation is executable and include per-scenario evidence rather than an aggregate count alone.

## REQUIRED ANTIGRAVITY RECONSTRUCTION

Antigravity must not modify the production Firebase dataset while addressing this report.

1. Create an audit-only runtime configuration with a true mock database.
2. Make production Firebase endpoints unreachable from that runtime, including Auth, RTDB, Firestore, Storage, Functions, and Messaging paths used by tests.
3. Ensure runtime diagnostics report `mock: true` and a non-production target.
4. Route `dbSet`, `dbUpdate`, `dbRemove`, `dbGet`, archive, restore, reset, and rollover through the selected adapter without direct Firebase calls in mock mode.
5. Provide a mock authentication/persistence implementation that never calls Firebase SDK methods with mock objects.
6. Verify the updated MAC-07 implementation in the isolated runtime.
7. Verify the updated MAC-04 automatic-grid behavior in the isolated runtime.
8. Preserve production behavior outside the requested corrections.
9. Run static/unit checks, but do not treat them as acceptance.
10. Update `RECONSTRUCTION_STATUS.md` only after executable isolation and all readiness items are true.

## REQUIRED INDEPENDENT RUNTIME TEST SEQUENCE

After resubmission, Codex will execute through the real UI against mock data:

```text
CLICK
→ INPUT
→ SAVE
→ VERIFY UI
→ REOPEN
→ EDIT
→ SAVE
→ RELOAD
→ VERIFY DATABASE STATE
```

### MAC-01

- Exercise every save action.
- Verify actual database success precedes the success modal.
- Verify check icon, exact success text, auto-dismiss, UI refresh, and persistence after reload.
- Include Data Siswa and Tulis Catatan.

### MAC-02

- Create a TP and input grades.
- Reopen Input Nilai.
- Verify the completed TP is disabled, gray, non-selectable, and remains so after reload.

### MAC-03

- Save grade `65`.
- Edit through Rekap to `85`.
- Verify no duplicate record, UI update, and reload persistence.

### MAC-04

- Select class, subject, and TP.
- Do not click an additional button.
- Verify all and only students from that class appear automatically.

### MAC-05

- Save Hadir, Sakit, Izin, and Alpa values.
- Verify success modal, auto-dismiss, `Presensi sudah dilakukan`, and `Edit Kehadiran`.
- Edit and reload; verify persistence.

### MAC-06

- Exercise default template and Edit Template workflows.
- Add/remove aspects and rows; save and reload.
- Export a workbook for N students and verify N sheets.
- Inspect workbook validity, names, per-student mapping, merged cells, widths, wrap, borders, styling, and visual fidelity.

### MAC-07

- Verify dropdown offers `Template 1 Kelas` and `Template Banyak Kelas`.
- Download both templates from the UI.
- Verify one sheet for single-class and exactly 12 sheets (`1A` through `6B`) for multi-class.
- Verify every sheet includes the class column expected by the importer.
- Perform full download-fill-save-upload-preview-import round trips.
- Import unique mock students: 3A = 3, 3B = 2, 4A = 4.
- Reject sheet/row class mismatch, blank class, `9Z`, and `UNKNOWN`.
- Verify duplicate behavior and second-batch behavior without silent overwrite.
- Verify zero cross-class leakage in Data Siswa, Presensi, Input Nilai, Rekap, and LPS/BLP.

### MAC-08

- Verify both TP template options and full UI round trips.
- Verify the multi-class workbook has 12 class sheets and required headers.
- Import scoped TP data for 3A, 3B, and 4A.
- Reject sheet/row mismatch and invalid classes.
- Treat the same TP code in different classes as independent.
- Grade 3A `MAT.1`; verify only 3A `MAT.1` becomes disabled.
- Verify student grid and Rekap remain class-isolated.

### CROSS-FEATURE, BACKUP, RESTORE, RESET, AND PWA

- Execute the complete cross-feature flow from batch students through LPS, backup, mutation, restore, and relational verification.
- Verify corrupt restore is atomic and cannot partially apply.
- Verify reset scope and reload state.
- Verify manifest, service worker, offline routes, cache version, stale-cache behavior, and asset paths.
- Capture console and network evidence throughout.
- Stop immediately if any production Firebase request or mutation path appears.

## REQUIRED RESUBMISSION EVIDENCE

Antigravity must provide:

- exact audit runtime command and URL;
- mock database type, target, and persistence model;
- proof that production endpoints cannot be contacted;
- updated runtime snapshot showing mock mode;
- MAC-07 reconstruction traceability;
- MAC-04 automatic-render traceability;
- per-scenario screenshots or recordings;
- downloaded template and generated workbook artifacts;
- before/after/reload mock database snapshots;
- console log and network log;
- updated root `RECONSTRUCTION_STATUS.md`.

## RELEASE VERDICT

SIMNI-GADM v4.6.4 is not eligible for independent runtime PASS in its current audit environment.

```text
STATE: AUDIT_COMPLETE
ACTOR: CODEX
BUILD_ID: SIMNI-GADM-v4.6.4
RESULT: BLOCKED
REASON: Updated MOCK declaration still contradicts executable firebase-cloud runtime; mock branch is not safely activatable; dbSet/archive/rollover bypass the adapter; production mutation remains possible
REPORT: CODEX_AUDIT_AND_TEST_REFERENCE_4.6.4.md
```
