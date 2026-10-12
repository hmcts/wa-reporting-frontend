import type { Application, Request, Response } from 'express';

export default function registerActiveRoute(app: Application): void {
  app.get('/active', (_req: Request, res: Response) => {
    res.sendStatus(204);
  });
}
