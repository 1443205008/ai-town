import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('M0 浏览器登录、实时地图、暂停与重载',async({page})=>{
 const password=readFileSync('.env','utf8').match(/^MAYOR_PASSWORD=(.+)$/m)![1];
 await page.goto('/');await page.getByLabel('镇长通行密码').fill(password);await page.getByRole('button',{name:'进入晨沙镇'}).click();
 await expect(page.getByText('世界已连接')).toBeVisible();await expect(page.locator('canvas')).toBeVisible();
 await page.getByRole('button',{name:'Ⅱ 暂停'}).click();await expect(page.getByRole('button',{name:'▶ 继续'})).toBeVisible();
 const state=await page.evaluate(async()=>fetch('/api/worlds/starter/state').then(r=>r.json()));
 await page.reload();await expect(page.getByText('世界已连接')).toBeVisible();
 expect(await page.evaluate(async()=>fetch('/api/worlds/starter/state').then(r=>r.json()).then(s=>s.gameTime))).toBe(state.gameTime);
 await page.mouse.move(500,350);await page.mouse.wheel(0,-200);await page.screenshot({path:'docs/reports/M0-browser.png'});
 await page.getByRole('button',{name:'▶ 继续'}).click();
});

test('移动端可浏览管理标签和地图，数据面板保持在视口内',async({page})=>{
 const password=readFileSync('.env','utf8').match(/^MAYOR_PASSWORD=(.+)$/m)![1];await page.setViewportSize({width:390,height:844});
 await page.goto('/');await page.getByLabel('镇长通行密码').fill(password);await page.getByRole('button',{name:'进入晨沙镇'}).click();await expect(page.locator('canvas')).toBeVisible();
 const nav=page.locator('nav'),box=await nav.boundingBox();expect(box?.width).toBeLessThanOrEqual(390);await page.getByRole('button',{name:'财政',exact:true}).click();await expect(page.getByText('财政与资源')).toBeVisible();
 const map=await page.locator('#town-canvas').boundingBox(),aside=await page.locator('aside').boundingBox();expect(map?.height).toBeGreaterThan(200);expect(aside?.y).toBeGreaterThan(map!.y);await page.screenshot({path:'docs/reports/mobile-finance.png'});
});
