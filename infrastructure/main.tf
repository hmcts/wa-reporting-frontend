provider "azurerm" {
  features {}
}

locals {
  resourceGroup              = "${var.product}-${var.env}"
  vaultName                  = "${var.product}-${var.env}"
  rdVaultName                = "rd-${var.env}"
  rdResourceGroup            = "rd-${var.env}"
  s2sVaultName               = "s2s-${var.env}"
  s2sResourceGroup           = "rpe-service-auth-provider-${var.env}"
  managed_redis_environments = ["demo"]
}

data "azurerm_key_vault" "wa_key_vault" {
  name                = local.vaultName
  resource_group_name = local.resourceGroup
}

data "azurerm_key_vault" "rd_key_vault" {
  name                = local.rdVaultName
  resource_group_name = local.rdResourceGroup
}

data "azurerm_key_vault" "s2s_key_vault" {
  name                = local.s2sVaultName
  resource_group_name = local.s2sResourceGroup
}

data "azurerm_subnet" "redis_private_endpoint" {
  for_each = toset(contains(local.managed_redis_environments, var.env) ? [var.env] : [])

  name                 = "core-infra-subnet-2-${var.env}"
  resource_group_name  = "core-infra-${var.env}"
  virtual_network_name = "core-infra-vnet-${var.env}"
}

data "azurerm_key_vault_secret" "source_caseworker_ref_api_postgres_user" {
  name         = "caseworker-ref-api-POSTGRES-USER"
  key_vault_id = data.azurerm_key_vault.rd_key_vault.id
}

data "azurerm_key_vault_secret" "source_caseworker_ref_api_postgres_pass" {
  name         = "caseworker-ref-api-POSTGRES-PASS"
  key_vault_id = data.azurerm_key_vault.rd_key_vault.id
}

data "azurerm_key_vault_secret" "source_location_ref_api_postgres_user" {
  name         = "location-ref-api-POSTGRES-USER"
  key_vault_id = data.azurerm_key_vault.rd_key_vault.id
}

data "azurerm_key_vault_secret" "source_location_ref_api_postgres_pass" {
  name         = "location-ref-api-POSTGRES-PASS"
  key_vault_id = data.azurerm_key_vault.rd_key_vault.id
}

data "azurerm_key_vault_secret" "source_wa_reporting_frontend_s2s_secret" {
  name         = "microservicekey-wa-reporting-frontend"
  key_vault_id = data.azurerm_key_vault.s2s_key_vault.id
}

module "redis" {
  source        = "git@github.com:hmcts/cnp-module-redis?ref=master"
  product       = var.product
  name          = "${var.product}-${var.component}-${var.env}"
  location      = var.location
  env           = var.env
  common_tags   = var.common_tags
  redis_version = "6"
  business_area = "cft"
  sku_name      = var.redis_sku_name
  family        = var.redis_family
  capacity      = var.redis_capacity

  private_endpoint_enabled      = true
  public_network_access_enabled = false
}

resource "azurerm_key_vault_secret" "redis_host" {
  name  = "wa-reporting-redis-host"
  value = module.redis.host_name

  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "azurerm_key_vault_secret" "redis_port" {
  name  = "wa-reporting-redis-port"
  value = module.redis.redis_port

  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "azurerm_key_vault_secret" "redis_access_key" {
  name  = "wa-reporting-redis-access-key"
  value = module.redis.access_key

  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

module "managed_redis" {
  for_each = toset(contains(local.managed_redis_environments, var.env) ? [var.env] : [])
  source   = "git@github.com:hmcts/terraform-module-azure-managed-redis?ref=main"

  product     = var.product
  component   = var.component
  env         = var.env
  location    = var.location
  common_tags = var.common_tags

  sku_name = var.managed_redis_sku_name

  public_network_access   = "Disabled"
  create_private_endpoint = true
  subnet_id               = data.azurerm_subnet.redis_private_endpoint[each.key].id
  private_dns_zone_ids    = ["/subscriptions/${var.private_dns_subscription_id}/resourceGroups/core-infra-intsvc-rg/providers/Microsoft.Network/privateDnsZones/privatelink.redis.azure.net"]

  access_keys_authentication_enabled = true
}

resource "azurerm_key_vault_secret" "managed_redis_host" {
  for_each = module.managed_redis

  name         = "azure-managed-redis-host"
  value        = each.value.hostname
  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "azurerm_key_vault_secret" "managed_redis_port" {
  for_each = module.managed_redis

  name         = "azure-managed-redis-port"
  value        = tostring(each.value.port)
  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "azurerm_key_vault_secret" "managed_redis_access_key" {
  for_each = module.managed_redis

  name         = "azure-managed-redis-access-key"
  value        = each.value.primary_access_key
  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "azurerm_key_vault_secret" "rd_caseworker_ref_api_postgres_user" {
  name         = "rd-caseworker-ref-api-POSTGRES-USER"
  value        = data.azurerm_key_vault_secret.source_caseworker_ref_api_postgres_user.value
  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "azurerm_key_vault_secret" "rd_caseworker_ref_api_postgres_pass" {
  name         = "rd-caseworker-ref-api-POSTGRES-PASS"
  value        = data.azurerm_key_vault_secret.source_caseworker_ref_api_postgres_pass.value
  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "azurerm_key_vault_secret" "rd_location_ref_api_postgres_user" {
  name         = "rd-location-ref-api-POSTGRES-USER"
  value        = data.azurerm_key_vault_secret.source_location_ref_api_postgres_user.value
  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "azurerm_key_vault_secret" "rd_location_ref_api_postgres_pass" {
  name         = "rd-location-ref-api-POSTGRES-PASS"
  value        = data.azurerm_key_vault_secret.source_location_ref_api_postgres_pass.value
  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "random_string" "wa_reporting_frontend_session_secret" {
  length = 16
}

resource "azurerm_key_vault_secret" "session_secret" {
  name         = "wa-reporting-frontend-session-secret"
  value        = random_string.wa_reporting_frontend_session_secret.result
  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}

resource "azurerm_key_vault_secret" "wa_reporting_frontend_s2s_secret" {
  name         = "wa-reporting-frontend-s2s-secret"
  value        = data.azurerm_key_vault_secret.source_wa_reporting_frontend_s2s_secret.value
  key_vault_id = data.azurerm_key_vault.wa_key_vault.id
}
