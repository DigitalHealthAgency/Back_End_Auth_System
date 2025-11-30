# Auth System - Docker & Kubernetes Deployment Guide

Complete guide for containerizing and deploying the Elano Auth System service using Docker and Kubernetes.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

## 🎯 Overview

The Auth System service handles authentication, authorization, and user management for the Elano platform.

**Service Details:**
- **Port**: 5000
- **Health Check**: `GET /health`
- **Metrics**: Port 9090 at `/metrics`
- **Base Image**: `node:20-alpine`
- **Container Size**: ~150MB

**Key Features:**
- JWT-based authentication
- Google OAuth integration
- Two-factor authentication (2FA)
- Password management and recovery
- User profile management
- Payment integration (Paystack)
- Email services (Mailgun + Resend)
- AI integration (Gemini)

## 📦 Prerequisites

### Required Tools

```bash
# Docker
docker --version  # >= 20.10.0

# Docker Compose
docker-compose --version  # >= 2.0.0

# Kubernetes (for K8s deployment)
kubectl version  # >= 1.24.0

# Optional: Trivy (security scanning)
trivy --version
```

### External Services

- **MongoDB Atlas**: Managed database cluster
- **Google Cloud Console**: OAuth credentials
- **Cloudinary**: File storage
- **Mailgun**: Email service
- **Resend**: Email service (backup)
- **Paystack**: Payment processing
- **OpenWeather**: Weather API
- **Google AI Studio**: Gemini API key

## 🚀 Quick Start

### 1. Clone and Configure

```bash
# Navigate to Auth System directory
cd Auth_System

# Copy environment template
cp .env.example .env

# Edit .env with your actual credentials
nano .env
```

### 2. Run with Docker Compose

```bash
# Build and start the service
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Test health endpoint
curl http://localhost:5000/health
```

### 3. Stop the Service

```bash
# Stop and remove containers
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## 🐳 Docker Deployment

### Building the Image

#### Using Docker Compose
```bash
# Build with docker-compose
docker-compose build

# Build without cache
docker-compose build --no-cache
```

#### Using Build Script
```bash
# Make script executable (Linux/Mac)
chmod +x scripts/build-docker.sh

# Build image
./scripts/build-docker.sh

# Build and push to registry
./scripts/build-docker.sh --push

# Build without cache
./scripts/build-docker.sh --no-cache

# Build with specific version
./scripts/build-docker.sh --version=v1.0.0
```

#### Manual Docker Build
```bash
# Build the image
docker build -t elano/auth-system-service:latest .

# Build with specific version
docker build -t elano/auth-system-service:v1.0.0 .

# Build without cache
docker build --no-cache -t elano/auth-system-service:latest .
```

### Running the Container

#### Using Docker Compose (Recommended)
```bash
# Start in detached mode
docker-compose up -d

# Start with specific service
docker-compose up -d elano-auth-service

# Scale to multiple instances
docker-compose up -d --scale elano-auth-service=3
```

#### Manual Docker Run
```bash
docker run -d \
  --name elano-auth-system \
  -p 5000:5000 \
  -p 9090:9090 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e MONGO_URI="your_mongo_uri" \
  -e JWT_SECRET="your_jwt_secret" \
  --restart unless-stopped \
  elano/auth-system-service:latest
```

### Container Management

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View logs
docker logs elano-auth-system

# Follow logs
docker logs -f elano-auth-system

# View last 100 lines
docker logs --tail 100 elano-auth-system

# Execute commands in container
docker exec -it elano-auth-system sh

# Restart container
docker restart elano-auth-system

# Stop container
docker stop elano-auth-system

# Remove container
docker rm elano-auth-system

# Remove image
docker rmi elano/auth-system-service:latest
```

## ☸️ Kubernetes Deployment

### Prerequisites

```bash
# Verify cluster connection
kubectl cluster-info

# Check current context
kubectl config current-context

# Create namespace
kubectl create namespace elano
```

### Deployment Steps

#### Using Deployment Script (Recommended)
```bash
# Make script executable (Linux/Mac)
chmod +x scripts/deploy-k8s.sh

# Deploy to Kubernetes
./scripts/deploy-k8s.sh

# Check deployment status
./scripts/deploy-k8s.sh --status

# Delete all resources
./scripts/deploy-k8s.sh --delete
```

#### Manual Deployment
```bash
# Apply manifests in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/network-policy.yaml
kubectl apply -f k8s/monitoring.yaml
kubectl apply -f k8s/ingress.yaml

# Wait for rollout to complete
kubectl rollout status deployment/elano-auth-deployment -n elano
```

### Kubernetes Resources

