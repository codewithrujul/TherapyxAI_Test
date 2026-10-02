/**
 * Tests the insights layer (services/insights.ts). No HuggingFace, no real user data.
 *   npx ts-node scripts/testInsights.ts
 */
import "./_env";
import { randomUUID } from "crypto";
import { bandScore, buildInsights, fetchSessionInsights, insightsFullyEnabled } from "../services/insights";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`);
}

const summary = (over: Record<string, number> = {}, risk = false) => ({
    session_summary: { Normal: 0.2, Depression: 0.0, Anxiety: 0.0, PTSD: 0.0, Suicidal: 0.0, ...over },
    high_risk_triggered: risk,
});

async function main() {
    // ── banding ───────────────────────────────────────────────────────────────
    check("band: below 0.30 -> nothing", bandScore(0.29) === null);
    check("band: 0.30 -> light", bandScore(0.30) === "light");
    check("band: 0.50 -> moderate", bandScore(0.50) === "moderate");
    check("band: 0.70 -> strong", bandScore(0.70) === "strong");

    // ── kill switch ───────────────────────────────────────────────────────────
    const off = buildInsights({ enabled: false, jobStatus: "done", summary: summary({ Depression: 0.9 }, true) });
    check("disabled -> hidden, no themes, no support card", off.status === "hidden" && off.themes.length === 0 && off.showSupport === false);

    // ── ready: themes are mapped to plain language, sorted, capped ───────────
    const ready = buildInsights({ enabled: true, jobStatus: "done",
        summary: summary({ Depression: 0.62, Anxiety: 0.41, PTSD: 0.75 }) });
    check("ready status", ready.status === "ready");
    check("themes sorted by strength (PTSD, Depression, Anxiety)",
        ready.themes.map(t => t.key).join(",") === "difficult_experiences,low_mood,worry", JSON.stringify(ready.themes));
    check("levels are bands (strong, moderate, light)",
        ready.themes.map(t => t.level).join(",") === "strong,moderate,light");
    check("plain-language labels, no clinical terms",
        ready.themes.every(t => !/depress|anxi|ptsd|suicid/i.test(t.label)), JSON.stringify(ready.themes.map(t => t.label)));

    const quiet = buildInsights({ enabled: true, jobStatus: "done", summary: summary({ Depression: 0.1, Anxiety: 0.1 }) });
    check("nothing stands out -> ready with empty themes", quiet.status === "ready" && quiet.themes.length === 0);

    // ── the suicide score must never be exposed ──────────────────────────────
    const risky = buildInsights({ enabled: true, jobStatus: "done", summary: summary({ Suicidal: 0.93, Depression: 0.5 }, true) });
    const json = JSON.stringify(risky);
    check("high risk -> showSupport true", risky.showSupport === true);
    check("output never contains the suicide score or the word suicid*", !/suicid|0\.93/i.test(json), json);
    check("output contains no raw numbers at all", !/\d\.\d/.test(json), json);
    const notRisky = buildInsights({ enabled: true, jobStatus: "done", summary: summary({ Suicidal: 0.2 }, false) });
    check("no risk flag -> showSupport false", notRisky.showSupport === false);

    // ── job states ────────────────────────────────────────────────────────────
    const st = (jobStatus: string | null) => buildInsights({ enabled: true, jobStatus, summary: null }).status;
    check("pending -> pending", st("pending") === "pending");
    check("processing -> pending", st("processing") === "pending");
    check("failed -> unavailable", st("failed") === "unavailable");
    check("done but no summary -> unavailable", st("done") === "unavailable");
    check("skipped -> hidden", st("skipped") === "hidden");
    check("no job (old session / guest) -> hidden", st(null) === "hidden");

    // ── "reflecting on your session" notice is only promised when results can really appear ─
    const combos: Array<[string | undefined, string | undefined, boolean]> = [
        ["true", "true", true], ["true", undefined, false], [undefined, "true", false], [undefined, undefined, false], ["false", "true", false],
    ];
    const savedA = process.env.ANALYSIS_ENABLED, savedI = process.env.INSIGHTS_ENABLED;
    for (const [a, i, want] of combos) {
        if (a === undefined) delete process.env.ANALYSIS_ENABLED; else process.env.ANALYSIS_ENABLED = a;
        if (i === undefined) delete process.env.INSIGHTS_ENABLED; else process.env.INSIGHTS_ENABLED = i;
        check(`insightsFullyEnabled: ANALYSIS=${a ?? "unset"} INSIGHTS=${i ?? "unset"} -> ${want}`, insightsFullyEnabled() === want);
    }
    if (savedA === undefined) delete process.env.ANALYSIS_ENABLED; else process.env.ANALYSIS_ENABLED = savedA;
    if (savedI === undefined) delete process.env.INSIGHTS_ENABLED; else process.env.INSIGHTS_ENABLED = savedI;

    // ── ownership: a session that isn't yours (or doesn't exist) -> null -> 404 ─
    process.env.INSIGHTS_ENABLED = "true";
    const missing = await fetchSessionInsights(randomUUID(), randomUUID());
    check("unknown session / wrong user -> null (endpoint returns 404)", missing === null);

    console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
}

main().then(() => process.exit(failures === 0 ? 0 : 1)).catch(err => { console.error("ERROR:", err.message); process.exit(1); });
