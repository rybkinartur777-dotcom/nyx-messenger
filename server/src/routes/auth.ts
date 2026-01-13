import { Router, Request, Response } from 'express';
import { getDb } from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nyx-secret-key-change-in-production';

// Register new user
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { id, nickname, publicKey } = req.body;

        if (!id || !nickname || !publicKey) {
            return res.status(400).json({
                success: false,
                error: 'ID, nickname, and publicKey are required'
            });
        }

        const db = getDb();

        // Check if nickname exists
        const existingUser = await db.get(
            'SELECT id FROM users WHERE nickname = ?',
            [nickname]
        );

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Nickname already taken'
            });
        }

        // Create user
        await db.run(`
      INSERT INTO users (id, nickname, public_key)
      VALUES (?, ?, ?)
    `, [id, nickname, publicKey]);

        // Generate JWT token
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await db.run(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `, [sessionId, id, expiresAt.toISOString()]);

        const token = jwt.sign(
            { userId: id, sessionId },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            data: {
                user: {
                    id,
                    nickname,
                    publicKey,
                    createdAt: new Date().toISOString()
                },
                token
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Login (reconnect with existing ID)
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { id, publicKey } = req.body;

        if (!id || !publicKey) {
            return res.status(400).json({
                success: false,
                error: 'ID and publicKey are required'
            });
        }

        const db = getDb();

        // Find user
        const user = await db.get(
            'SELECT * FROM users WHERE id = ?',
            [id]
        ) as any;

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Verify public key matches
        if (user.public_key !== publicKey) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate new session
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await db.run(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `, [sessionId, id, expiresAt.toISOString()]);

        const token = jwt.sign(
            { userId: id, sessionId },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    nickname: user.nickname,
                    publicKey: user.public_key,
                    avatar: user.avatar,
                    createdAt: user.created_at
                },
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { sessionId: string };
            const db = getDb();
            db.prepare('DELETE FROM sessions WHERE id = ?').run(decoded.sessionId);
        } catch {
            // Token invalid, ignore
        }
    }

    res.json({ success: true });
});

export default router;
