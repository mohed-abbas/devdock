import express from 'express';
import { createServer } from 'http';
import { PassThrough } from 'stream';
import { Server } from 'socket.io';
import Docker from 'dockerode';
import { verifySignedToken, type TokenPayload } from './terminal-auth';
import { createExecSession, resizeExec } from '../src/lib/docker/docker-service';

const app = express();
const httpServer = createServer(app);

const DEVDOCK_URL = process.env.DEVDOCK_URL || process.env.AUTH_URL || 'http://localhost:3000';

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

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
  const token = socket.handshake.auth?.token as string | undefined;

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
        // Forward exec output to /logs namespace subscribers watching the same container
        logsNs.to(`container:${containerId}`).emit('logs:data', {
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

// === Logs Namespace (D-08: reuse terminal server for log streaming) ===
const logsNs = io.of('/logs');

// Auth middleware — identical to terminal namespace
logsNs.use((socket, next) => {
  const token = (socket.handshake.auth?.token as string) ||
                (socket.handshake.query?.token as string);

  if (!token) {
    return next(new Error('Authentication required'));
  }

  const payload = verifySignedToken(token);
  if (!payload) {
    return next(new Error('Invalid or expired token'));
  }

  socket.data.environmentId = payload.environmentId;
  socket.data.userId = payload.userId;
  socket.data.containerId = payload.containerId;
  next();
});

// Track log streams per socket for cleanup
const logStreams = new Map<string, { stream: NodeJS.ReadableStream; passthrough: PassThrough }>();

logsNs.on('connection', async (socket) => {
  const { containerId } = socket.data;

  // Join the container room so exec output from /terminal can be broadcast here
  socket.join(`container:${containerId}`);

  try {
    const container = docker.getContainer(containerId);
    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 200,
      timestamps: false,
    });

    // Demux stdout/stderr into single PassThrough (Pitfall 1: binary garbage without demux)
    const passthrough = new PassThrough();
    docker.modem.demuxStream(stream as NodeJS.ReadableStream, passthrough, passthrough);

    logStreams.set(socket.id, {
      stream: stream as NodeJS.ReadableStream,
      passthrough,
    });

    passthrough.on('data', (chunk: Buffer) => {
      socket.emit('logs:data', { data: chunk.toString('utf-8') });
    });

    // Handle stream end (container stopped)
    passthrough.on('end', () => {
      socket.emit('logs:end', {});
    });

    // Also handle the raw stream end/error
    (stream as NodeJS.ReadableStream).on('end', () => {
      passthrough.end();
    });
    (stream as NodeJS.ReadableStream).on('error', () => {
      passthrough.end();
    });
  } catch (err) {
    socket.emit('logs:error', { message: 'Failed to attach to container logs' });
  }

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    const entry = logStreams.get(socket.id);
    if (entry) {
      try {
        (entry.stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
        entry.passthrough.destroy();
      } catch {
        // Already destroyed
      }
      logStreams.delete(socket.id);
    }
  });
});

// Start server
const PORT = parseInt(process.env.TERMINAL_PORT || '3001', 10);
httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`DevDock terminal server listening on 127.0.0.1:${PORT}`);
});
