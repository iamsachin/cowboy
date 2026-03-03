import { describe, it, expect } from 'vitest';
import { createApp } from 'vue';
import { router } from '../src/router';
import App from '../src/App.vue';

describe('Vue App', () => {
  it('mounts without errors', () => {
    const div = document.createElement('div');
    div.id = 'app';
    document.body.appendChild(div);

    const app = createApp(App);
    app.use(router);

    // Should not throw
    expect(() => app.mount(div)).not.toThrow();

    app.unmount();
    document.body.removeChild(div);
  });
});

describe('Router Configuration', () => {
  it('has a route for /overview', () => {
    const routes = router.getRoutes();
    const overview = routes.find((r) => r.path === '/overview');
    expect(overview).toBeDefined();
    expect(overview!.name).toBe('overview');
  });

  it('has a route for /conversations', () => {
    const routes = router.getRoutes();
    const route = routes.find((r) => r.path === '/conversations');
    expect(route).toBeDefined();
    expect(route!.name).toBe('conversations');
  });

  it('has a route for /agents', () => {
    const routes = router.getRoutes();
    const route = routes.find((r) => r.path === '/agents');
    expect(route).toBeDefined();
    expect(route!.name).toBe('agents');
  });

  it('has a route for /analytics', () => {
    const routes = router.getRoutes();
    const route = routes.find((r) => r.path === '/analytics');
    expect(route).toBeDefined();
    expect(route!.name).toBe('analytics');
  });

  it('has a route for /settings', () => {
    const routes = router.getRoutes();
    const route = routes.find((r) => r.path === '/settings');
    expect(route).toBeDefined();
    expect(route!.name).toBe('settings');
  });

  it('redirects / to /overview', () => {
    const routes = router.getRoutes();
    // The redirect from / to /overview is defined, verify via router options
    const rootRoute = router.options.routes.find((r) => r.path === '/');
    expect(rootRoute).toBeDefined();
    expect(rootRoute!.redirect).toBe('/overview');
  });

  it('has exactly 5 named routes plus the redirect', () => {
    const namedRoutes = router.getRoutes().filter((r) => r.name);
    expect(namedRoutes).toHaveLength(5);
  });
});
