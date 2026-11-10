import './style.css';
import { App } from './app';

const app = new App(document.getElementById('app')!);

// Em desenvolvimento, expõe a instância para depurar pelo console do navegador (window.app).
if (import.meta.env.DEV) (window as unknown as { app: App }).app = app;
