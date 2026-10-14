import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/browser',use:{baseURL:process.env.PLAYWRIGHT_BASE_URL??'http://localhost:5188',screenshot:'only-on-failure'},workers:1,timeout:30000});
