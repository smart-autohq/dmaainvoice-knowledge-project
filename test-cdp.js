const { spawn } = require('child_process');
const http = require('http');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const edgeProc = spawn(edgePath, [
  '--headless',
  '--remote-debugging-port=9222',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check'
]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function run() {
  await sleep(1500);
  try {
    const list = await fetchJson('http://127.0.0.1:9222/json/list');
    console.log('Open targets:', list.length);
    const target = list[0];
    const wsUrl = target.webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg);
        callbacks.delete(msg.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise(r => ws.onopen = r);

    await send('Page.enable');
    await send('DOM.enable');

    await send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
    await sleep(2000);

    const viewports = [320, 375, 390, 430];
    for (const w of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true,
        screenOrientation: { angle: 0, type: 'portraitPrimary' }
      });
      await send('Emulation.setVisibleSize', { width: w, height: 800 });
      await sleep(500);

      const res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const winW = window.innerWidth;
            const overflowing = [];

            // Temporarily disable overflow:hidden on body/html to measure true document scrollWidth
            const prevHtmlOv = document.documentElement.style.overflowX;
            const prevBodyOv = document.body.style.overflowX;
            document.documentElement.style.overflowX = 'visible';
            document.body.style.overflowX = 'visible';

            const trueScrollWidth = document.documentElement.scrollWidth;

            document.querySelectorAll('*').forEach(el => {
              const r = el.getBoundingClientRect();
              if (r.right > winW + 1) {
                overflowing.push({
                  tag: el.tagName,
                  id: el.id,
                  cls: typeof el.className === 'string' ? el.className : '',
                  right: Math.round(r.right),
                  width: Math.round(r.width),
                  overflow: Math.round(r.right - winW)
                });
              }
            });

            document.documentElement.style.overflowX = prevHtmlOv;
            document.body.style.overflowX = prevBodyOv;

            return {
              winW,
              trueScrollWidth,
              overflowCount: overflowing.length,
              topOverflows: overflowing.slice(0, 15)
            };
          })()
        `,
        returnByValue: true
      });

      console.log('=== Viewport ' + w + 'px ===');
      console.log(JSON.stringify(res.result ? res.result.value || res.result : res, null, 2));
    }

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
  }
}

run();
