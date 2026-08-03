# OpenShift Deployment Guide

## Prerequisites

1. Access to OpenShift cluster (borneo-dev-monitoring namespace)
2. Container images pushed to registry (GitHub Container Registry)
3. Istio gateway configured (borneo-dev-gateway)

## Step 1: Build and Push Container Images

### Backend
```bash
cd backend
docker build -t ghcr.io/masuddh/openshift-pod-shell-backend:latest .
docker push ghcr.io/masuddh/openshift-pod-shell-backend:latest
```

### Frontend
```bash
cd frontend
docker build -t ghcr.io/masuddh/openshift-pod-shell-frontend:latest .
docker push ghcr.io/masuddh/openshift-pod-shell-frontend:latest
```

## Step 2: Deploy to OpenShift

```bash
# Login to OpenShift
oc login --server=https://api.ocpdev-jkt.adira.co.id:6443

# Switch to borneo-dev-monitoring namespace
oc project borneo-dev-monitoring

# Apply deployments and services
oc apply -f k8s/deployment.yaml

# Apply Istio VirtualService
oc apply -f k8s/virtualservice.yaml

# Check deployment status
oc get pods -l app=openshift-pod-shell
oc get svc -l app=openshift-pod-shell
oc get virtualservice openshift-pod-shell
```

## Step 3: Verify Deployment

```bash
# Check pod logs
oc logs -f deployment/openshift-pod-shell-backend
oc logs -f deployment/openshift-pod-shell-frontend

# Test backend health
oc port-forward svc/openshift-pod-shell-backend 3001:3001
curl http://localhost:3001/health

# Test frontend health
oc port-forward svc/openshift-pod-shell-frontend 8081:8081
curl http://localhost:8081/health
```

## Step 4: Access the Application

Open browser and navigate to:
```
https://borneo-dev-monitoring-ocp.adira.co.id/pod-shell/
```

## Update Application

To update after code changes:

```bash
# Rebuild and push images
docker build -t ghcr.io/masuddh/openshift-pod-shell-backend:v1.1 ./backend
docker push ghcr.io/masuddh/openshift-pod-shell-backend:v1.1

docker build -t ghcr.io/masuddh/openshift-pod-shell-frontend:v1.1 ./frontend
docker push ghcr.io/masuddh/openshift-pod-shell-frontend:v1.1

# Update deployment
oc set image deployment/openshift-pod-shell-backend backend=ghcr.io/masuddh/openshift-pod-shell-backend:v1.1
oc set image deployment/openshift-pod-shell-frontend frontend=ghcr.io/masuddh/openshift-pod-shell-frontend:v1.1

# Or rollout restart
oc rollout restart deployment/openshift-pod-shell-backend
oc rollout restart deployment/openshift-pod-shell-frontend

# Watch rollout status
oc rollout status deployment/openshift-pod-shell-backend
oc rollout status deployment/openshift-pod-shell-frontend
```

## Troubleshooting

### Check pod status
```bash
oc get pods -l app=openshift-pod-shell
oc describe pod <pod-name>
```

### View logs
```bash
oc logs -f deployment/openshift-pod-shell-backend
oc logs -f deployment/openshift-pod-shell-frontend
```

### Check Istio routing
```bash
oc get virtualservice openshift-pod-shell -o yaml
oc get gateway -n istio-system borneo-dev-gateway
```

### Test connectivity
```bash
# From within the cluster
oc run -it --rm debug --image=curlimages/curl --restart=Never -- sh
curl http://openshift-pod-shell-backend.borneo-dev-monitoring.svc.cluster.local:3001/health
curl http://openshift-pod-shell-frontend.borneo-dev-monitoring.svc.cluster.local:8081/health
```

## RBAC Requirements

The application needs ServiceAccount with permissions to:
- List projects (project.openshift.io)
- Get/List pods in accessible namespaces
- Create pod/exec connections

Users authenticate with their own tokens, so the application uses their RBAC permissions.

## Configuration

### Environment Variables (Backend)
- `NODE_ENV`: production
- `PORT`: 3001

### Istio Gateway
Ensure `borneo-dev-gateway` exists in `istio-system` namespace:
```bash
oc get gateway -n istio-system borneo-dev-gateway
```

### DNS
Ensure `borneo-dev-monitoring-ocp.adira.co.id` points to Istio ingress gateway.

## Security Notes

1. Application uses user's own OpenShift token (no credential storage)
2. RBAC enforced by OpenShift (users can only access their permitted resources)
3. TLS terminated at Istio gateway
4. WebSocket connections use same authentication
