#!/usr/bin/env node
/**
 * Chrome DevTools Protocol helper for interacting with WebView content.
 * Used by emu.sh for Plaid Link automation in the emulator.
 *
 * Requires: `ws` package (available via project's node_modules)
 *
 * Usage:
 *   node cdp-helper.js <action> [args...]
 *
 * Actions:
 *   click-text <text>         - Click the first button/element containing <text>
 *   click-exact <text>        - Click element whose textContent exactly matches <text>
 *   type-field <selector> <value> - Focus a field by CSS selector and type into it
 *   get-text                  - Return all visible text on the page
 *   wait-text <text> <timeout_ms> - Wait for text to appear, return 0 if found
 *   plaid-sandbox-flow        - Run the full Plaid sandbox link flow
 */

const http = require("http");

let ws;
try {
  ws = require("ws");
} catch {
  console.error(
    "Missing 'ws' package. Install it: pnpm add -D ws (or npm i -D ws)"
  );
  process.exit(1);
}

const CDP_PORT = process.env.CDP_PORT || 9222;
const CDP_TIMEOUT = 30000;

function getTarget() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timeout connecting to CDP")),
      10000
    );
    http
      .get(`http://localhost:${CDP_PORT}/json`, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          clearTimeout(timer);
          const targets = JSON.parse(data);
          const page = targets.find((t) => t.type === "page");
          if (!page) reject(new Error("No WebView page found"));
          else resolve(page.webSocketDebuggerUrl);
        });
      })
      .on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const client = new ws.WebSocket(wsUrl);
    let id = 0;

    const timer = setTimeout(() => {
      client.terminate();
      reject(new Error("WebSocket connection timeout"));
    }, 10000);

    client.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    function send(method, params) {
      return new Promise((res, rej) => {
        const myId = ++id;
        const msgTimer = setTimeout(() => {
          client.off("message", handler);
          rej(new Error(`CDP response timeout for ${method} (id=${myId})`));
        }, CDP_TIMEOUT);

        const handler = (msg) => {
          const r = JSON.parse(msg.toString());
          if (r.id === myId) {
            clearTimeout(msgTimer);
            client.off("message", handler);
            res(r);
          }
        };
        client.on("message", handler);
        client.send(JSON.stringify({ id: myId, method, params }));
      });
    }

    async function evaluate(expr) {
      const r = await send("Runtime.evaluate", {
        expression: expr,
        returnByValue: true,
      });
      return r.result?.result?.value;
    }

    async function clickAtCoords(x, y) {
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
    }

    async function clickElement(selector) {
      const coords = await evaluate(`
        (function() {
          const el = ${selector};
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })()
      `);
      if (coords) {
        await clickAtCoords(coords.x, coords.y);
        return true;
      }
      return false;
    }

    async function typeText(text) {
      for (const char of text) {
        await send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: char,
          text: char,
        });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: char });
        await sleep(30);
      }
    }

    client.on("open", () => {
      clearTimeout(timer);
      resolve({
        send,
        evaluate,
        clickAtCoords,
        clickElement,
        typeText,
        close: () => client.close(),
      });
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForText(cdp, text, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await cdp.evaluate(`
      document.body.innerText.includes(${JSON.stringify(text)})
    `);
    if (found) return true;
    await sleep(500);
  }
  return false;
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function clickText(cdp, text) {
  const clicked = await cdp.clickElement(
    `Array.from(document.querySelectorAll('button, a, [role="button"], li')).find(el => el.textContent.includes(${JSON.stringify(text)}))`
  );
  if (clicked) console.log(`Clicked: ${text}`);
  else console.error(`NOT FOUND: ${text}`);
  return clicked;
}

async function clickExact(cdp, text) {
  const clicked = await cdp.clickElement(
    `Array.from(document.querySelectorAll('button, a, [role="button"], li, div')).find(el => el.textContent.trim() === ${JSON.stringify(text)})`
  );
  if (clicked) console.log(`Clicked: ${text}`);
  else console.error(`NOT FOUND: ${text}`);
  return clicked;
}

async function typeField(cdp, selector, value) {
  await cdp.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).focus()`
  );
  await sleep(200);
  await cdp.typeText(value);
  console.log(`Typed into ${selector}`);
}

async function getText(cdp) {
  const text = await cdp.evaluate("document.body.innerText");
  console.log(text);
}

// Plaid sandbox credentials — these are Plaid's publicly documented test values
const PLAID_SANDBOX_USER = "user_good";
const PLAID_SANDBOX_PASS = "pass_good";

async function plaidSandboxFlow(cdp) {
  console.log("--- Waiting for Plaid Link to load ---");
  if (!(await waitForText(cdp, "Plaid", 15000))) {
    throw new Error("Plaid Link did not load");
  }
  await sleep(1000);

  // Check if we're on phone number screen or institution selection
  const hasPhone = await cdp.evaluate(
    `document.body.innerText.includes('phone number')`
  );
  if (hasPhone) {
    console.log("--- Step 1: Skip phone number ---");
    await cdp.clickElement(
      `Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('without phone'))`
    );
    await sleep(3000);
  }

  // Step 2: Search for First Platypus Bank
  console.log("--- Step 2: Search for First Platypus Bank ---");
  if (!(await waitForText(cdp, "institution", 10000))) {
    throw new Error("Institution selection did not load");
  }
  await sleep(500);

  await cdp.evaluate(
    `(document.querySelector('input[type="search"]') || document.querySelector('input')).focus()`
  );
  await sleep(300);
  await cdp.typeText("First Platypus Bank");
  await sleep(2000);

  // Click the result
  console.log("--- Step 3: Select First Platypus Bank ---");
  if (!(await waitForText(cdp, "First Platypus Bank", 5000))) {
    throw new Error("First Platypus Bank not found in results");
  }
  await cdp.clickElement(
    `Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('First Platypus Bank') && !el.textContent.includes('OAuth'))`
  );
  await sleep(3000);

  // If institution detail page shows (multiple options), pick the standard one
  const hasMultiple = await cdp.evaluate(
    `document.body.innerText.includes('associated institutions')`
  );
  if (hasMultiple) {
    console.log("--- Step 3b: Select standard (non-OAuth) option ---");
    await cdp.clickElement(
      `Array.from(document.querySelectorAll('button')).find(el => {
        const t = el.textContent.trim();
        return t.startsWith('First Platypus Bank') && !t.includes('OAuth');
      })`
    );
    await sleep(3000);
  }

  // Step 4: Enter sandbox credentials
  console.log("--- Step 4: Enter sandbox credentials ---");
  if (!(await waitForText(cdp, "Log into", 10000))) {
    throw new Error("Login form did not load");
  }
  await sleep(500);

  // Plaid's internal input IDs (fragile — may change across SDK versions)
  await cdp.evaluate(`document.querySelector('#aut-input-0-input').focus()`);
  await sleep(200);
  await cdp.typeText(PLAID_SANDBOX_USER);
  await sleep(200);

  await cdp.evaluate(`document.querySelector('#aut-input-1-input').focus()`);
  await sleep(200);
  await cdp.typeText(PLAID_SANDBOX_PASS);
  await sleep(200);

  await cdp.evaluate(`document.activeElement.blur()`);
  await sleep(300);

  // Click Submit
  console.log("--- Step 5: Submit credentials ---");
  await cdp.clickElement(
    `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Submit')`
  );
  await sleep(5000);

  // Step 6: Select accounts and continue
  console.log("--- Step 6: Select accounts ---");
  if (!(await waitForText(cdp, "Your accounts", 15000))) {
    throw new Error("Account selection did not load");
  }
  await sleep(1000);

  // Click Continue (all accounts should be pre-selected)
  console.log("--- Step 7: Click Continue ---");
  await cdp.clickElement(
    `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Continue')`
  );
  await sleep(5000);

  // Handle the "Save with Plaid" screen or success
  await sleep(2000);
  const pageText = await cdp.evaluate(`document.body.innerText`);

  if (pageText && pageText.includes("Save")) {
    console.log("--- Step 8: Skip saving with Plaid ---");
    const clicked = await cdp.clickElement(
      `Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('without saving') || el.textContent.includes('Finish without'))`
    );
    if (!clicked) {
      await cdp.clickElement(
        `Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.textContent.trim().includes('without saving'))`
      );
    }
    await sleep(3000);
    console.log("--- Plaid Link completed successfully! ---");
  } else if (pageText && pageText.includes("successfully")) {
    console.log("--- Plaid Link completed successfully! ---");
  } else if (pageText && pageText.includes("Session expired")) {
    throw new Error("Session expired - try again");
  } else {
    console.log("--- Current page state ---");
    console.log(pageText ? pageText.substring(0, 200) : "(empty)");
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [action, ...args] = process.argv.slice(2);

  if (!action) {
    console.error(
      "Usage: node cdp-helper.js <click-text|click-exact|type-field|get-text|wait-text|plaid-sandbox-flow>"
    );
    process.exit(1);
  }

  const wsUrl = await getTarget();
  const cdp = await connect(wsUrl);

  try {
    switch (action) {
      case "click-text":
        await clickText(cdp, args[0]);
        break;
      case "click-exact":
        await clickExact(cdp, args[0]);
        break;
      case "type-field":
        await typeField(cdp, args[0], args[1]);
        break;
      case "get-text":
        await getText(cdp);
        break;
      case "wait-text": {
        const found = await waitForText(
          cdp,
          args[0],
          parseInt(args[1]) || 15000
        );
        if (!found) throw new Error(`Text not found: ${args[0]}`);
        console.log(`Found: ${args[0]}`);
        break;
      }
      case "plaid-sandbox-flow":
        await plaidSandboxFlow(cdp);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } finally {
    cdp.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
