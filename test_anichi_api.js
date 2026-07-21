const { chromium } = require('playwright');
const fs = require('fs');

async function testApi() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    try {
        console.log("Navigating to home to get cookies...");
        await page.goto('https://anichi.to/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        console.log("Fetching API via page.evaluate...");
        const result = await page.evaluate(async () => {
            try {
                const res = await fetch('/ajax/search/suggest?keyword=jujutsu');
                const text = await res.text();
                return { status: res.status, text };
            } catch (e) {
                return { error: e.message };
            }
        });
        
        console.log("API Result:", result);
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
testApi();
