import { Router, Request, Response } from 'express';
import { getDb } from '../models/database.js';

const router = Router();

// Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db = getDb();

        const user = await db.get(`
      SELECT id, nickname, public_key, avatar, allow_search_by_nickname, created_at
      FROM users WHERE id = ?
    `, [id]) as any;

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                nickname: user.nickname,
                publicKey: user.public_key,
                avatar: user.avatar,
                allowSearchByNickname: !!user.allow_search_by_nickname,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Search users by nickname (if allowed)
router.get('/search/:query', async (req: Request, res: Response) => {
    try {
        const { query } = req.params;
        const db = getDb();

        if (query.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Query must be at least 3 characters'
            });
        }

        const users = await db.all(`
      SELECT id, nickname, avatar
      FROM users 
      WHERE allow_search_by_nickname = 1 
        AND nickname LIKE ?
      LIMIT 20
    `, [`%${query}%`]) as any[];

        res.json({
            success: true,
            data: users.map(u => ({
                id: u.id,
                nickname: u.nickname,
                avatar: u.avatar
            }))
        });
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Update user profile
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nickname, avatar, allowSearchByNickname, autoDeleteMessages } = req.body;
        const db = getDb();

        const updates: string[] = [];
        const values: any[] = [];

        if (nickname !== undefined) {
            // Check nickname uniqueness
            const existing = await db.get(
                'SELECT id FROM users WHERE nickname = ? AND id != ?',
                [nickname, id]
            );

            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: 'Nickname already taken'
                });
            }

            updates.push('nickname = ?');
            values.push(nickname);
        }

        if (avatar !== undefined) {
            updates.push('avatar = ?');
            values.push(avatar);
        }

        if (allowSearchByNickname !== undefined) {
            updates.push('allow_search_by_nickname = ?');
            values.push(allowSearchByNickname ? 1 : 0);
        }

        if (autoDeleteMessages !== undefined) {
            updates.push('auto_delete_messages = ?');
            values.push(autoDeleteMessages);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No updates provided'
            });
        }

        values.push(id);

        await db.run(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `, values);

        const user = await db.get('SELECT * FROM users WHERE id = ?', [id]) as any;

        res.json({
            success: true,
            data: {
                id: user.id,
                nickname: user.nickname,
                avatar: user.avatar,
                allowSearchByNickname: !!user.allow_search_by_nickname,
                autoDeleteMessages: user.auto_delete_messages
            }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

export default router;
