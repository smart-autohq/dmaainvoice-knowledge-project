const { spawn } = require('child_process');
const http = require('http');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

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
  const edgeProc = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check'
  ]);

  await sleep(1500);

  try {
    const list = await fetchJson('http://127.0.0.1:9222/json/list');
    const target = list[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    let msgId = 1;
    const callbacks = new Map();
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg);
        callbacks.delete(msg.id);
      }
    };

    function send(method, params = {}) {
      return new Promise(resolve => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise(r => ws.onopen = r);
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
    await sleep(1500);

    for (const w of [320, 375, 390, 430]) {
      // Set device metrics
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 850,
        deviceScaleFactor: 1,
        mobile: true
      });
      await sleep(400);

      const script = `
        (() => {
          const winW = window.innerWidth;
          const sections = document.querySelectorAll('header, section, footer, .container, .affiliation-card, .facilitator-card, .session-card, .principle-card');
          const report = [];

          sections.forEach(el => {
            const r = el.getBoundingClientRect();
            const tag = el.tagName.toLowerCase();
            const id = el.id ? '#' + el.id : '';
            const cls = el.className ? '.' + el.className.split(' ').join('.') : '';
            report.push({
              name: tag + id + cls,
              left: Math.round(r.left),
              right: Math.round(r.right),
              width: Math.round(r.width),
              overflow: Math.round(r.right - winW)
            });
          });

          return JSON.stringify({
            viewport: winW,
            docScrollWidth: document.documentElement.scrollWidth,
            sections: report.filter(item => item.overflow > 0)
          });
        })()
      `;

      const evalRes = await send('Runtime.evaluate', {
        expression: script,
        returnByValue: true
      });

      console.log('=== Viewport ' + w + 'px ===');
      console.log(evalRes.result.value);
    }

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run();
