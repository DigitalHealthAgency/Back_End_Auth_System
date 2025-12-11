#!/bin/bash

# =============================================================================
# Kubernetes Deployment Script for Auth System Service
# =============================================================================
# This script deploys the Auth System service to a Kubernetes cluster.
#
# Usage:
#   ./deploy-k8s.sh              # Deploy to current context
#   ./deploy-k8s.sh --apply      # Apply all manifests
#   ./deploy-k8s.sh --delete     # Delete all resources
#   ./deploy-k8s.sh --status     # Check deployment status
# =============================================================================

set -e  # Exit on error

# Configuration
NAMESPACE="elano"
APP_NAME="elano-auth-service"
K8S_DIR="k8s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
ACTION="apply"

for arg in "$@"; do
    case $arg in
        --apply)
            ACTION="apply"
            shift
            ;;
        --delete)
            ACTION="delete"
            shift
            ;;
        --status)
            ACTION="status"
            shift
            ;;
        --help)
            echo "Usage: ./deploy-k8s.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --apply     Apply all Kubernetes manifests (default)"
            echo "  --delete    Delete all resources"
            echo "  --status    Check deployment status"
            echo "  --help      Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            exit 1
            ;;
    esac
done

# Print header
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}Auth System Kubernetes Deployment${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Check if kubectl is installed
echo -e "${YELLOW}Checking kubectl...${NC}"
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi
echo -e "${GREEN} kubectl is installed${NC}"
echo ""

# Check cluster connection
echo -e "${YELLOW}Checking cluster connection...${NC}"
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi
echo -e "${GREEN} Connected to cluster${NC}"
echo ""

# Display current context
CURRENT_CONTEXT=$(kubectl config current-context)
echo -e "Current context: ${BLUE}${CURRENT_CONTEXT}${NC}"
echo ""

# Confirm action for delete
if [ "$ACTION" = "delete" ]; then
    echo -e "${RED}WARNING: This will delete all Auth System resources!${NC}"
    read -p "Are you sure? (yes/no): " -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Execute action
case $ACTION in
    apply)
        echo -e "${YELLOW}Deploying Auth System to Kubernetes...${NC}"
        echo ""
        
        # Create namespace if it doesn't exist
        echo -e "${YELLOW}Creating namespace...${NC}"
        kubectl apply -f "${K8S_DIR}/namespace.yaml"
        echo ""
        
        # Apply secrets (should be done securely in production)
        echo -e "${YELLOW}Applying secrets...${NC}"
        kubectl apply -f "${K8S_DIR}/secrets.yaml"
        echo ""
        
        # Apply ConfigMap
        echo -e "${YELLOW}Applying ConfigMap...${NC}"
        kubectl apply -f "${K8S_DIR}/configmap.yaml"
        echo ""
        
        # Apply RBAC
        echo -e "${YELLOW}Applying RBAC...${NC}"
        kubectl apply -f "${K8S_DIR}/rbac.yaml"
        echo ""
        
        # Apply PVC
        echo -e "${YELLOW}Applying Persistent Volume Claims...${NC}"
        kubectl apply -f "${K8S_DIR}/pvc.yaml"
        echo ""
        
        # Apply Deployment
        echo -e "${YELLOW}Applying Deployment...${NC}"
        kubectl apply -f "${K8S_DIR}/deployment.yaml"
        echo ""
        
        # Apply Service
        echo -e "${YELLOW}Applying Service...${NC}"
        kubectl apply -f "${K8S_DIR}/service.yaml"
        echo ""
        
        # Apply HPA
        echo -e "${YELLOW}Applying HorizontalPodAutoscaler...${NC}"
        kubectl apply -f "${K8S_DIR}/hpa.yaml"
        echo ""
        
        # Apply Network Policy
        echo -e "${YELLOW}Applying Network Policy...${NC}"
        kubectl apply -f "${K8S_DIR}/network-policy.yaml"
        echo ""
        
        # Apply Monitoring (if Prometheus Operator is installed)
        if kubectl get crd servicemonitors.monitoring.coreos.com &> /dev/null; then
            echo -e "${YELLOW}Applying Service Monitor...${NC}"
            kubectl apply -f "${K8S_DIR}/monitoring.yaml"
            echo ""
        else
            echo -e "${YELLOW}Note: Prometheus Operator not found. Skipping monitoring setup.${NC}"
            echo ""
        fi
        
        # Apply Ingress
        echo -e "${YELLOW}Applying Ingress...${NC}"
        kubectl apply -f "${K8S_DIR}/ingress.yaml"
        echo ""
        
        echo -e "${GREEN} Deployment completed${NC}"
        echo ""
        
        # Wait for rollout
        echo -e "${YELLOW}Waiting for deployment to be ready...${NC}"
        kubectl rollout status deployment/elano-auth-deployment -n ${NAMESPACE} --timeout=300s
        echo ""
        
        # Display status
        echo -e "${GREEN}Deployment Status:${NC}"
        kubectl get pods -n ${NAMESPACE} -l app=${APP_NAME}
        echo ""
        kubectl get svc -n ${NAMESPACE} -l app=${APP_NAME}
        echo ""
        
        ;;
        
    delete)
        echo -e "${YELLOW}Deleting Auth System resources...${NC}"
        echo ""
        
        # Delete in reverse order
        kubectl delete -f "${K8S_DIR}/ingress.yaml" --ignore-not-found=true
        kubectl delete -f "${K8S_DIR}/monitoring.yaml" --ignore-not-found=true
        kubectl delete -f "${K8S_DIR}/network-policy.yaml" --ignore-not-found=true
        kubectl delete -f "${K8S_DIR}/hpa.yaml" --ignore-not-found=true
        kubectl delete -f "${K8S_DIR}/service.yaml" --ignore-not-found=true
        kubectl delete -f "${K8S_DIR}/deployment.yaml" --ignore-not-found=true
        kubectl delete -f "${K8S_DIR}/pvc.yaml" --ignore-not-found=true
        kubectl delete -f "${K8S_DIR}/rbac.yaml" --ignore-not-found=true
        kubectl delete -f "${K8S_DIR}/configmap.yaml" --ignore-not-found=true
        kubectl delete -f "${K8S_DIR}/secrets.yaml" --ignore-not-found=true
        
        echo ""
        echo -e "${GREEN} Resources deleted${NC}"
        
        ;;
        
    status)
        echo -e "${YELLOW}Checking deployment status...${NC}"
        echo ""
        
        echo -e "${BLUE}Pods:${NC}"
        kubectl get pods -n ${NAMESPACE} -l app=${APP_NAME}
        echo ""
        
        echo -e "${BLUE}Services:${NC}"
        kubectl get svc -n ${NAMESPACE} -l app=${APP_NAME}
        echo ""
        
        echo -e "${BLUE}Ingress:${NC}"
        kubectl get ingress -n ${NAMESPACE} elano-auth-ingress
        echo ""
        
        echo -e "${BLUE}HPA:${NC}"
        kubectl get hpa -n ${NAMESPACE} elano-auth-hpa
        echo ""
        
        echo -e "${BLUE}PVC:${NC}"
        kubectl get pvc -n ${NAMESPACE} -l app=${APP_NAME}
        echo ""
        
        # Recent events
        echo -e "${BLUE}Recent Events:${NC}"
        kubectl get events -n ${NAMESPACE} --sort-by='.lastTimestamp' | grep ${APP_NAME} | tail -10
        echo ""
        
        # Pod logs (last 20 lines)
        POD_NAME=$(kubectl get pods -n ${NAMESPACE} -l app=${APP_NAME} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        if [ ! -z "$POD_NAME" ]; then
            echo -e "${BLUE}Recent Logs (${POD_NAME}):${NC}"
            kubectl logs -n ${NAMESPACE} ${POD_NAME} --tail=20
        fi
        
        ;;
esac

# Summary
echo ""
echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}Operation completed!${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

if [ "$ACTION" = "apply" ]; then
    echo -e "Useful commands:"
    echo -e "  View logs:        ${YELLOW}kubectl logs -f -n ${NAMESPACE} -l app=${APP_NAME}${NC}"
    echo -e "  Check status:     ${YELLOW}./scripts/deploy-k8s.sh --status${NC}"
    echo -e "  Port forward:     ${YELLOW}kubectl port-forward -n ${NAMESPACE} svc/elano-auth-service 5000:5000${NC}"
    echo -e "  Scale manually:   ${YELLOW}kubectl scale deployment/elano-auth-deployment -n ${NAMESPACE} --replicas=5${NC}"
    echo ""
    echo -e "Access the service:"
    echo -e "  Local:            ${YELLOW}http://localhost:5000${NC}"
    echo -e "  Production:       ${YELLOW}https://api.elano.cloud/api/auth${NC}"
    echo ""
fi
