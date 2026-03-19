variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "staging_project_id" {
  type        = string
  description = "Staging GCP project ID -- used by production to reference staging Artifact Registry for cross-project image pulls"
  default     = "flashnote-staging"
}

variable "region" {
  type        = string
  description = "GCP region for all resources"
  default     = "us-central1"
}

variable "environment" {
  type        = string
  description = "Deployment environment: staging or production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be \"staging\" or \"production\""
  }
}

variable "domain" {
  type        = string
  description = "Primary domain for this environment (e.g., flashnote.co or staging.flashnote.co)"
}

variable "github_repo_owner" {
  type        = string
  description = "GitHub org or user that owns the repository"
}

variable "github_repo_name" {
  type        = string
  description = "GitHub repository name"
  default     = "flash-note"
}

variable "github_repo_owner_id" {
  type        = string
  description = "Numeric GitHub owner ID for WIF attribute_condition (prevents typosquatting)"
}

variable "db_tier" {
  type        = string
  description = "Cloud SQL machine tier (e.g., db-f1-micro for staging, db-custom-1-3840 for production)"
}

variable "db_availability_type" {
  type        = string
  description = "Cloud SQL availability type: ZONAL for staging, REGIONAL for production HA"
  default     = "ZONAL"
}

# Cloud Run variables (used by Plan 03)
variable "cloudrun_min_instances" {
  type        = number
  description = "Minimum Cloud Run instances (0 for pre-launch cost savings)"
  default     = 0
}

variable "cloudrun_max_instances" {
  type        = number
  description = "Maximum Cloud Run instances"
  default     = 10
}

variable "cloudrun_memory" {
  type        = string
  description = "Cloud Run instance memory allocation"
  default     = "1Gi"
}

variable "cloudrun_cpu" {
  type        = string
  description = "Cloud Run instance CPU allocation"
  default     = "1"
}

# Cross-project registry access (staging-only variable)
variable "prod_runtime_sa_email" {
  type        = string
  description = "Production Cloud Run runtime SA email -- set after production infra is created to grant cross-project Artifact Registry read access"
  default     = ""
}
