import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { isAdminRole } from '../utils/roles';

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!isAdminRole(req.userRole)) {
    return res.status(403).json({ error: 'Acces reserve aux administrateurs' });
  }
  next();
}
