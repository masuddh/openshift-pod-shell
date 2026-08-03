#!/bin/bash
set -e

# Configuration
REGISTRY="registry-colla.adira.co.id/borneo"
IMAGE_BACKEND="openshift-pod-shell-backend"
IMAGE_FRONTEND="openshift-pod-shell-frontend"
VERSION="${1:-latest}"

echo "🚀 Building and pushing OpenShift Pod Shell images"
echo "Registry: $REGISTRY"
echo "Version: $VERSION"
echo ""

# Build and push backend
echo "🔨 Building backend image..."
cd backend
docker build -t $REGISTRY/$IMAGE_BACKEND:$VERSION .
echo "📤 Pushing backend image to registry..."
docker push $REGISTRY/$IMAGE_BACKEND:$VERSION
cd ..

echo ""
echo "🔨 Building frontend image..."
cd frontend
docker build -t $REGISTRY/$IMAGE_FRONTEND:$VERSION .
echo "📤 Pushing frontend image to registry..."
docker push $REGISTRY/$IMAGE_FRONTEND:$VERSION
cd ..

echo ""
echo "✅ Images pushed successfully!"
echo ""
echo "📦 Images:"
echo "   - $REGISTRY/$IMAGE_BACKEND:$VERSION"
echo "   - $REGISTRY/$IMAGE_FRONTEND:$VERSION"
echo ""
echo "📝 Next steps:"
echo "   1. Update k8s/deployment.yaml with the image paths above"
echo "   2. Deploy to OpenShift:"
echo "      oc apply -f k8s/deployment.yaml"
echo "      oc apply -f k8s/virtualservice.yaml"
echo ""
echo "🌐 Application URL:"
echo "   https://borneo-dev-apps-ocp.adira.co.id/pod-shell/"
