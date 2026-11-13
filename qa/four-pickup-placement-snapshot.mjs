import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5180/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__OUTPOST_DEBUG__?.snapshot().ready);
 const state=await page.evaluate(()=>window.__OUTPOST_DEBUG__.snapshot());
 await writeFile(new URL('./four-pickup-placement-snapshot.json',import.meta.url),JSON.stringify(state,null,2));
 console.log(JSON.stringify({colliders:state.colliders.length,assets:state.assets.map(a=>({name:a.name,dimensions:a.dimensions}))}));
} finally {await browser.close();}
