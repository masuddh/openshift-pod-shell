# Quick Deploy Guide

## Build & Push Images

```bash
# Make script executable
chmod +x deploy.sh

# Build and push to Adira registry
./deploy.sh latest
```

Script akan build dan push ke:
- `registry-colla.adira.co.id/borneo/openshift-pod-shell-backend:latest`
- `registry-colla.adira.co.id/borneo/openshift-pod-shell-frontend:latest`

## Deploy ke OpenShift

```bash
# Login ke OpenShift
oc login --server=https://api.ocpdev-jkt.adira.co.id:6443

# Switch ke namespace
oc project borneo-dev-monitoring

# Deploy aplikasi
oc apply -f k8s/deployment.yaml
oc apply -f k8s/virtualservice.yaml

# Check status
oc get pods -l app=openshift-pod-shell
oc logs -f deployment/openshift-pod-shell-backend
```

## Update Aplikasi

```bash
# Build & push versi baru
./deploy.sh v1.1

# Update deployment
oc set image deployment/openshift-pod-shell-backend backend=registry-colla.adira.co.id/borneo/openshift-pod-shell-backend:v1.1
oc set image deployment/openshift-pod-shell-frontend frontend=registry-colla.adira.co.id/borneo/openshift-pod-shell-frontend:v1.1

# Atau restart deployment
oc rollout restart deployment/openshift-pod-shell-backend
oc rollout restart deployment/openshift-pod-shell-frontend
```

## Akses Aplikasi

URL: **https://borneo-dev-monitoring-ocp.adira.co.id/pod-shell/**

Login dengan:
- Token saja (OpenShift URL sudah predefined)
- Get token: `oc whoami -t`

## Troubleshooting

```bash
# Check pods
oc get pods -l app=openshift-pod-shell
oc describe pod <pod-name>

# View logs
oc logs -f deployment/openshift-pod-shell-backend
oc logs -f deployment/openshift-pod-shell-frontend

# Check routing
oc get virtualservice openshift-pod-shell -o yaml
```
