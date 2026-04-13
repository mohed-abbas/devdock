import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { verifySignedToken, type TokenPayload } from './terminal-auth';
import { createExecSession, resizeExec } from '../src/lib/docker/docker-service';

const app = express();
const httpServer = createServer(app);

const DEVDOCK_URL = process.env.DEVDOCK_URL || process.env.AUTH_URL || 'http://localhost:3000';

const io = new Server(httpServer, {
  path: '/ws/socket.io',
  cors: {
    origin: DEVDOCK_URL,
    credentials: true,
  },
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'devdock-terminal' });
});

// === Terminal Namespace ===
const terminalNs = io.of('/terminal');

// Auth middleware (D-05): validate signed token before connection
terminalNs.use((socket, next) => {
  const token = (socket.handshake.auth?.token as string) ||
                (socket.handshake.query?.token as string);

  if (!token) {
    return next(new Error('Authentication required'));
  }

  const payload = verifySignedToken(token);
  if (!payload) {
    return next(new Error('Invalid or expired token'));
  }

  // Attach validated data to socket
  socket.data.environmentId = payload.environmentId;
  socket.data.userId = payload.userId;
  socket.data.containerId = payload.containerId;
  next();
});

// Track exec sessions per socket for cleanup (Pitfall 2)
interface ExecSessionInfo {
  execId: string;
  stream: NodeJS.ReadWriteStream;
}

const socketSessions = new Map<string, ExecSessionInfo[]>();

terminalNs.on('connection', (socket) => {
  const { containerId } = socket.data;
  socketSessions.set(socket.id, []);

  // Create a new exec session (one per terminal tab)
  // Uses createExecSession from docker-service.ts (DRY, shared with Plan 01)
  socket.on('exec:create', async (data: { cols: number; rows: number }) => {
    try {
      const cols = Math.max(1, Math.min(500, Math.floor(data.cols || 80)));
      const rows = Math.max(1, Math.min(200, Math.floor(data.rows || 24)));

      const { execId, stream } = await createExecSession(containerId, cols, rows);

      // Track for cleanup
      const sessions = socketSessions.get(socket.id) || [];
      sessions.push({ execId, stream });
      socketSessions.set(socket.id, sessions);

      const sessionIndex = sessions.length - 1;

      // Pipe container output -> browser
      stream.on('data', (chunk: Buffer) => {
        socket.emit('exec:output', {
          sessionIndex,
          data: chunk.toString('utf-8'),
        });
      });

      // Handle stream end
      stream.on('end', () => {
        socket.emit('exec:exit', { sessionIndex });
      });

      socket.emit('exec:created', { sessionIndex });
    } catch (err) {
      socket.emit('exec:error', {
        message: 'Failed to create terminal session',
      });
    }
  });

  // Terminal input from browser -> container stdin
  socket.on('exec:input', (data: { sessionIndex: number; data: string }) => {
    const sessions = socketSessions.get(socket.id);
    if (!sessions || !sessions[data.sessionIndex]) return;
    const { stream } = sessions[data.sessionIndex];
    try {
      stream.write(data.data);
    } catch {
      // Stream may have been destroyed
    }
  });

  // Resize event from browser (debounced on client, Pitfall 3)
  // Uses resizeExec from docker-service.ts (DRY, shared with Plan 01)
  socket.on('exec:resize', async (data: { sessionIndex: number; cols: number; rows: number }) => {
    const sessions = socketSessions.get(socket.id);
    if (!sessions || !sessions[data.sessionIndex]) return;
    const { execId } = sessions[data.sessionIndex];

    const cols = Math.max(1, Math.min(500, Math.floor(data.cols)));
    const rows = Math.max(1, Math.min(200, Math.floor(data.rows)));

    try {
      await resizeExec(execId, cols, rows);
    } catch {
      // Exec may have ended
    }
  });

  // Cleanup on disconnect (Pitfall 2)
  socket.on('disconnect', () => {
    const sessions = socketSessions.get(socket.id);
    if (sessions) {
      for (const session of sessions) {
        try {
          (session.stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
        } catch {
          // Already destroyed
        }
      }
      socketSessions.delete(socket.id);
    }
  });
});

// Start server
const PORT = parseInt(process.env.TERMINAL_PORT || '3001', 10);
httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`DevDock terminal server listening on 127.0.0.1:${PORT}`);
});
