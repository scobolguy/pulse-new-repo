export function registerHelloServiceRoutes(app) {
  app.get('/api/helloService', (_req, res) => {
    res.type('text/plain').send('hello, world');
  });
}
