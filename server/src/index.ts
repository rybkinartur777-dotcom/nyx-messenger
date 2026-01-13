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

// Basic route to confirm server is alive
app.get('/', (req, res) => {
    res.send('🌙 NYX Secure Messenger Server is running');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);

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
