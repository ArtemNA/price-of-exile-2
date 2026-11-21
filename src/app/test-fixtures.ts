/**
 * Test instance only: trade site answers a test on a hidden desktop gives the popup
 * (`trade <search.json> <fetch.json>` in `src-tauri/src/test_trigger.rs`), so the listings come
 * from saved files instead of the site. Empty in a release: nothing ever sets them.
 */
let trade: { search: string; fetch: string } | null = null;

export function setTestTrade(answers: { search: string; fetch: string }): void {
  trade = answers;
}

let testLog: ((text: string) => void) | null = null;

export function setTestLog(log: (text: string) => void): void {
  testLog = log;
}

/** A line for the test's log (timings and the like); nothing in a release. */
export function testReport(text: string): void {
  testLog?.(text);
}

/** The saved answer for a trade search or fetch URL, or null to ask the site. */
export function testTradeResponse(url: string): Response | null {
  if (!trade) return null;
  const body = url.includes('/api/trade2/search/') ? trade.search : url.includes('/api/trade2/fetch/') ? trade.fetch : null;
  return body == null ? null : new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}
