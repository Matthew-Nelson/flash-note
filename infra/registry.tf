resource "google_artifact_registry_repository" "flashnote" {
  location      = var.region
  repository_id = "flashnote"
  description   = "FlashNote Docker images"
  format        = "DOCKER"

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}
