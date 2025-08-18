/// <reference types="vite/client" />

declare module '@vitejs/plugin-react' {
  import { Plugin } from 'vite'
  export default function react(options?: any): Plugin
}