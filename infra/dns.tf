# DNS zone and records for the application domain.
#
# If DNS is managed externally (e.g., Cloudflare, registrar), set
# manage_dns = false (the default) and manually create an A record
# pointing your domain to the load_balancer_ip output.
#
# To use Google Cloud DNS, set manage_dns = true in your tfvars and
# point the domain's nameservers to Google's NS records.

variable "manage_dns" {
  type        = bool
  description = "Whether to manage DNS in Terraform (false if using external DNS)"
  default     = false
}

# Enable Cloud DNS API only when managing DNS in Terraform.
resource "google_project_service" "dns_api" {
  count = var.manage_dns ? 1 : 0

  project                    = var.project_id
  service                    = "dns.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_dns_managed_zone" "primary" {
  count       = var.manage_dns ? 1 : 0
  name        = "${local.service_name}-zone-${var.environment}"
  dns_name    = "${var.domain}."
  description = "DNS zone for ${var.domain}"

  depends_on = [google_project_service.dns_api]
}

resource "google_dns_record_set" "a" {
  count        = var.manage_dns ? 1 : 0
  name         = "${var.domain}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.primary[0].name
  rrdatas      = [google_compute_global_address.default.address]
}
