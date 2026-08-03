#!/bin/bash
set -e

# Configuration
REGISTRY="ghcr.io/masuddh"
IMAGE_BACKEND="openshift-pod-shell-backend"
IMAGE_FRONTEND="openshift-pod-shell-frontend"
VERSION="${1:-latest}"

echo "🚀 Deploying OpenShift Pod Shell to borneo-dev-apps"
echo "Version: $VERSION"
echo ""

# Check if logged in to OpenShift
if ! oc whoami &>/dev/null; then
    echo "❌ Not logged in to OpenShift. Please run:"
    echo "   oc login --server=https://api.ocpdev-jkt.adira.co.id:6443"
    exit 1
fi

# Switch to correct project
echo "📦 Switching to borneo-dev-apps namespace..."
oc project borneo-dev-apps

# Build and push backend
echo ""
echo "🔨 Building backend image..."
cd backend
docker build -t $REGISTRY/$IMAGE_BACKEND:$VERSION .
echo "📤 Pushing backend image..."
docker push $REGISTRY/$IMAGE_BACKEND:$VERSION
cd ..

# Build and push frontend
echo ""
echo "🔨 Building frontend image..."
cd frontend
docker build -t $REGISTRY/$IMAGE_FRONTEND:$VERSION .
echo "📤 Pushing frontend image..."
docker push $REGISTRY/$IMAGE_FRONTEND:$VERSION
cd ..

# Update deployment manifests with version
echo ""
echo "📝 Updating deployment manifests..."
sed -i.bak "s|image: $REGISTRY/$IMAGE_BACKEND:.*|image: $REGISTRY/$IMAGE_BACKEND:$VERSION|g" k8s/deployment.yaml
sed -i.bak "s|image: $REGISTRY/$IMAGE_FRONTEND:.*|image: $REGISTRY/$IMAGE_FRONTEND:$VERSION|g" k8s/deployment.yaml

# Apply deployments
echo ""
echo "☸️  Applying Kubernetes manifests..."
oc apply -f k8s/deployment.yaml
oc apply -f k8s/virtualservice.yaml

# Wait for rollout
echo ""
echo "⏳ Waiting for deployment to complete..."
oc rollout status deployment/openshift-pod-shell-backend --timeout=2m
oc rollout status deployment/openshift-pod-shell-frontend --timeout=2m

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Pod status:"
oc get pods -l app=openshift-pod-shell

echo ""
echo "🌐 Application URL:"
echo "   https://borneo-dev-apps-ocp.adira.co.id/pod-shell/"
echo ""
echo "📝 View logs:"
echo "   oc logs -f deployment/openshift-pod-shell-backend"
echo "   oc logs -f deployment/openshift-pod-shell-frontend"
