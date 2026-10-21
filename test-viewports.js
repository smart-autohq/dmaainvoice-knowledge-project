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

async function testViewport(w) {
  const edgeProc = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=' + w + ',850'
  ]);

  await sleep(1200);

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

    const clientScript = `
      (() => {
        try {
          const winW = window.innerWidth;
          const docEl = document.documentElement;
          const body = document.body;

          // Check if body or html has overflow-x hidden
          const bodyOv = window.getComputedStyle(body).overflowX;
          const htmlOv = window.getComputedStyle(docEl).overflowX;

          // True unclipped scrollWidth
          body.style.overflowX = 'visible';
          docEl.style.overflowX = 'visible';
          const unclippedScrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);

          // Find all elements that exceed winW
          const overflows = [];
          document.querySelectorAll('*').forEach(el => {
            if (el instanceof SVGElement && el.tagName !== 'svg') return;
            
            // Check if inside an overflow hidden/auto scroll container
            let p = el.parentElement;
            let insideScrollable = false;
            while (p && p !== body && p !== docEl) {
              const s = window.getComputedStyle(p);
              if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') {
                insideScrollable = true;
                break;
              }
              p = p.parentElement;
            }

            const r = el.getBoundingClientRect();
            if (r.right > winW + 0.5 && !insideScrollable) {
              overflows.push({
                tag: el.tagName,
                id: el.id,
                className: el.className,
                rectRight: Math.round(r.right),
                rectWidth: Math.round(r.width),
                overflow: Math.round(r.right - winW)
              });
            }
          });

          body.style.overflowX = bodyOv;
          docEl.style.overflowX = htmlOv;

          return JSON.stringify({
            winW,
            docClientW: docEl.clientWidth,
            unclippedScrollWidth,
            overflowExcess: unclippedScrollWidth - winW,
            overflows
          });
        } catch (err) {
          return JSON.stringify({ error: err.message, stack: err.stack });
        }
      })()
    `;

    const evalRes = await send('Runtime.evaluate', {
      expression: clientScript,
      returnByValue: true
    });

    console.log('\n================ Viewport ' + w + 'px ================');
    if (evalRes && evalRes.result && evalRes.result.value) {
      console.log(JSON.stringify(JSON.parse(evalRes.result.value), null, 2));
    } else {
      console.log('Raw evalRes:', JSON.stringify(evalRes, null, 2));
    }

    ws.close();
  } catch (err) {
    console.error('Error testing ' + w + 'px:', err);
  } finally {
    edgeProc.kill();
    await sleep(600);
  }
}

async function main() {
  for (const w of [320, 375, 390, 430]) {
    await testViewport(w);
  }
}

main();
