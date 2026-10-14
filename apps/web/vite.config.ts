import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
const apiTarget=process.env.API_PROXY_TARGET??'http://127.0.0.1:3100';
export default defineConfig({root:'apps/web',plugins:[vue()],server:{host:'0.0.0.0',port:5188,proxy:{'/api':apiTarget,'/health':apiTarget,'/ws':{target:apiTarget.replace(/^http/,'ws'),ws:true}}},build:{outDir:'../../dist/web',emptyOutDir:true}});
