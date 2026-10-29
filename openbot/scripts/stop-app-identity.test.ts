import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

// Exercise the real stop.sh identification function with a fake HTTP response.
// No services or containers are started/stopped by this test.
const stopScript = await readFile("scripts/stop.sh", "utf8");
const functionSource = stopScript.match(/^identifies_as_openbot\(\) \{[\s\S]*?^\}/m)?.[0];
if (!functionSource) throw new Error("stop.sh app identity check not found");

async function identifies(html: string) {
  const script = `
${functionSource}
curl() { printf '%s' "$MOCK_HTML"; }
identifies_as_openbot 3010 app
`;
  const child = Bun.spawn(["bash", "-c", script], {
    env: { ...process.env, MOCK_HTML: html },
    stdout: "pipe",
    stderr: "pipe",
  });
  return (await child.exited) === 0;
}

describe("stop.sh recognizes only our app", () => {
  test("recognizes the current OpenDuet page via its stable meta marker", async () => {
    const html = await readFile("app/index.html", "utf8");
    expect(html).toContain("<title>OpenDuet</title>");
    expect(await identifies(html)).toBe(true);
  });

  test("preserves compatibility with older OpenBot-branded pages", async () => {
    expect(await identifies("<html><head><title>OpenBot</title></head></html>")).toBe(true);
  });

  test("does not treat an unrelated app as ours", async () => {
    expect(await identifies("<html><head><title>Other dashboard</title></head></html>")).toBe(false);
  });
});
