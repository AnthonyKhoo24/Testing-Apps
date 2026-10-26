import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100},colorScheme:'dark',reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');await page.evaluate(()=>document.fonts.ready);
for(const [i,name] of ['overview','calendar','estimate'].entries()){
await page.locator('.bottom-nav button').nth(i).click();await page.screenshot({path:`/workspace/artifacts/${name}.png`,fullPage:true});
if(i===1){await page.locator('.day.today').click();await page.locator('.sheet-total').waitFor();await page.getByRole('button',{name:'关闭',exact:true}).click()}
if(i===2){await page.getByRole('button',{name:/日常支出/}).click();if(await page.getByRole('button',{name:/日常支出/}).getAttribute('aria-expanded')!=='true')throw Error('Accordion failed')}
}
await page.setViewportSize({width:390,height:844});
for(const [i,name] of ['overview','calendar','estimate'].entries()){await page.locator('.bottom-nav button').nth(i).click();await page.screenshot({path:`/workspace/artifacts/${name}-mobile.png`,fullPage:true});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow '+name)}
await page.getByRole('button',{name:'切换主题'}).click();await page.screenshot({path:'/workspace/artifacts/estimate-light.png',fullPage:true});
await page.locator('.bottom-nav button').nth(0).click();await page.getByRole('button',{name:'添加账户'}).click();await page.getByPlaceholder('给这份积累起个名字').fill('测试储蓄');await page.getByPlaceholder('0.00').fill('1000');await page.getByRole('button',{name:'保存账户'}).click();await page.getByRole('heading',{name:'测试储蓄'}).waitFor();
if(errors.length)throw Error(errors.join('\n'));console.log('PASS: 3 pages, calendar sheet, estimate accordion, account creation, mobile overflow, light theme; no browser errors.');await browser.close();
