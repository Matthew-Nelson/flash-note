terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.24"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "gcs" {
    # bucket and prefix are set via CLI -backend-config per environment:
    #   terraform init -backend-config="bucket=flashnote-terraform-state" -backend-config="prefix=staging"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "random" {}

# Aliased provider for cross-project Artifact Registry access.
# In production, this targets the staging project so we can grant
# the production runtime SA read access to the staging registry.
provider "google" {
  alias   = "staging"
  project = var.staging_project_id
  region  = var.region
}

locals {
  env          = var.environment
  service_name = "flashnote"
  image        = "${var.region}-docker.pkg.dev/${var.project_id}/${local.service_name}/${local.service_name}"
}