| Resource | Purpose |
|----------|---------|
| `namespace.yaml` | Isolates resources in `elano` namespace |
| `secrets.yaml` | Stores sensitive credentials |
| `configmap.yaml` | Non-sensitive configuration |
| `rbac.yaml` | Role-based access control |
| `pvc.yaml` | Persistent storage for logs and uploads |
| `deployment.yaml` | Manages 3 pod replicas with rolling updates |
| `service.yaml` | ClusterIP service exposing port 5000 |
| `hpa.yaml` | Auto-scales 3-10 pods based on CPU/memory |
| `network-policy.yaml` | Controls network traffic |
| `monitoring.yaml` | Prometheus metrics and alerts |
| `ingress.yaml` | Routes external traffic, TLS termination |

### Accessing the Service

#### Port Forwarding (Development)
```bash
# Forward service port to localhost
kubectl port-forward -n elano svc/elano-auth-service 5000:5000

# Access the service
curl http://localhost:5000/health
```

#### Through Ingress (Production)
```bash
# Service is accessible via:
# - https://api.elano.cloud/api/auth
# - https://auth.elano.cloud
```

### Managing Kubernetes Deployment

```bash
# View pods
kubectl get pods -n elano -l app=elano-auth-service

# View deployment
kubectl get deployment -n elano elano-auth-deployment

# View services
kubectl get svc -n elano -l app=elano-auth-service

# View ingress
kubectl get ingress -n elano elano-auth-ingress

# View HPA status
kubectl get hpa -n elano elano-auth-hpa

# View logs
kubectl logs -n elano -l app=elano-auth-service

# Follow logs
kubectl logs -f -n elano -l app=elano-auth-service

# Describe pod
kubectl describe pod -n elano <pod-name>

# Get events
kubectl get events -n elano --sort-by='.lastTimestamp'

# Scale deployment
kubectl scale deployment/elano-auth-deployment -n elano --replicas=5

# Restart pods (rolling restart)
kubectl rollout restart deployment/elano-auth-deployment -n elano

# Rollback deployment
kubectl rollout undo deployment/elano-auth-deployment -n elano

# View rollout history
kubectl rollout history deployment/elano-auth-deployment -n elano
```

## ⚙️ Configuration

### Environment Variables

See `.env.example` for complete list. Key variables:

#### Core Configuration
```bash
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
```

#### Google OAuth
```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=https://api.elano.cloud/api/auth/google/callback
```

#### Cloudinary
```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### Email Services
```bash
# Mailgun
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=sandbox123456.mailgun.org

# Resend
RESEND_API_KEY=re_YourApiKey
FROM_EMAIL=your-email@example.com
```

#### Payment Processing
```bash
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
WEBHOOK_URL=https://api.elano.cloud/api/payments/webhook/paystack
```

#### External APIs
```bash
OPENWEATHER_API_KEY=your_openweather_key
GEMINI_API_KEY=your_gemini_key
```

### Secrets Management

#### Docker Compose
Secrets are loaded from `.env` file automatically.

#### Kubernetes
**⚠️ IMPORTANT**: The `k8s/secrets.yaml` contains base64-encoded values. For production:

1. **Use Sealed Secrets**:
```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Seal your secrets
kubeseal --format=yaml < k8s/secrets.yaml > k8s/sealed-secrets.yaml

# Apply sealed secrets
kubectl apply -f k8s/sealed-secrets.yaml
```

2. **Or use external secrets manager**:
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - Google Secret Manager

### Resource Limits

Current configuration (adjust based on load):

```yaml
resources:
  limits:
    cpu: "1000m"      # 1 CPU core
    memory: "1Gi"     # 1 GB RAM
  requests:
    cpu: "500m"       # 0.5 CPU core
    memory: "512Mi"   # 512 MB RAM
```

### Auto-scaling

HPA configuration:
- **Min replicas**: 3
- **Max replicas**: 10
- **Scale up**: When CPU > 70% or Memory > 80%
- **Scale down**: After 5 minutes of reduced load

## 📊 Monitoring

### Health Checks

```bash
# Docker
curl http://localhost:5000/health

# Kubernetes
kubectl exec -n elano <pod-name> -- curl localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "auth-system",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Prometheus Metrics

Metrics available at port 9090:
```bash
# Port forward metrics endpoint
kubectl port-forward -n elano svc/elano-auth-service 9090:9090

# Scrape metrics
curl http://localhost:9090/metrics
```

### Logs

#### Docker Compose
```bash
# View logs
docker-compose logs elano-auth-service

# Follow logs
docker-compose logs -f elano-auth-service

# Last 100 lines
docker-compose logs --tail=100 elano-auth-service
```

#### Kubernetes
```bash
# View logs from all pods
kubectl logs -n elano -l app=elano-auth-service

# Follow logs
kubectl logs -f -n elano -l app=elano-auth-service

# Logs from specific pod
kubectl logs -n elano <pod-name>

# Previous container logs (if crashed)
kubectl logs -n elano <pod-name> --previous
```

