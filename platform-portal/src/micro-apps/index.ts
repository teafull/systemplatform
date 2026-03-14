import { registerMicroApps, start } from 'qiankun';
import { useAuthStore } from '../stores/auth.store';

/**
 * 组件挂载前钩子
 */
const beforeLoad = async (app: any) => {
  console.log('[MicroApp] Loading:', app.name);
};

/**
 * 组件挂载后钩子
 */
const afterMount = async (app: any) => {
  console.log('[MicroApp] Mounted:', app.name);
};

/**
 * 组件卸载后钩子
 */
const afterUnmount = async (app: any) => {
  console.log('[MicroApp] Unmounted:', app.name);
};

/**
 * 自定义沙箱
 * 用于在主应用和子应用之间共享状态
 */
let globalState: any = null;

export function initMicroApps() {
  const { token, user } = useAuthStore.getState();

  // 初始化全局状态
  globalState = {
    token,
    user,
    emitEvent: (event: string, data: any) => {
      window.dispatchEvent(new CustomEvent(event, { detail: data }));
    },
    onEvent: (event: string, handler: (data: any) => void) => {
      window.addEventListener(event, (e: any) => handler(e.detail));
    }
  };

  // 注入全局状态到window
  (window as any).__PLATFORM__ = globalState;
}

/**
 * 注册微应用
 */
export function registerApps(apps: any[]) {
  const microApps = apps.map((app) => ({
    name: app.name,
    entry: app.frontendUrl,
    container: '#subapp-container',
    activeRule: (location: Location) => location.pathname.startsWith(app.routePath),
    props: {
      getGlobalState: () => globalState,
      routerBase: app.routePath,
      mainApp: true
    }
  }));

  registerMicroApps(microApps, {
    beforeLoad,
    afterMount,
    afterUnmount,
  });

  start({
    sandbox: {
      strictStyleIsolation: true,
      experimentalStyleIsolation: true
    },
    prefetch: true,
    singular: false,
  });
}

/**
 * 动态加载单个应用
 */
export async function loadMicroApp(app: any) {
  const { loadMicroApp: qiankunLoadMicroApp } = await import('qiankun');

  return qiankunLoadMicroApp({
    name: app.name,
    entry: app.frontendUrl,
    container: '#subapp-container',
    activeRule: (location: Location) => location.pathname.startsWith(app.routePath),
    props: {
      getGlobalState: () => globalState,
      routerBase: app.routePath
    }
  });
}
