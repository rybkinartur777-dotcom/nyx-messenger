import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { initDatabase } from './models/database.js';
import { setupSocketHandlers } from './socket/handlers.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import chatRoutes from './routes/chats.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
    cors: {
        origin: '*', // Allow all origins for the public messenger
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // For easier deployment debugging
}));
app.use(cors({
    origin: '*' // Allow all origins for the public messenger
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'nyx-server' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);

// Serve static files from the client app
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

// Catch-all route to serve the React app (must be after API routes)
app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Socket.io handlers
setupSocketHandlers(io);

// Initialize database and start server
const PORT = process.env.PORT || 4000;

initDatabase().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║   🌙 NYX Server running on port ${PORT}     ║
║   🔐 End-to-end encryption enabled        ║
║                                           ║
╚═══════════════════════════════════════════╝
    `);
    });
}).catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

export { io };