### Alerts

Prometheus alerts configured in `k8s/monitoring.yaml`:
- **AuthServiceHighErrorRate**: > 5% error rate for 5 minutes
- **AuthServicePodDown**: < 2 available replicas for 2 minutes
- **AuthServiceHighMemoryUsage**: > 90% memory for 5 minutes
- **AuthServiceHighCPUUsage**: > 90% CPU for 10 minutes
- **AuthServiceHealthCheckFailing**: Health check fails for 2 minutes
- **AuthServiceHighResponseTime**: 95th percentile > 2s for 5 minutes

## 🔧 Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check container logs
docker logs elano-auth-system

# Common causes:
# - Missing environment variables
# - Cannot connect to MongoDB
# - Port already in use
# - Invalid configuration

# Solution: Check .env file and MongoDB connection
```

#### 2. Health Check Failing

```bash
# Test health endpoint
curl http://localhost:5000/health

# Check if service is listening
netstat -an | grep 5000

# Common causes:
# - Application crashed
# - Database connection failed
# - Port not exposed correctly

# Solution: Check logs for errors
docker logs elano-auth-system
```

#### 3. MongoDB Connection Failed

```bash
# Verify MongoDB URI
echo $MONGO_URI

# Test connection from container
docker exec -it elano-auth-system sh
apk add mongodb-tools
mongosh "$MONGO_URI"

# Common causes:
# - Invalid credentials
# - IP not whitelisted in Atlas
# - Network issues

# Solution: Check MongoDB Atlas settings
```

#### 4. Kubernetes Pods Crash Looping

```bash
# Check pod status
kubectl get pods -n elano -l app=elano-auth-service

# View pod events
kubectl describe pod -n elano <pod-name>

# Check logs
kubectl logs -n elano <pod-name>

# Common causes:
# - Secrets not created/incorrect
# - PVC not bound
# - Image pull errors
# - OOM (Out of Memory)

# Solutions:
# 1. Verify secrets exist
kubectl get secrets -n elano elano-auth-secrets

# 2. Check PVC status
kubectl get pvc -n elano

# 3. Increase memory limits if OOM
```

#### 5. Service Not Accessible

```bash
# Check service exists
kubectl get svc -n elano elano-auth-service

# Check endpoints
kubectl get endpoints -n elano elano-auth-service

# Test from within cluster
kubectl run -it --rm debug --image=alpine --restart=Never -- sh
apk add curl
curl http://elano-auth-service.elano.svc.cluster.local:5000/health

# Common causes:
# - Service selector mismatch
# - Pods not ready
# - Network policy blocking traffic

# Solution: Verify service selector matches pod labels
```

### Debug Commands

```bash
# Docker
docker inspect elano-auth-system
docker stats elano-auth-system
docker top elano-auth-system

# Kubernetes
kubectl describe pod -n elano <pod-name>
kubectl get pod -n elano <pod-name> -o yaml
kubectl top pod -n elano -l app=elano-auth-service
kubectl exec -it -n elano <pod-name> -- sh
```

## 🔒 Security

### Docker Security

1. **Non-root User**: Container runs as user `1001`
2. **Read-only Filesystem**: Immutable container filesystem
3. **No Privileges**: All capabilities dropped
4. **Minimal Base Image**: Alpine Linux (~5MB base)
5. **Security Scanning**: Use Trivy to scan for vulnerabilities

```bash
# Scan image for vulnerabilities
trivy image elano/auth-system-service:latest

# High and critical only
trivy image --severity HIGH,CRITICAL elano/auth-system-service:latest
```

### Kubernetes Security

1. **Network Policies**: Restrict pod-to-pod communication
2. **RBAC**: Minimal permissions for service account
3. **Pod Security**: `seccompProfile`, non-root, dropped capabilities
4. **Secrets Management**: Use Sealed Secrets or external vault
5. **TLS**: All external traffic encrypted with Let's Encrypt

### Best Practices

1. **Never commit `.env` or `secrets.yaml`** to version control
2. **Rotate secrets regularly** (every 90 days minimum)
3. **Use strong, randomly generated secrets**
4. **Enable MongoDB authentication and encryption**
5. **Whitelist only necessary IPs in MongoDB Atlas**
6. **Monitor logs for suspicious activity**
7. **Keep base images updated** (`docker pull node:20-alpine`)
8. **Scan images before deployment**
9. **Use resource limits** to prevent resource exhaustion
10. **Enable audit logging** in Kubernetes

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Elano Platform Documentation](../README.md)

## 🆘 Support

For issues or questions:
1. Check logs first
2. Review this documentation
3. Search existing issues
4. Contact: maintainer@elano.cloud

---

**Last Updated**: 2024-01-15  
**Version**: 1.0.0  
**Maintainer**: Elano DevOps Team
