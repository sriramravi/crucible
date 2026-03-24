# Intentionally misconfigured Ubuntu container for Module 10 (Compliance as Code)
# Misconfigurations:
# 1. SSH exposed on port 22
# 2. Root login enabled
# 3. World-writable file at /tmp/world-writable.txt
# 4. Outdated/pinned old openssl version (simulated via flag file)

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-server \
    sudo \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Misconfiguration 1 & 2: Enable SSH with root login allowed
RUN mkdir -p /run/sshd && \
    sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    echo "PermitRootLogin yes" >> /etc/ssh/sshd_config && \
    echo "root:insecurepassword" | chpasswd

# Misconfiguration 3: World-writable file
RUN touch /tmp/world-writable.txt && chmod 0777 /tmp/world-writable.txt

# Misconfiguration 4: Flag file simulating outdated package
RUN echo "openssl 1.1.1 (outdated)" > /etc/insecure-packages.txt

# Start SSH daemon
CMD ["/usr/sbin/sshd", "-D"]
