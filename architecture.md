# Claude Code VPS — Complete Architecture & Flow

## Table of Contents
1. [Should We Dockerize Claude Code?](#dockerize-decision)
2. [Complete System Architecture](#system-architecture)
3. [Startup Flow — How the Session Turns On](#startup-flow)
4. [User Interaction Flow — Phone to Code to Preview](#interaction-flow)
5. [Multi-Project Session Flow](#multi-project-flow)
6. [Dev Staging Lifecycle](#staging-lifecycle)
7. [Network & Security Architecture](#network-security)
8. [Directory Structure](#directory-structure)
9. [Service Management](#service-management)
10. [Remote Control Feature Parity](#remote-feature-parity)
11. [Workaround Strategy for Remote Limitations](#workaround-strategy)
8. [Directory Structure](#directory-structure)
9. [Service Management](#service-management)

---

## 1. Should We Dockerize Claude Code? <a name="dockerize-decision"></a>

**Short answer: No. Run it natively.**

```
┌─────────────────────────────────────────────────────┐
│              WHY NOT DOCKERIZE?                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Claude Code needs to:                               │
│    ✦ Access the host filesystem (edit project files) │
│    ✦ Run docker commands (manage dev containers)     │
│    ✦ Run git commands (clone, push, branch)          │
│    ✦ Execute arbitrary tools (ripgrep, npm, etc.)    │
│    ✦ Maintain persistent auth tokens (~/.claude/)    │
│                                                      │
│  Dockerizing it would require:                       │
│    ✗ Mounting the docker socket (security risk)      │
│    ✗ Mounting all project dirs as volumes             │
│    ✗ Docker-in-Docker complexity                     │
│    ✗ Rebuilding image on every Claude Code update    │
│    ✗ No real isolation benefit (it needs host access) │
│                                                      │
│  Native gives us:                                    │
│    ✓ Direct filesystem access                        │
│    ✓ Simple systemd service management               │
│    ✓ Auto-updates via npm/curl                       │
│    ✓ User-level isolation (devuser ≠ murx)           │
│    ✓ Less resource overhead (~50MB saved)            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

Claude Code runs as a **native process** under a dedicated user, managed by **systemd + tmux**.
Dev staging containers it controls ARE dockerized — only Claude Code itself is not.

---

## 2. Complete System Architecture <a name="system-architecture"></a>

```
┌──────────────────────────────────────────────────────────────────────┐
│                        HOSTINGER VPS KVM2                            │
│                   2 vCPU │ 8GB RAM │ 100GB SSD                      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    PRODUCTION ZONE (user: murx)                │  │
│  │                        *** UNTOUCHED ***                       │  │
│  │                                                                │  │
│  │  /home/murx/shared/          /home/murx/apps/                 │  │
│  │  ┌──────────────────┐       ┌──────────────────┐              │  │
│  │  │  Docker Network:  │       │  Docker Network:  │             │  │
│  │  │   prod-shared     │       │   prod-apps       │             │  │
│  │  │                   │       │                   │              │  │
│  │  │  ┌─────────────┐ │       │  ┌─────────────┐ │              │  │
│  │  │  │   Nginx     │◄├───────├──┤  Portfolio   │ │              │  │
│  │  │  │  (reverse   │ │       │  │  Container   │ │              │  │
│  │  │  │   proxy)    │ │       │  └─────────────┘ │              │  │
│  │  │  └──────┬──────┘ │       │  ┌─────────────┐ │              │  │
│  │  │  ┌──────┴──────┐ │       │  │  Tasktrox    │ │              │  │
│  │  │  │  Certbot    │ │       │  │  Container   │ │              │  │
│  │  │  └─────────────┘ │       │  └─────────────┘ │              │  │
│  │  │  ┌─────────────┐ │       │  ┌─────────────┐ │              │  │
│  │  │  │  PostgreSQL  │ │       │  │  Permitto    │ │              │  │
│  │  │  └─────────────┘ │       │  │  Container   │ │              │  │
│  │  │  ┌─────────────┐ │       │  └─────────────┘ │              │  │
│  │  │  │   Redis     │ │       │  Blue-Green       │              │  │
│  │  │  └─────────────┘ │       │  Deployment ✓     │              │  │
│  │  └──────────────────┘       └──────────────────┘              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                 DEVELOPMENT ZONE (user: devuser)               │  │
│  │                                                                │  │
│  │  /home/devuser/                                                │  │
│  │  ├── .claude/              ← Auth tokens, config               │  │
│  │  │                                                             │  │
│  │  ├── repos/                ← GitHub clones                     │  │
│  │  │   ├── portfolio/                                            │  │
│  │  │   ├── tasktrox/                                             │  │
│  │  │   ├── permitto/                                             │  │
│  │  │   └── (future projects)                                     │  │
│  │  │                                                             │  │
│  │  ├── staging/                                                  │  │
│  │  │   ├── docker-compose.dev.yml   ← Dev containers config     │  │
│  │  │   └── nginx-dev.conf           ← Dev subdomain routing     │  │
│  │  │                                                             │  │
│  │  └── NATIVE PROCESSES (not dockerized):                        │  │
│  │      ┌──────────────────────────────────────┐                  │  │
│  │      │  systemd: claude-remote.service       │                 │  │
│  │      │    └── tmux session: claude-remote    │                 │  │
│  │      │         └── claude remote-control     │                 │  │
│  │      │              --name "VPS Dev"          │                 │  │
│  │      │              --spawn worktree          │                 │  │
│  │      │              --capacity 4              │                 │  │
│  │      └──────────────┬───────────────────────┘                  │  │
│  │                     │ outbound HTTPS                            │  │
│  │                     ▼                                           │  │
│  │              Anthropic API servers                              │  │
│  │                     ▲                                           │  │
│  │                     │                                           │  │
│  │  Docker Network: dev-net (isolated from prod)                  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐             │  │
│  │  │ dev-tasktrox │ │dev-permitto │ │ dev-postgres  │            │  │
│  │  │  :3001       │ │  :3002      │ │  (alpine,     │            │  │
│  │  │ (on-demand)  │ │ (on-demand) │ │   128MB)      │            │  │
│  │  └─────────────┘ └─────────────┘ └──────────────┘             │  │
│  │          ▲               ▲                                     │  │
│  │          │               │        ┌──────────────┐             │  │
│  │          │               │        │  dev-redis    │            │  │
│  │   volume mounts from     │        │  (64MB max)   │            │  │
│  │   /home/devuser/repos/   │        └──────────────┘             │  │
│  │                          │                                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  NGINX ROUTING (in murx's shared nginx config)                │  │
│  │                                                                │  │
│  │  tasktrox.com          → prod tasktrox container              │  │
│  │  permitto.com          → prod permitto container              │  │
│  │  portfolio.com         → prod portfolio container             │  │
│  │  dev.tasktrox.com      → localhost:3001 (dev container)       │  │
│  │  dev.permitto.com      → localhost:3002 (dev container)       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Startup Flow — How the Session Turns On <a name="startup-flow"></a>

### First-Time Setup (One Time Only)

```
YOU (on any computer with SSH access to VPS)
 │
 │  ssh root@your-vps-ip
 │
 ▼
┌─────────────────────────────────────────────┐
│  Step 1: Create devuser                      │
│  $ useradd -m -s /bin/bash devuser           │
│  $ usermod -aG docker devuser                │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  Step 2: Install Claude Code                 │
│  $ su - devuser                              │
│  $ curl -fsSL https://claude.ai/install.sh   │
│    | bash                                    │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  Step 3: Authenticate (OAuth)                │
│  $ claude auth login                         │
│                                              │
│  Claude Code outputs:                        │
│  "Open this URL to authenticate:             │
│   https://claude.ai/oauth/authorize?..."     │
│  Press 'c' to copy URL                       │
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │  You open that URL on your phone    │     │
│  │  or laptop browser → Log in with    │     │
│  │  your Max plan account → Approve    │     │
│  └─────────────────────────────────────┘     │
│                                              │
│  Token stored in /home/devuser/.claude/      │
│  This persists. You won't need to do         │
│  this again (unless token expires after       │
│  a long period).                             │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  Step 4: Install systemd service             │
│  (details in Service Management section)     │
│  This ensures claude remote-control starts   │
│  automatically on VPS boot/reboot.           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  Step 5: Clone your repos                    │
│  $ mkdir -p ~/repos                          │
│  $ cd ~/repos                                │
│  $ git clone https://github.com/you/...      │
│  (or let Claude Code do this later from      │
│   your phone!)                               │
└──────────────────┬──────────────────────────┘
                   ▼
                 DONE
          Setup complete.
     Open Claude app on phone.
```

### Every VPS Boot (Automatic via systemd)

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ VPS Boot │────►│  systemd     │────►│  tmux session    │────►│  claude             │
│          │     │  starts      │     │  "claude-remote" │     │  remote-control     │
│          │     │  service     │     │  created         │     │  --name "VPS Dev"   │
└──────────┘     └──────────────┘     └──────────────────┘     │  --spawn worktree   │
                                                                │  --capacity 4       │
                                                                └────────┬────────────┘
                                                                         │
                                                                         ▼
                                                                ┌─────────────────────┐
                                                                │  Connects outbound   │
                                                                │  to Anthropic API    │
                                                                │  via HTTPS           │
                                                                │                     │
                                                                │  Status: ONLINE ●    │
                                                                │  Visible in          │
                                                                │  claude.ai/code      │
                                                                └─────────────────────┘
```

### What If It Crashes?

```
claude remote-control crashes or network timeout (>10 min)
         │
         ▼
┌──────────────────────┐     ┌──────────────────────┐
│  systemd detects     │────►│  Restarts the tmux   │
│  service stopped     │     │  + claude process     │
│  (Restart=on-failure)│     │  after 10s delay      │
└──────────────────────┘     └──────────────────────┘
         │
         ▼
  Back online in claude.ai/code
  (your conversation history for
   active sessions is preserved
   on Anthropic's side)
```

---

## 4. User Interaction Flow — Phone to Code to Preview <a name="interaction-flow"></a>

### The Complete Flow of a Typical Session

```
 YOU (Phone)                    Anthropic Cloud              Your VPS
 ──────────                     ───────────────              ────────
     │                                │                          │
     │  1. Open Claude app            │                          │
     │     or claude.ai/code          │                          │
     │ ──────────────────────────►    │                          │
     │                                │                          │
     │  2. See "VPS Dev" server       │                          │
     │     (green dot = online)       │                          │
     │     Click to open session      │                          │
     │ ──────────────────────────►    │                          │
     │                                │  3. Relay: new session   │
     │                                │ ────────────────────►    │
     │                                │                          │
     │                                │  4. Claude Code spawns   │
     │                                │     a worktree session   │
     │                                │     in ~/repos/          │
     │                                │                          │
     │  5. You type:                  │                          │
     │     "Go to tasktrox repo,      │                          │
     │      create branch feat/dark   │                          │
     │      and add dark mode toggle" │                          │
     │ ──────────────────────────►    │                          │
     │                                │  6. Relay message        │
     │                                │ ────────────────────►    │
     │                                │                          │
     │                                │  7. Claude Code on VPS:  │
     │                                │     $ cd ~/repos/tasktrox│
     │                                │     $ git checkout -b    │
     │                                │       feat/dark-mode     │
     │                                │     [edits files...]     │
     │                                │     [ripgrep searches..] │
     │                                │     [writes new code...] │
     │                                │                          │
     │                                │  8. Relay: "I've created │
     │                                │     the branch and added │
     │  9. You see Claude's response  │     dark mode toggle..." │
     │ ◄──────────────────────────    │ ◄────────────────────    │
     │                                │                          │
     │  10. You type:                 │                          │
     │      "Spin up the dev staging  │                          │
     │       so I can preview it"     │                          │
     │ ──────────────────────────►    │                          │
     │                                │  11. Relay message       │
     │                                │ ────────────────────►    │
     │                                │                          │
     │                                │  12. Claude Code:        │
     │                                │  $ docker compose        │
     │                                │    --profile dev up -d   │
     │                                │    dev-tasktrox           │
     │                                │                          │
     │                                │  13. Dev container starts│
     │                                │      Hot-reload active   │
     │                                │      on port 3001        │
     │  14. Claude responds:          │ ◄────────────────────    │
     │  "Dev staging is up at         │                          │
     │   dev.tasktrox.yourdomain.com" │                          │
     │ ◄──────────────────────────    │                          │
     │                                │                          │
     │  15. You open browser tab:     │                          │
     │  dev.tasktrox.yourdomain.com ──│──────────────────────►   │
     │       (direct HTTPS to VPS)    │    nginx → container:3001│
     │ ◄──────────────────────────────│──────────────────────    │
     │  16. See the dark mode toggle! │                          │
     │                                │                          │
     │  17. "Looks good! Commit and   │                          │
     │       push to GitHub"          │                          │
     │ ──────────────────────────►    │                          │
     │                                │  18. Relay              │
     │                                │ ────────────────────►    │
     │                                │                          │
     │                                │  19. Claude Code:        │
     │                                │  $ git add -A            │
     │                                │  $ git commit -m "..."   │
     │                                │  $ git push origin       │
     │                                │    feat/dark-mode        │
     │                                │                          │
     │  20. "Pushed! Want me to       │                          │
     │  create a PR and tear down     │ ◄────────────────────    │
     │  the staging?"                 │                          │
     │ ◄──────────────────────────    │                          │
     │                                │                          │
     │  21. "Yes, create PR and       │                          │
     │       stop the dev container"  │                          │
     │ ──────────────────────────►    │                          │
     │                                │  22. Claude Code:        │
     │                                │ ────────────────────►    │
     │                                │  $ gh pr create ...      │
     │                                │  $ docker compose        │
     │                                │    --profile dev down    │
     │                                │                          │
     │  23. "PR #42 created.          │ ◄────────────────────    │
     │  Staging torn down. Done!"     │                          │
     │ ◄──────────────────────────    │                          │
     │                                │                          │
    ───                              ───                        ───
```

---

## 5. Multi-Project Session Flow <a name="multi-project-flow"></a>

```
claude.ai/code  (your phone)
┌─────────────────────────────────────────────────────┐
│                                                      │
│  Your Servers                                        │
│  ┌───────────────────────────────────────────┐      │
│  │  ● VPS Dev (online)                        │      │
│  │                                            │      │
│  │  Active Sessions:                          │      │
│  │  ┌───────────────────────────────────┐     │      │
│  │  │ 📝 Session 1                      │     │      │
│  │  │ "Fix tasktrox login bug"          │     │      │
│  │  │ Working in: ~/repos/tasktrox      │     │      │
│  │  │ Branch: fix/login-bug             │     │      │
│  │  │ Status: Waiting for your input    │     │      │
│  │  └───────────────────────────────────┘     │      │
│  │  ┌───────────────────────────────────┐     │      │
│  │  │ 📝 Session 2                      │     │      │
│  │  │ "Add permitto dark mode"          │     │      │
│  │  │ Working in: ~/repos/permitto      │     │      │
│  │  │ Branch: feat/dark-mode            │     │      │
│  │  │ Status: Editing files...          │     │      │
│  │  └───────────────────────────────────┘     │      │
│  │                                            │      │
│  │  [ + New Session ]                         │      │
│  │                                            │      │
│  └───────────────────────────────────────────┘      │
│                                                      │
└─────────────────────────────────────────────────────┘

What happens on the VPS when 2 sessions are active:

┌─────────────────────────────────────────────────────┐
│  tmux: claude-remote                                 │
│  └── claude remote-control (parent process)          │
│       ├── Session 1 (worktree: /tmp/worktree-abc/)   │
│       │   └── Claude Code instance                   │
│       │       Working dir: ~/repos/tasktrox          │
│       │       RAM: ~200-400MB                        │
│       │                                              │
│       └── Session 2 (worktree: /tmp/worktree-def/)   │
│           └── Claude Code instance                   │
│               Working dir: ~/repos/permitto          │
│               RAM: ~200-400MB                        │
│                                                      │
│  Docker (dev containers):                            │
│  ├── dev-tasktrox (port 3001) ← 200MB RAM           │
│  └── dev-permitto (port 3002) ← 200MB RAM           │
│                                                      │
│  Total dev zone overhead: ~800MB - 1.4GB             │
│  Remaining free RAM: ~3-4GB ✓                        │
└─────────────────────────────────────────────────────┘
```

---

## 6. Dev Staging Lifecycle <a name="staging-lifecycle"></a>

```
                    STAGING CONTAINER LIFECYCLE

    Idle (default)          Active                    Teardown
    ─────────────           ──────                    ────────

    No dev containers       You (via Claude):         You (via Claude):
    running.                "Start dev staging        "Tear down the
    0 MB overhead.          for tasktrox"             staging"

         │                       │                         │
         ▼                       ▼                         ▼
    ┌──────────┐          ┌──────────────┐          ┌──────────────┐
    │          │  start   │              │  stop    │              │
    │  DOWN    │─────────►│   RUNNING    │─────────►│    DOWN      │
    │          │          │              │          │              │
    │ 0MB RAM  │          │ ~200-300MB   │          │ 0MB RAM      │
    │ 0 CPU    │          │ hot-reload ✓ │          │ freed        │
    └──────────┘          │ URL active ✓ │          └──────────────┘
                          └──────────────┘

    Commands Claude Code runs behind the scenes:

    START:
      docker compose -f ~/staging/docker-compose.dev.yml \
        --profile dev up -d dev-tasktrox

    STOP:
      docker compose -f ~/staging/docker-compose.dev.yml \
        --profile dev stop dev-tasktrox


    ┌─────────────────────────────────────────────────────┐
    │  HOT-RELOAD FLOW (while staging is running)         │
    │                                                      │
    │  Claude Code                                         │
    │  edits file ──► ~/repos/tasktrox/src/App.tsx         │
    │                        │                             │
    │                   volume mount                       │
    │                        │                             │
    │                        ▼                             │
    │                 dev-tasktrox container                │
    │                 (nodemon / next dev / etc.)           │
    │                        │                             │
    │                   detects change                     │
    │                   auto-rebuilds                      │
    │                        │                             │
    │                        ▼                             │
    │                 You refresh phone browser             │
    │                 dev.tasktrox.yourdomain.com           │
    │                 ──► See updated UI instantly          │
    └─────────────────────────────────────────────────────┘
```

---

## 7. Network & Security Architecture <a name="network-security"></a>

```
                         INTERNET
                            │
                     ┌──────┴──────┐
                     │   Firewall   │
                     │ (iptables/   │
                     │  ufw)        │
                     │              │
                     │ Open ports:  │
                     │  22 (SSH)    │
                     │  80 (HTTP)   │
                     │  443 (HTTPS) │
                     │              │
                     │ NOT open:    │
                     │  3001, 3002  │
                     │  (dev ports  │
                     │   internal   │
                     │   only)      │
                     └──────┬──────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
            Port 80/443          Claude Code
            (HTTP/HTTPS)         (outbound only)
                  │                   │
                  ▼                   ▼
           ┌──────────┐      ┌──────────────┐
           │  Nginx   │      │  Anthropic   │
           │ (shared) │      │  API servers │
           └────┬─────┘      │  (HTTPS)     │
                │            └──────────────┘
       ┌────────┼────────┐         ▲
       │        │        │         │
       ▼        ▼        ▼         │ No inbound
   Production  Production Dev      │ ports needed!
   sites       sites     staging   │ Claude Code
   (murx)      (murx)   (devuser)  │ connects OUT
                                   │ to Anthropic.
                            ┌──────┴──────┐
                            │ claude      │
                            │ remote-     │
                            │ control     │
                            └─────────────┘


    ┌─────────────────────────────────────────────────┐
    │  DOCKER NETWORK ISOLATION                        │
    │                                                  │
    │  prod-network (bridge, internal):                │
    │  ┌─────┐ ┌──────┐ ┌───────┐ ┌───────┐          │
    │  │nginx│ │pg    │ │redis  │ │apps   │           │
    │  └─────┘ └──────┘ └───────┘ └───────┘           │
    │      ▲                                           │
    │      │ cannot communicate                        │
    │      ▼                                           │
    │  dev-network (bridge, internal):                 │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
    │  │dev-      │ │dev-pg    │ │dev-redis │         │
    │  │tasktrox  │ │(alpine)  │ │(64MB)    │         │
    │  └──────────┘ └──────────┘ └──────────┘         │
    │                                                  │
    │  Dev containers CANNOT reach prod database.      │
    │  Prod containers CANNOT reach dev containers.    │
    │  Only nginx bridges both (for routing).          │
    └─────────────────────────────────────────────────┘


    ┌─────────────────────────────────────────────────┐
    │  DEV STAGING SECURITY                            │
    │                                                  │
    │  Option A: Basic Auth (simple)                   │
    │  ┌─────────────────────────────────────┐        │
    │  │  server {                            │        │
    │  │    server_name dev.tasktrox.com;     │        │
    │  │    auth_basic "Dev Preview";         │        │
    │  │    auth_basic_user_file /etc/nginx/  │        │
    │  │      .htpasswd-dev;                  │        │
    │  │    location / {                      │        │
    │  │      proxy_pass http://127.0.0.1:    │        │
    │  │        3001;                         │        │
    │  │    }                                 │        │
    │  │  }                                   │        │
    │  └─────────────────────────────────────┘        │
    │                                                  │
    │  Option B: Cloudflare Tunnel (zero open ports)   │
    │  Route dev subdomains through Cloudflare with    │
    │  Access policies. More secure but more complex.  │
    │                                                  │
    │  Option C: Tailscale (private network)           │
    │  Dev staging only accessible via Tailscale VPN.  │
    │  Most secure but requires Tailscale on phone.    │
    └─────────────────────────────────────────────────┘
```

---

## 8. Directory Structure <a name="directory-structure"></a>

```
/home/
├── murx/                           ← PRODUCTION USER (untouched)
│   ├── apps/
│   │   ├── portfolio/
│   │   ├── tasktrox/
│   │   └── permitto/
│   └── shared/
│       ├── docker-compose.yml
│       └── nginx/
│           └── conf.d/
│               ├── portfolio.conf
│               ├── tasktrox.conf
│               └── permitto.conf
│
└── devuser/                        ← DEVELOPMENT USER (new)
    ├── .claude/                    ← Claude Code auth & config
    │   ├── credentials.json        ← OAuth tokens (auto-managed)
    │   ├── settings.json           ← Claude Code settings
    │   └── projects/               ← Project-specific configs
    │
    ├── repos/                      ← GitHub repository clones
    │   ├── portfolio/
    │   │   └── (git clone)
    │   ├── tasktrox/
    │   │   └── (git clone)
    │   ├── permitto/
    │   │   └── (git clone)
    │   └── (future-project)/       ← Just clone here to add
    │
    ├── staging/                    ← Dev environment configs
    │   ├── docker-compose.dev.yml  ← All dev container definitions
    │   ├── .env.dev                ← Dev environment variables
    │   └── nginx-dev/
    │       ├── dev.tasktrox.conf
    │       ├── dev.permitto.conf
    │       └── (add more as needed)
    │
    └── scripts/                    ← Helper scripts
        ├── start-staging.sh        ← Spin up a dev container
        ├── stop-staging.sh         ← Tear down a dev container
        └── setup-new-project.sh    ← Clone + add compose + add nginx
```

---

## 9. Service Management <a name="service-management"></a>

### systemd Service File

```
┌──────────────────────────────────────────────────────┐
│  /etc/systemd/system/claude-remote.service           │
│                                                       │
│  [Unit]                                               │
│  Description=Claude Code Remote Control               │
│  After=network-online.target docker.service           │
│  Wants=network-online.target                          │
│                                                       │
│  [Service]                                            │
│  Type=forking                                         │
│  User=devuser                                         │
│  Group=devuser                                        │
│  WorkingDirectory=/home/devuser/repos                 │
│  Environment=HOME=/home/devuser                       │
│                                                       │
│  ExecStart=/usr/bin/tmux new-session -d               │
│    -s claude-remote                                   │
│    'claude remote-control                             │
│      --name "VPS Dev"                                 │
│      --spawn worktree                                 │
│      --capacity 4'                                    │
│                                                       │
│  ExecStop=/usr/bin/tmux kill-session                  │
│    -t claude-remote                                   │
│                                                       │
│  Restart=on-failure                                   │
│  RestartSec=10                                        │
│                                                       │
│  [Install]                                            │
│  WantedBy=multi-user.target                           │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Management Commands

```
┌─────────────────────────────────────────────────────┐
│  SYSTEMD COMMANDS (as root or sudo)                  │
│                                                      │
│  Enable on boot:                                     │
│  $ systemctl enable claude-remote                    │
│                                                      │
│  Start:                                              │
│  $ systemctl start claude-remote                     │
│                                                      │
│  Stop:                                               │
│  $ systemctl stop claude-remote                      │
│                                                      │
│  Check status:                                       │
│  $ systemctl status claude-remote                    │
│                                                      │
│  View logs:                                          │
│  $ journalctl -u claude-remote -f                    │
│                                                      │
│  Attach to tmux (for debugging):                     │
│  $ sudo -u devuser tmux attach -t claude-remote      │
│                                                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  TYPICAL ADMIN SCENARIOS                             │
│                                                      │
│  VPS reboots?                                        │
│  → systemd auto-starts claude-remote                 │
│  → Back online in claude.ai/code within ~15 seconds  │
│                                                      │
│  Claude Code crashes?                                │
│  → systemd restarts after 10 seconds                 │
│  → Sessions reconnect automatically                  │
│                                                      │
│  Need to update Claude Code?                         │
│  $ sudo -u devuser claude update                     │
│  $ systemctl restart claude-remote                   │
│                                                      │
│  Need to re-authenticate?                            │
│  $ systemctl stop claude-remote                      │
│  $ sudo -u devuser claude auth login                 │
│  (copy URL → authenticate in browser)                │
│  $ systemctl start claude-remote                     │
│                                                      │
│  Check auth status:                                  │
│  $ sudo -u devuser claude auth status --text         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Quick Reference: Resource Budget

```
┌──────────────────────────────────────────────────────────────┐
│                    8 GB RAM BUDGET                            │
│                                                               │
│  ████████████████████████████████████████  8.0 GB Total      │
│  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ~1.5 GB OS+Docker │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  ~2.5 GB Prod apps  │
│  ██████████████░░░░░░░░░░░░░░░░░░░░░░░░  ~0.5 GB Shared svcs│
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░  ~0.5 GB Claude Code│
│  ██████████████████░░░░░░░░░░░░░░░░░░░░  ~0.5 GB Dev staging│
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ~2.5 GB FREE      │
│                                                               │
│  Verdict: Comfortable. Even 2 sessions + staging = fine.     │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Remote Control Feature Parity <a name="remote-feature-parity"></a>

### What WORKS from Phone / claude.ai/code

```
┌─────────────────────────────────────────────────────────────┐
│  WORKS FROM REMOTE (phone / claude.ai/code / Claude app)    │
│                                                              │
│  ✓ Natural language chat / prompts                          │
│  ✓ See diffs, approve/deny file edits                       │
│  ✓ See command output (tests, builds, logs)                 │
│  ✓ MCP servers (run server-side, fully functional)          │
│  ✓ Hooks (all lifecycle hooks fire server-side)             │
│     └── $CLAUDE_CODE_REMOTE env var = "true" in remote      │
│  ✓ CLAUDE.md project context files (loaded at session start)│
│  ✓ Skills AUTO-INVOKED by Claude (when relevant)            │
│  ✓ Auto memory (reads/writes memory files)                  │
│  ✓ Git, Docker, filesystem — all tools                      │
│  ✓ Multi-session via --spawn worktree                       │
│  ✓ Multi-device sync (terminal + browser + phone)           │
│  ✓ Auto-reconnect after network drops                       │
└─────────────────────────────────────────────────────────────┘
```

### What DOES NOT WORK from Phone

```
┌─────────────────────────────────────────────────────────────┐
│  DOES NOT WORK FROM REMOTE                                   │
│  (known limitation — feature requests open on GitHub)        │
│                                                              │
│  ✗ ALL slash commands                                        │
│    /compact  /clear  /config  /diff  /model  /effort        │
│    /permissions  /mcp  /memory  /init  /context              │
│    /export  /help                                            │
│    (GitHub issues: #28351, #30674)                           │
│                                                              │
│  ✗ Custom slash commands (/my-skill)                         │
│    Cannot type /skill-name from remote interface             │
│    (GitHub issue: #30964)                                    │
│                                                              │
│  ✗ Manual skill invocation                                   │
│    Skills with disable-model-invocation: true are            │
│    inaccessible from remote                                  │
│                                                              │
│  ✗ Permission mode cycling (Shift+Tab)                       │
│    No keyboard shortcuts in remote UI                        │
│    Cannot switch between Default/Accept Edits/Plan modes     │
│                                                              │
│  ✗ --dangerously-skip-permissions                            │
│    Known bug: remote still shows prompts even with flag      │
│    (GitHub issue: #29214)                                    │
│                                                              │
│  ✗ Interrupt Claude mid-response (Escape key)                │
│    No equivalent in remote UI                                │
│                                                              │
│  ✗ Interactive diff viewer                                   │
│    Requires /diff slash command                              │
│                                                              │
│  ✗ Vim mode                                                  │
│    Terminal-specific feature                                  │
│                                                              │
│  ✗ Native push notifications                                 │
│    No notification when permission approval needed           │
│    (Third-party workaround: claude-remote-approver + ntfy)   │
└─────────────────────────────────────────────────────────────┘
```

### Feature Decision Matrix

```
┌──────────────────────┬──────────┬──────────┬───────────────┐
│ Feature              │  Phone   │  SSH +   │  Terminal     │
│                      │ (remote) │  tmux    │  (local)      │
├──────────────────────┼──────────┼──────────┼───────────────┤
│ Chat with Claude     │    ✓     │    ✓     │     ✓         │
│ See/approve edits    │    ✓     │    ✓     │     ✓         │
│ Slash commands       │    ✗     │    ✓     │     ✓         │
│ Custom skills (auto) │    ✓     │    ✓     │     ✓         │
│ Custom skills (/cmd) │    ✗     │    ✓     │     ✓         │
│ MCP servers          │    ✓     │    ✓     │     ✓         │
│ Hooks                │    ✓     │    ✓     │     ✓         │
│ CLAUDE.md            │    ✓     │    ✓     │     ✓         │
│ Permission cycling   │    ✗     │    ✓     │     ✓         │
│ Interrupt (Escape)   │    ✗     │    ✓     │     ✓         │
│ /compact             │    ✗     │    ✓     │     ✓         │
│ /diff                │    ✗     │    ✓     │     ✓         │
│ Vim mode             │    ✗     │    ✗     │     ✓         │
├──────────────────────┼──────────┼──────────┼───────────────┤
│ USE WHEN             │ On the   │ Need     │  At your      │
│                      │ go, 90%  │ slash    │  desk         │
│                      │ of tasks │ commands │               │
└──────────────────────┴──────────┴──────────┴───────────────┘
```

---

## 11. Workaround Strategy for Remote Limitations <a name="workaround-strategy"></a>

### Strategy 1: Make Skills Auto-Invocable

```
┌─────────────────────────────────────────────────────────────┐
│  PROBLEM: Can't type /deploy-staging from phone              │
│                                                              │
│  SOLUTION: Design skills WITHOUT disable-model-invocation    │
│                                                              │
│  .claude/skills/deploy-staging.md:                           │
│  ┌─────────────────────────────────────────────────┐        │
│  │  ---                                             │        │
│  │  name: deploy-staging                            │        │
│  │  description: Spin up dev staging for a project  │        │
│  │  # NOTE: No disable-model-invocation: true       │        │
│  │  #       Claude will auto-invoke when relevant   │        │
│  │  ---                                             │        │
│  │  When the user asks to preview, test, or stage   │        │
│  │  a project, run the following steps...           │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
│  From phone, just say:                                       │
│  "Set up dev staging for tasktrox"                           │
│  → Claude finds the skill and follows its instructions       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Strategy 2: Use Hooks for Auto-Permissions

```
┌─────────────────────────────────────────────────────────────┐
│  PROBLEM: Permission prompts are annoying on phone           │
│           (--dangerously-skip-permissions has a bug)          │
│                                                              │
│  SOLUTION: PreToolUse hooks that auto-approve                │
│                                                              │
│  .claude/settings.json:                                      │
│  {                                                           │
│    "hooks": {                                                │
│      "PreToolUse": [                                         │
│        {                                                     │
│          "matcher": "Read|Glob|Grep",                        │
│          "hook": {                                           │
│            "type": "command",                                │
│            "command": "exit 0"   ← auto-approve reads       │
│          }                                                   │
│        },                                                    │
│        {                                                     │
│          "matcher": "Edit|Write",                            │
│          "hook": {                                           │
│            "type": "command",                                │
│            "command": "exit 0"   ← auto-approve edits       │
│          }                                                   │
│        },                                                    │
│        {                                                     │
│          "matcher": "Bash",                                  │
│          "hook": {                                           │
│            "type": "command",                                │
│            "command": "exit 0"   ← auto-approve bash        │
│          }                  (be cautious with this one)      │
│        }                                                     │
│      ]                                                       │
│    }                                                         │
│  }                                                           │
│                                                              │
│  ⚠ SECURITY NOTE: Auto-approving Bash means Claude can      │
│  run ANY command. Acceptable for a dev-only user on your     │
│  own VPS. NOT recommended for shared/production environments.│
└─────────────────────────────────────────────────────────────┘
```

### Strategy 3: Natural Language Equivalents

```
┌─────────────────────────────────────────────────────────────┐
│  PROBLEM: Can't run slash commands from phone                │
│                                                              │
│  SOLUTION: Most have natural language equivalents            │
│                                                              │
│  Instead of...              Say from phone...                │
│  ─────────────              ─────────────────                │
│  /compact                   "Summarize our conversation,     │
│                              keep context about [X]"         │
│                                                              │
│  /clear                     (start a new session instead)    │
│                                                              │
│  /diff                      "Show me what files changed"     │
│                              or "run git diff"               │
│                                                              │
│  /model sonnet              (set in CLAUDE.md or startup     │
│                              flags: --model sonnet)          │
│                                                              │
│  /init                      (pre-configure CLAUDE.md on      │
│                              VPS before starting)            │
│                                                              │
│  /context                   "How much context do you         │
│                              have left?"                     │
│                                                              │
│  /export                    "Save this conversation to       │
│                              a file"                         │
│                                                              │
│  NOTE: These are imperfect substitutes. /compact in          │
│  particular works differently than asking Claude to           │
│  "summarize" — the real /compact triggers a system-level     │
│  context compression. No perfect workaround exists.          │
└─────────────────────────────────────────────────────────────┘
```

### Strategy 4: SSH Fallback for Power Operations

```
┌─────────────────────────────────────────────────────────────┐
│  PROBLEM: Sometimes you NEED slash commands                  │
│                                                              │
│  SOLUTION: SSH from phone when needed                        │
│                                                              │
│  Phone SSH Apps:                                             │
│  ┌────────────────────────────────────────┐                 │
│  │  Android: Termux (free, excellent)      │                │
│  │  iOS:     Blink Shell or a]Shell        │                │
│  └────────────────────────────────────────┘                 │
│                                                              │
│  Quick flow:                                                 │
│  1. Open Termux / Blink                                      │
│  2. ssh devuser@your-vps-ip                                  │
│  3. tmux attach -t claude-remote                             │
│  4. Now you have full terminal with all slash commands        │
│  5. Run /compact, /config, /whatever                         │
│  6. Detach: Ctrl+B then D                                    │
│  7. Back to Claude app for normal use                        │
│                                                              │
│  ┌────────────────────────────────────────────┐             │
│  │  PRO TIP: Use claude --remote-control      │             │
│  │  (interactive + remote) instead of plain    │             │
│  │  claude remote-control (server only).       │             │
│  │                                             │             │
│  │  This gives you:                            │             │
│  │  • Full terminal TUI (when SSH'd in)        │             │
│  │  • PLUS remote access (from Claude app)     │             │
│  │  • Same session, synced across both         │             │
│  │                                             │             │
│  │  Best of both worlds.                       │             │
│  └────────────────────────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Decision Flow: How to Access Claude Code

```
                    What do you need to do?
                            │
                 ┌──────────┴──────────┐
                 │                     │
          Simple task?           Need slash commands
          Chat + approve?        or power features?
                 │                     │
                 ▼                     ▼
        ┌────────────────┐    ┌────────────────┐
        │  Claude App    │    │  SSH + tmux    │
        │  or            │    │  (Termux /     │
        │  claude.ai/code│    │   Blink Shell) │
        │                │    │                │
        │  • Chat        │    │  • /compact    │
        │  • See diffs   │    │  • /config     │
        │  • Approve     │    │  • /diff       │
        │  • Preview URL │    │  • /permissions│
        │                │    │  • Escape key  │
        │  90% of tasks  │    │  10% of tasks  │
        └────────────────┘    └────────────────┘
```
