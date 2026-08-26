pipeline {
    agent { label 'docker-builder' }
    environment {
        REGISTRY_DOMAIN = 'kregistry.siwko.org:5000'
        IMAGE_NAME      = 'cards'
        IMAGE_TAG       = "${env.BUILD_NUMBER}"
        DEPLOYMENT_NAME = 'cards'
    }
    stages {
        stage('Checkout Code') {
            steps { checkout scm }
        }
        stage('Build & Push Image') {
            steps {
                sh "docker build -t ${REGISTRY_DOMAIN}/${IMAGE_NAME}:${IMAGE_TAG} -t ${REGISTRY_DOMAIN}/${IMAGE_NAME}:latest ."
                sh "docker push ${REGISTRY_DOMAIN}/${IMAGE_NAME}:${IMAGE_TAG}"
                sh "docker push ${REGISTRY_DOMAIN}/${IMAGE_NAME}:latest"
            }
        }
        stage('Deploy to Kubernetes') {
            steps {
                sh "kubectl apply -f k8s/"
                sh "kubectl set image deployment/${DEPLOYMENT_NAME} ${DEPLOYMENT_NAME}=${REGISTRY_DOMAIN}/${IMAGE_NAME}:${IMAGE_TAG}"
                sh "kubectl rollout status deployment/${DEPLOYMENT_NAME} --timeout=4m"
            }
        }
    }
    post {
        always { cleanWs() }
    }
}
