const UPSTREAM = 'https://shared-calendar-4pu.pages.dev';
const PREFIX = '/calendar-app';
const COOKIE_PREFIX = 'nescal_';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const calendar = url.pathname === PREFIX || url.pathname.startsWith(PREFIX + '/');
    const api = url.pathname.startsWith('/api/');
    if (!calendar && !api) return env.ASSETS.fetch(request);
    if (url.pathname === PREFIX) return Response.redirect(url.origin + PREFIX + '/' + url.search, 308);
    if (!['GET', 'HEAD'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (origin !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
        return new Response('Forbidden', { status: 403 });
      }
    }
    const target = new URL(UPSTREAM);
    target.pathname = calendar ? url.pathname.slice(PREFIX.length) : url.pathname;
    target.search = url.search;
    const headers = new Headers();
    for (const name of ['accept', 'content-type', 'if-none-match']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Only this integration's cookies are forwarded to the existing service.
    const cookies = (request.headers.get('cookie') || '').split(';').map(v => v.trim())
      .filter(v => v.startsWith(COOKIE_PREFIX)).map(v => v.slice(COOKIE_PREFIX.length));
    if (cookies.length) headers.set('cookie', cookies.join('; '));
    if (request.headers.has('origin')) headers.set('origin', UPSTREAM);
    const upstream = await fetch(target, {
      method: request.method, headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual'
    });
    const output = new Headers(upstream.headers);
    output.delete('set-cookie');
    for (const cookie of upstream.headers.getSetCookie()) {
      const scoped = COOKIE_PREFIX + cookie.replace(/;\s*Domain=[^;]+/gi, '');
      output.append('set-cookie', scoped);
    }
    output.set('cache-control', 'private, no-store');
    output.set('x-content-type-options', 'nosniff');
    output.set('x-frame-options', 'SAMEORIGIN');
    output.delete('access-control-allow-origin');
    output.delete('access-control-allow-credentials');
    const location = output.get('location');
    if (location) {
      const dest = new URL(location, target);
      if (dest.origin !== UPSTREAM) return new Response('Unexpected redirect', { status: 502 });
      output.set('location', url.origin + (dest.pathname.startsWith('/api/') ? '' : PREFIX) + dest.pathname + dest.search + dest.hash);
    }
    if (calendar && target.pathname === '/app.js' && upstream.ok) {
      const script = (await upstream.text()).replace('location.origin + "/?admin_view="', 'location.origin + "/calendar-app/?admin_view="');
      output.delete('content-length');
      output.delete('content-encoding');
      output.delete('etag');
      return new Response(script, { status: upstream.status, headers: output });
    }
    return new Response(upstream.body, { status: upstream.status, headers: output });
  }
};
