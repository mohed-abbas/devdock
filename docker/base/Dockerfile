# docker/base/Dockerfile
# Base development container for DevDock environments
# Per D-04: Ubuntu 24.04 base image
FROM ubuntu:24.04

# Build arguments for host UID/GID matching (Pitfall #9 prevention)
ARG HOST_UID=1000
ARG HOST_GID=1000
ARG NODE_MAJOR=22

ENV DEBIAN_FRONTEND=noninteractive

# System packages per D-05: Git, SSH, curl, wget, vim, jq, build-essential, Python 3
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ssh \
    curl \
    wget \
    vim \
    jq \
    build-essential \
    ca-certificates \
    gnupg \
    python3 \
    python3-pip \
    python3-venv \
    sudo \
    less \
    htop \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Node.js via NodeSource per D-05
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user matching host UID/GID (Pitfall #9: volume permission mismatch)
RUN if getent group ${HOST_GID} >/dev/null 2>&1; then \
      groupmod -n dev $(getent group ${HOST_GID} | cut -d: -f1); \
    else \
      groupadd -g ${HOST_GID} dev; \
    fi \
    && if getent passwd ${HOST_UID} >/dev/null 2>&1; then \
      existing_user=$(getent passwd ${HOST_UID} | cut -d: -f1); \
      usermod -l dev -d /home/dev -m -g dev -s /bin/bash "$existing_user"; \
    else \
      useradd -m -u ${HOST_UID} -g dev -s /bin/bash dev; \
    fi \
    && echo "dev ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/dev

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER dev

# Claude Code CLI per D-07 -- install as dev user so it lands in /home/dev/.local/bin
RUN curl -fsSL https://claude.ai/install.sh | bash

# Ensure ~/.local/bin is in PATH for all shells
ENV PATH="/home/dev/.local/bin:${PATH}"
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
